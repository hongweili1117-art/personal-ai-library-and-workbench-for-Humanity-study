#!/bin/bash
# 个人 AI 智库 · 一键打包 (macOS)
# 双击运行；若提示"无法打开"，请右键 → 打开。
cd "$(dirname "$0")" || exit 1

if [ -x ".venv/bin/python" ]; then
  PYRUN=".venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYRUN="python3"
else
  echo "[×] 没找到 Python3。请先双击\"一键安装_Mac.command\"完成安装。"
  read -n 1 -s -r -p "按任意键退出…"
  exit 1
fi

echo "============================================================"
echo "  正在把程序打包成\"免安装版\"（连 Python 一起打包）……"
echo "  朋友拿到后无需再装 Python、无需联网、无需等待安装。"
echo "  第一次打包可能要几分钟，请耐心等、别关窗口。"
echo "============================================================"
echo

"$PYRUN" build_exe.py

echo
read -n 1 -s -r -p "打包结束，按任意键退出…"
