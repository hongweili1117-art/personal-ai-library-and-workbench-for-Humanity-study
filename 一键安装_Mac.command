#!/bin/bash
# 个人 AI 智库 · 一键安装 (macOS)
# 双击运行；若提示"无法打开"，请右键 → 打开，或先执行 chmod +x 本文件。

cd "$(dirname "$0")" || exit 1

echo "============================================================"
echo "          个人 AI 智库 · 一键安装程序 (macOS)"
echo "============================================================"
echo
echo "  本脚本会自动："
echo "    1) 检测 Python3"
echo "    2) 在本文件夹内创建独立运行环境 (.venv)"
echo "    3) 安装所需组件"
echo "    4) 启动程序"
echo
echo "  第一次安装需联网下载组件，可能要几分钟，请耐心等待。"
echo "------------------------------------------------------------"
echo

# ---------- 1. 找 python3 ----------
PYEXE=""
if command -v python3 >/dev/null 2>&1; then
  PYEXE="python3"
fi
if [ -z "$PYEXE" ]; then
  echo "[×] 没有检测到 python3。"
  echo
  echo "    安装方式任选其一："
  echo "      · 官网下载：https://www.python.org/downloads/macos/"
  echo "      · 或在终端执行：xcode-select --install"
  echo "      · 或用 Homebrew：brew install python"
  echo "    装好后重新双击本脚本即可。"
  echo
  read -n 1 -s -r -p "按任意键退出…"
  exit 1
fi
echo "[√] 已找到 Python： $($PYEXE --version 2>&1)"
echo

# ---------- 2. 创建虚拟环境 ----------
if [ -x ".venv/bin/python" ]; then
  echo "[√] 已存在运行环境 .venv，跳过创建。"
else
  echo "[..] 正在创建独立运行环境 .venv ..."
  "$PYEXE" -m venv .venv || { echo "[×] 创建虚拟环境失败。"; read -n 1 -s -r -p "按任意键退出…"; exit 1; }
  echo "[√] 运行环境创建完成。"
fi
VENV_PY=".venv/bin/python"
echo

# ---------- 3. 安装依赖 ----------
echo "[..] 正在升级 pip ..."
"$VENV_PY" -m pip install --upgrade pip >/dev/null 2>&1
echo "[..] 正在安装所需组件（Flask / PyMuPDF / numpy / openai / anthropic / waitress / pywebview）..."
echo "     —— 这一步最耗时，请勿关闭窗口。"
if ! "$VENV_PY" -m pip install -r requirements.txt; then
  echo
  echo "[×] 组件安装失败，可能是网络问题。可尝试国内镜像后重试："
  echo "      \"$VENV_PY\" -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple"
  echo
  read -n 1 -s -r -p "按任意键退出…"
  exit 1
fi
echo "[√] 所有组件安装完成。"
echo

# 给启动脚本加上可执行权限
chmod +x "启动_Mac.command" 2>/dev/null

echo "============================================================"
echo "  安装完成！正在为你启动……"
echo "  以后启动：双击本文件夹里的「启动_Mac.command」"
echo "  （装了 pywebview 会弹出独立程序窗口；否则用默认浏览器 + 一个退出小窗，都不依赖终端黑框）"
echo "============================================================"
echo
sleep 2

# ---------- 4. 启动（后台，无需保留终端） ----------
nohup "$VENV_PY" desktop.py >/dev/null 2>&1 &
sleep 1
exit 0
