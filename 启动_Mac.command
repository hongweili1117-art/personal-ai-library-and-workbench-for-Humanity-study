#!/bin/bash
# 双击启动「个人 AI 智库」。装了 pywebview 会弹出独立窗口；否则用默认浏览器 + 退出小窗。
cd "$(dirname "$0")" || exit 1
if [ -x ".venv/bin/python3" ]; then PY=".venv/bin/python3"; else PY="python3"; fi
# 后台启动：关掉这个终端也不影响程序运行
nohup "$PY" desktop.py >/dev/null 2>&1 &
sleep 1
exit 0
