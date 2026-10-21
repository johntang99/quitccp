#!/usr/bin/env bash
#
# 跑 src 下所有的单元测试。
#
# 为什么不直接写 `tsx --test src/**/*.test.ts`：
# npm 脚本跑在 sh 里，sh 没有 globstar，`**` 只当一层目录用。那条命令在
# 七个测试文件里只跑到四个 —— i18n 表同步、转写、日期前缀三个从来没执行过，
# 而 `npm test` 照样是绿的。一个不跑的测试比没有测试更糟：它让人以为那块
# 地方有人看着。
#
# 为什么不写 `tsx --test src`（让 node 自己递归发现）：
# tsx 会把目录名当成要导入的模块，报 ERR_UNSUPPORTED_DIR_IMPORT。
#
# 所以用 find。它跟目录有多深无关，加一层子目录不需要改这里。
set -euo pipefail
cd "$(dirname "$0")/.."

files=$(find src -name '*.test.ts' | sort)
if [ -z "$files" ]; then
  echo "src 下没有找到任何 *.test.ts —— 这本身就不对" >&2
  exit 1
fi

echo "跑 $(echo "$files" | wc -l | tr -d ' ') 个测试文件"
# shellcheck disable=SC2086
exec npx tsx --test $files
