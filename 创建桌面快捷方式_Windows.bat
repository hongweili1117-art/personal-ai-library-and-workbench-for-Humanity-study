@echo off
chcp 65001 >nul
cd /d "%~dp0"
REM 在桌面创建一个指向「无黑框启动」的快捷方式，双击即开，省得每次进文件夹。
set "TARGET=%~dp0启动_Windows_无黑框.vbs"
set "PS=$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\个人AI智库.lnk');$s.TargetPath='%TARGET%';$s.WorkingDirectory='%~dp0';$s.Save()"
powershell -NoProfile -Command "%PS%"
echo [√] 已在桌面创建快捷方式「个人AI智库」。以后双击它即可启动（无黑框）。
pause
