@echo off
chcp 65001 >nul
title 个人 AI 智库 · 一键打包
cd /d "%~dp0"

REM 优先用安装时创建的独立环境；找不到则退回系统 Python
set "PYRUN="
if exist ".venv\Scripts\python.exe" (
  set "PYRUN=.venv\Scripts\python.exe"
) else (
  where py >nul 2>nul && set "PYRUN=py -3"
  if not defined PYRUN (
    where python >nul 2>nul && set "PYRUN=python"
  )
)
if not defined PYRUN (
  echo [×] 没找到 Python。请先双击"一键安装_Windows.bat"完成安装。
  pause
  exit /b 1
)

echo ============================================================
echo   正在把程序打包成"免安装版"（连 Python 一起打包）……
echo   朋友拿到后无需再装 Python、无需联网、无需等待安装。
echo   第一次打包可能要几分钟，请耐心等、别关窗口。
echo ============================================================
echo.

%PYRUN% build_exe.py

echo.
echo （打包结束。产物与可直接发送的压缩包就在本文件夹里。）
pause
