@echo off
chcp 65001 >nul
title 个人 AI 智库 · 冒烟测试
cd /d "%~dp0"

set "PYRUN="
if exist ".venv\Scripts\python.exe" (
  set "PYRUN=.venv\Scripts\python.exe"
) else (
  where python >nul 2>nul && set "PYRUN=python"
)
if not defined PYRUN (
  echo [×] 没找到 Python，请先双击「一键安装_Windows.bat」
  pause & exit /b 1
)

%PYRUN% smoke_test.py
pause
