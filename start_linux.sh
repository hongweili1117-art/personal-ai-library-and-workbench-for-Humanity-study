#!/bin/bash
# 启动「个人 AI 智库」（Linux）。装了 pywebview 弹独立窗口；否则用浏览器 + 退出小窗。
cd "$(dirname "$0")" || exit 1
if [ -x ".venv/bin/python3" ]; then PY=".venv/bin/python3"; else PY="python3"; fi
nohup "$PY" desktop.py >/dev/null 2>&1 &
sleep 1
exit 0
