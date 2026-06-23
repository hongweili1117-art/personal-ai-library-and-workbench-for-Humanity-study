# -*- coding: utf-8 -*-
"""
一键打包：把本程序连同 Python 运行环境一起打成“免安装”独立程序，
朋友拿到后**无需装 Python、无需联网、无需等待一键安装**，直接双击即可运行。

【在哪运行】
    在你自己电脑上、已经能正常运行本程序的环境里执行即可：
      · Windows：双击  一键打包_Windows.bat   （推荐）
                或在命令行执行：  python build_exe.py
      · macOS：  双击  一键打包_Mac.command    （推荐）
                或在终端执行：    python3 build_exe.py

【会得到什么】
    打包完成后会在 dist 文件夹生成一个“个人AI智库”文件夹，并自动压缩成一个
    可直接发送的压缩包（个人AI智库_可直接运行_Windows.zip / _macOS.zip）。
    把这个压缩包发给朋友，对方解压后：
      · Windows：双击里面的  个人AI智库.exe
      · macOS：  双击里面的  双击启动.command（首次若提示无法打开，右键→打开）
    即可使用，全程不用装任何东西。

【一个必须知道的限制】
    打包产物只适用于“你当前的操作系统”。在 Windows 上打包得到的是 Windows 版，
    只能发给用 Windows 的朋友；在 Mac 上打包得到 Mac 版，发给用 Mac 的朋友。
    （这是所有同类工具的通用限制，无法用一个包同时通吃两个系统。）
    要给不同系统的朋友，就分别在对应系统上各打包一次。
"""
import os
import sys
import shutil
import subprocess
import platform

APP_NAME = "个人AI智库"


def ensure_pyinstaller():
    try:
        import PyInstaller  # noqa: F401
        return True
    except Exception:
        print("[..] 未检测到 PyInstaller，正在安装（需联网，仅这一次）...")
        r = subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"])
        if r.returncode != 0:
            return False
        try:
            import PyInstaller  # noqa: F401
            return True
        except Exception:
            return False


def check_deps():
    """打包前确认核心依赖已在当前 Python 里装好，否则产物会缺东西。"""
    missing = []
    for mod in ("flask", "fitz", "numpy"):
        try:
            __import__(mod)
        except Exception:
            missing.append("PyMuPDF" if mod == "fitz" else mod)
    return missing


