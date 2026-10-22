#!/usr/bin/env bash
#
# 把一个 Vercel 项目的环境变量复制到另一个。
#
#   bash scripts/copy-vercel-env.sh quitccp quitccp-en
#
# ## 为什么要有这个
#
# 多语言站一个语言一个 Vercel 项目（next.config.ts 在构建时就把 SITE_LOCALE
# 编进了客户端包，一个项目没法同时服务两种语言）。45 条环境变量在后台一条
# 一条手敲，既慢又一定会敲错一个 —— 而敲错的那一个往往要等上线才发现。
#
# ## 值不经过屏幕
#
# 脚本只打印键名和结果，不打印值。临时文件用 umask 077 创建、trap 删除，
# 中途按 Ctrl-C 也会删掉。
#
# ## 哪些不复制
#
# SITE_LOCALE        每个站不一样，这是区分它们的那一条
# NEXT_PUBLIC_SITE_URL  每个站自己的地址，复制过去会让新站以为自己是中文站
# CERT_STATS_URL / PROBE_BYPASS_SECRET / CLOUDFLARE_* / GITHUB_RENDER_*
#                    这几条绑在中文站的域名和防火墙上，对新站没有意义
#
# ## 复制不过来的
#
# Vercel 把标成 sensitive 的变量设计成写进去就读不出来（JWT_SECRET、R2_*）。
# 这类 vercel env pull 拿到的是空值，脚本会跳过并在最后列出来，需要到后台
# 另行设置。JWT_SECRET 本来也不该两个站共用 —— 各自签各自的登录会话。

set -euo pipefail

SRC="${1:-}"
DST="${2:-}"
if [ -z "$SRC" ] || [ -z "$DST" ]; then
  echo "用法：bash scripts/copy-vercel-env.sh <源项目> <目标项目>"
  exit 1
fi

SKIP_KEYS="SITE_LOCALE NEXT_PUBLIC_SITE_URL CERT_STATS_URL PROBE_BYPASS_SECRET CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN GITHUB_RENDER_REPO GITHUB_RENDER_TOKEN VERCEL_DRAIN_SIGNATURE_SECRET"

# Vercel 自己注入的那些，不是项目变量，一条都不能抄过去。
#
# vercel env pull 吐出来的是「这个环境里最终能看到的全部变量」，里面混着
# Vercel 构建时自动注入的 VERCEL / VERCEL_ENV / VERCEL_URL / VERCEL_GIT_* /
# VERCEL_OIDC_TOKEN，以及 Turborepo 和 Nx 的 TURBO_* / NX_DAEMON。
#
# 第一版没有滤掉它们，45 条真变量抄成了 81 条。后果不是「多几条没用的」：
#   VERCEL_OIDC_TOKEN 是分钟级的短时效令牌，抄过去就被冻成了一个静态的死值；
#   VERCEL_ENV / VERCEL_TARGET_ENV / VERCEL 会盖掉 Vercel 在新项目里注入的
#   真值，于是新项目以为自己是源项目的那次构建。
# 这些都不会报错，只会在以后某个时刻安静地做错事。
SYSTEM_PREFIXES="VERCEL_ NX_ TURBO_"
SYSTEM_EXACT="VERCEL"

is_system() {
  case " $SYSTEM_EXACT " in *" $1 "*) return 0;; esac
  for pre in $SYSTEM_PREFIXES; do
    case "$1" in "$pre"*) return 0;; esac
  done
  return 1
}

TOKEN_FILE="$HOME/Library/Application Support/com.vercel.cli/auth.json"
[ -f "$TOKEN_FILE" ] || TOKEN_FILE="$HOME/.local/share/com.vercel.cli/auth.json"
if [ ! -f "$TOKEN_FILE" ]; then
  echo "✗ 找不到 Vercel 登录信息，先跑 vercel login"
  exit 1
fi
VT=$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))['token'])" "$TOKEN_FILE")
TEAM=$(python3 -c "import json;print(json.load(open('.vercel/project.json'))['orgId'])" 2>/dev/null || true)
[ -n "$TEAM" ] || { echo "✗ .vercel/project.json 里读不到 orgId"; exit 1; }

umask 077
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM

echo ""
echo "从 $SRC 复制到 $DST"
echo ""

copied=0; skipped=0; sysskip=0; empty=""

for ENVIRONMENT in production preview; do
  echo "── $ENVIRONMENT ──"
  vercel env pull "$WORK/$ENVIRONMENT.env" \
    --environment="$ENVIRONMENT" --yes >/dev/null 2>&1 || {
      echo "  ✗ 拉不下来（当前目录要链接到 $SRC：vercel link）"; exit 1; }

  while IFS= read -r line; do
    case "$line" in ''|\#*) continue;; esac
    key="${line%%=*}"
    val="${line#*=}"
    # vercel env pull 写的是 KEY="value"，去掉外层引号
    val="${val%\"}"; val="${val#\"}"

    if is_system "$key"; then sysskip=$((sysskip+1)); continue; fi
    case " $SKIP_KEYS " in *" $key "*) echo "  － 跳过 $key"; skipped=$((skipped+1)); continue;; esac
    if [ -z "$val" ]; then empty="$empty $key"; continue; fi

    # 值只经过管道，不出现在命令行参数或屏幕上
    body=$(KEY="$key" VAL="$val" TGT="$ENVIRONMENT" python3 -c '
import json, os
print(json.dumps([{ "key": os.environ["KEY"], "value": os.environ["VAL"],
                    "type": "encrypted", "target": [os.environ["TGT"]] }]))')
    out=$(printf '%s' "$body" | curl -s -X POST \
      -H "Authorization: Bearer $VT" -H "Content-Type: application/json" \
      --data-binary @- "https://api.vercel.com/v10/projects/$DST/env?teamId=$TEAM")
    if printf '%s' "$out" | grep -q '"failed":\[\]' || printf '%s' "$out" | grep -q '"created"'; then
      echo "  ✓ $key"; copied=$((copied+1))
    else
      reason=$(printf '%s' "$out" | python3 -c '
import json,sys
d=json.load(sys.stdin)
f=d.get("failed") or []
print(f[0].get("error",{}).get("message","?") if f else d.get("error",{}).get("message","?"))' 2>/dev/null || echo "?")
      echo "  ✗ $key  —— $reason"
    fi
  done < "$WORK/$ENVIRONMENT.env"
done

echo ""
echo "复制 $copied 条，按规则跳过 $skipped 条，Vercel 自己的系统变量跳过 $sysskip 条"
if [ -n "$empty" ]; then
  echo ""
  echo "读不回值、需要到后台另行设置的（Vercel 的 sensitive 类型按设计就读不出来）："
  for k in $empty; do echo "   $k"; done
fi
echo ""
