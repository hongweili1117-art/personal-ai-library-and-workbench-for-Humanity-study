@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM 用 pythonw 启动（无命令行黑框）。优先用安装时创建的独立环境。
set "PYW="
if exist ".venv\Scripts\pythonw.exe" set "PYW=.venv\Scripts\pythonw.exe"
if not defined PYW (
  where pythonw >nul 2>nul && set "PYW=pythonw"
)
if not defined PYW (
  REM 实在找不到 pythonw 就退回 python（可能有黑框，但仍能用）
  if exist ".venv\Scripts\python.exe" (set "PYW=.venv\Scripts\python.exe") else (set "PYW=python")
)

start "" %PYW% desktop.py
exit
