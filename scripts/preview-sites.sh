#!/usr/bin/env bash
#
# 同时起中文站和英文站，用来肉眼比对多语言改造的效果。
#
#   中文  http://localhost:4020
#   英文  http://localhost:4021
#
# 两个实例必须用不同的构建目录，否则会抢同一个 .next 并互相覆盖。
# next.config.ts 读 NEXT_DIST_DIR，本来就为这种情况留了口子。
#
#   npm run preview          起两个
#   npm run preview -- stop  停掉
#
# 日志在 /tmp/quitccp-preview-{zh,en}.log。关掉终端它们也会继续跑。
# 要停就用 stop，不要去 pkill "next dev" —— 那会把两个一起杀掉。

set -u
cd "$(dirname "$0")/.."

ZH_LOG=/tmp/quitccp-preview-zh.log
EN_LOG=/tmp/quitccp-preview-en.log

stop_ports() {
  # 只停这两个端口上的，不碰机器上别的 next 进程
  local port pid
  for port in 4020 4021; do
    pid=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      kill $pid 2>/dev/null || true
      echo "  停掉 :$port"
    fi
  done
}

if [ "${1:-}" = "stop" ]; then
  echo "停掉预览站："
  stop_ports
  exit 0
fi

echo "先停掉已有的，免得端口占着起不来："
stop_ports
sleep 1

echo ""
echo "启动中（首次编译要几十秒）…"
( cd apps/web && NODE_OPTIONS=--max-http-header-size=65536 \
    nohup npx next dev -p 4020 > "$ZH_LOG" 2>&1 & )
( cd apps/web && SITE_LOCALE=en NEXT_DIST_DIR=.next-en NODE_OPTIONS=--max-http-header-size=65536 \
    nohup npx next dev -p 4021 > "$EN_LOG" 2>&1 & )

# 等两个都答应了再报成功。过早说「好了」，人打开一个还没起来的页面，
# 只会以为是坏的。
zh=""
en=""
for _ in $(seq 1 60); do
  zh=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:4020/ 2>/dev/null || echo 000)
  en=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://localhost:4021/ 2>/dev/null || echo 000)
  if [ "$zh" = "200" ] && [ "$en" = "200" ]; then break; fi
  sleep 2
done

echo ""
if [ "$zh" = "200" ] && [ "$en" = "200" ]; then
  echo "  ✓ 中文  http://localhost:4020"
  echo "  ✓ 英文  http://localhost:4021"
  echo ""
  echo "  停：npm run preview -- stop"
else
  echo "  ✗ 中文 $zh   英文 $en"
  echo "  日志：$ZH_LOG"
  echo "       $EN_LOG"
  tail -8 "$EN_LOG"
  exit 1
fi