def write_friend_readme(dest_dir, is_mac):
    how = ("双击  双击启动.command\n      （首次若提示“无法打开”，在文件上点右键 →“打开”；\n        或打开“终端”执行一次： xattr -dr com.apple.quarantine . ）"
           if is_mac else "双击  个人AI智库.exe")
    text = f"""个人 AI 智库 · 免安装版（无需安装 Python，无需联网即可启动）
============================================================

【怎么启动】
  {how}

  启动后会弹出「个人 AI 智库」程序窗口（如果打包时带上了 pywebview）。
  若没有该组件，则会用系统默认浏览器打开界面，并附带一个very小的「运行中 / 退出」窗口。
  想关掉程序：直接关闭程序窗口即可（用浏览器方式时，点那个小窗里的“退出程序”）。
  —— 全程没有黑色命令行窗口，关掉它也不会再出现「fail to fetch」。

【第一次使用，填一次 AI 钥匙】
  点页面右上角“设置”，选一个 AI 引擎并填入对应的 API Key
  （DeepSeek / OpenAI / Z.ai / Claude 任选其一）。
  “免费”档只能翻译，其它 AI 功能需要上面任选一个引擎。
  钥匙只存在本机，不会外传。

【你的数据存在哪】
  程序文件夹里的 data 文件夹（PDF、笔记、分析都在本机，不上传任何服务器）。

【遇到问题】
  · 窗口/浏览器没自动打开：稍等几秒；若仍没有，把程序文件夹里 data/logs 的日志发给分享者。
  · 启动没反应 / 报错：错误信息已写入程序文件夹的 data/logs，把它发给分享者排查即可。
"""
    try:
        with open(os.path.join(dest_dir, "给朋友看的说明.txt"), "w", encoding="utf-8") as f:
            f.write(text)
    except Exception as e:
        print("[!] 写入说明文件失败（不影响运行）：", e)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    os.chdir(here)

    osname = platform.system()  # 'Windows' / 'Darwin' / 'Linux'
    is_win = osname == "Windows"
    is_mac = osname == "Darwin"
    plat_label = "Windows" if is_win else ("macOS" if is_mac else "Linux")

    print("=" * 60)
    print(f"  个人 AI 智库 · 一键打包（当前系统：{plat_label}）")
    print("=" * 60)

    if not os.path.isfile("app.spec"):
        print("[×] 找不到 app.spec，请确认在程序文件夹内运行本脚本。")
        sys.exit(1)

    missing = check_deps()
    if missing:
        print("[×] 以下核心组件尚未安装，请先完成一次安装再打包：")
        print("    缺少：", "、".join(missing))
        print("    解决：先双击“一键安装”脚本，或执行  pip install -r requirements.txt")
        sys.exit(1)

    if not (os.path.isfile(os.path.join("lib", "pdf.min.js")) and
            os.path.isfile(os.path.join("lib", "pdf.worker.min.js"))):
        print("[!] 警告：未发现 lib/pdf.min.js 或 lib/pdf.worker.min.js。")
        print("    打包仍会继续，但朋友离线时可能无法显示 PDF。建议补回 lib 文件夹后重打包。")

    if not ensure_pyinstaller():
        print("[×] PyInstaller 安装失败（可能是网络问题）。")
        sys.exit(1)

    print("[..] 开始打包，第一次可能需要几分钟，请耐心等待、不要关窗口……")
    r = subprocess.run([sys.executable, "-m", "PyInstaller", "--clean", "--noconfirm", "app.spec"])
    if r.returncode != 0:
        print("[×] 打包失败，请把上方报错发给作者排查。")
        sys.exit(1)

    dist_dir = os.path.join(here, "dist", APP_NAME)
    if not os.path.isdir(dist_dir):
        print("[×] 没找到打包产物文件夹：", dist_dir)
        sys.exit(1)

    # 附带：给朋友的说明 + （Mac）双击启动入口
    write_friend_readme(dist_dir, is_mac)
    if is_mac:
        exe_path = os.path.join(dist_dir, APP_NAME)
        try:
            os.chmod(exe_path, 0o755)
        except Exception:
            pass
        launcher = os.path.join(dist_dir, "双击启动.command")
        with open(launcher, "w", encoding="utf-8") as f:
            f.write('#!/bin/bash\ncd "$(dirname "$0")" || exit 1\n"./%s"\n' % APP_NAME)
        try:
            os.chmod(launcher, 0o755)
        except Exception:
            pass

    # 自动压缩成可直接发送的压缩包
    zip_base = os.path.join(here, f"{APP_NAME}_可直接运行_{plat_label}")
    print("[..] 正在压缩成可发送的压缩包……")
    archive = None
    try:
        archive = shutil.make_archive(zip_base, "zip", root_dir=os.path.join(here, "dist"), base_dir=APP_NAME)
    except Exception as e:
        print("[!] 自动压缩失败（不影响使用，可手动压缩 dist 里的文件夹）：", e)

    print()
    print("[√] 打包完成！")
    print("    免安装程序文件夹： dist/%s/" % APP_NAME)
    if archive:
        print("    可直接发送的压缩包： %s" % os.path.basename(archive))
        print("    —— 把这个压缩包发给朋友即可，对方解压后：")
        if is_win:
            print("       双击其中的  个人AI智库.exe")
        elif is_mac:
            print("       双击其中的  双击启动.command（首次右键→打开）")
        else:
            print("       运行其中的  个人AI智库  可执行文件")
    print()
    print("    提醒：本产物只适用于 %s。给别的系统的朋友，请在对应系统上各打包一次。" % plat_label)


if __name__ == "__main__":
    main()
