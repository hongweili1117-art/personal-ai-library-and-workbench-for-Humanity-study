@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 个人 AI 智库 · 一键安装 (Windows)
cd /d "%~dp0"

echo ============================================================
echo            个人 AI 智库 · 一键安装程序 (Windows)
echo ============================================================
echo.
echo  本脚本会自动完成：
echo    1) 检测 Python
echo    2) 在本文件夹内创建独立运行环境 (.venv)
echo    3) 安装所需组件（含无黑框桌面窗口所需的 waitress / pywebview）
echo    4) 在桌面创建快捷方式（指向「无黑框」启动方式）
echo    5) 启动程序
echo.
echo  全程联网下载组件，第一次安装可能需要几分钟，请耐心等待。
echo ------------------------------------------------------------
echo.

REM ---------- 1. 找 Python ----------
set "PYEXE="
where py >nul 2>nul && set "PYEXE=py -3"
if not defined PYEXE (
  where python >nul 2>nul && set "PYEXE=python"
)
if not defined PYEXE (
  echo [×] 没有检测到 Python。
  echo.
  echo     请先安装 Python 3.10 或更高版本：
  echo         https://www.python.org/downloads/windows/
  echo     安装时请务必勾选 "Add Python to PATH"。
  echo     装好后重新双击本脚本即可。
  echo.
  pause
  exit /b 1
)
echo [√] 已找到 Python： %PYEXE%
%PYEXE% --version
echo.

REM ---------- 2. 创建虚拟环境 ----------
if exist ".venv\Scripts\python.exe" (
  echo [√] 已存在运行环境 .venv，跳过创建。
) else (
  echo [..] 正在创建独立运行环境 .venv ...
  %PYEXE% -m venv .venv
  if errorlevel 1 (
    echo [×] 创建虚拟环境失败。请确认 Python 安装完整。
    pause
    exit /b 1
  )
  echo [√] 运行环境创建完成。
)
set "VENV_PY=.venv\Scripts\python.exe"
echo.

REM ---------- 3. 安装依赖 ----------
echo [..] 正在升级 pip ...
"%VENV_PY%" -m pip install --upgrade pip >nul 2>nul
echo [..] 正在安装所需组件（Flask / PyMuPDF / numpy / openai / anthropic / waitress / pywebview）...
echo      —— 这一步最耗时，请勿关闭窗口。
"%VENV_PY%" -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo [×] 组件安装失败，可能是网络问题。
  echo     可尝试使用国内镜像后重试，例如：
  echo         "%VENV_PY%" -m pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
  echo.
  pause
  exit /b 1
)
echo [√] 所有组件安装完成。
echo.

REM ---------- 4. 创建桌面快捷方式（指向无黑框 VBS 启动器） ----------
echo [..] 正在创建桌面快捷方式 ...
set "LAUNCHER=%~dp0启动_Windows_无黑框.vbs"
powershell -NoProfile -Command ^
  "$s=(New-Object -COM WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\个人AI智库.lnk');" ^
  "$s.TargetPath='%LAUNCHER%';" ^
  "$s.WorkingDirectory='%~dp0';" ^
  "$s.IconLocation='%SystemRoot%\System32\shell32.dll,13';" ^
  "$s.Description='个人 AI 智库';" ^
  "$s.Save()" >nul 2>nul
if exist "%USERPROFILE%\Desktop\个人AI智库.lnk" (
  echo [√] 已在桌面创建快捷方式：个人AI智库（双击即开，无黑框）
) else (
  echo [!] 快捷方式创建未成功（不影响使用）。以后可直接双击"启动_Windows_无黑框.vbs"。
)
echo.

echo ============================================================
echo   安装完成！正在为你启动……
echo   以后启动有两种方式：
echo     · 双击桌面的"个人AI智库"快捷方式（推荐，无黑框）
echo     · 或双击本文件夹里的"启动_Windows_无黑框.vbs"
echo ============================================================
echo.
timeout /t 2 >nul

REM ---------- 5. 启动（无黑框） ----------
start "" "%~dp0启动_Windows_无黑框.vbs"
exit /b 0
