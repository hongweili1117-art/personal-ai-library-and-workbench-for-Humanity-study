' 双击本文件：完全无黑框、无闪窗地启动「个人 AI 智库」
' （推荐把它发送到桌面快捷方式，或固定到任务栏。）
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh  = CreateObject("WScript.Shell")
base = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = base
pyw = base & "\.venv\Scripts\pythonw.exe"
If Not fso.FileExists(pyw) Then pyw = "pythonw"
' 第二参数 0 = 隐藏窗口；第三参数 False = 不等待
sh.Run """" & pyw & """ """ & base & "\desktop.py""", 0, False
