# -*- coding: utf-8 -*-
"""
个人 AI 智库 · 桌面启动器（无黑框版）
================================================================
解决的问题：
  以前是用 `python app.py` 在命令行（黑色窗口）里跑服务器，一旦把那个黑框关掉，
  服务器就停了，网页上所有功能都会「fail to fetch」。

这个启动器改成「桌面应用」的方式运行，全程不依赖黑框：
  1) 在后台线程里启动本地服务器（优先用 waitress，更稳、支持流式/多请求并发）；
  2) 自动挑一个空闲端口，避免「端口被占用」导致启动失败；
  3) 打开界面：
       · 如果装了 pywebview → 直接弹出一个独立的程序窗口（最像 App，关闭窗口即退出）；
       · 否则 → 用系统默认浏览器打开，并额外弹出一个very小的「运行中 / 退出」控制窗口
         （tkinter，Python 自带），这样你随时能一键退出，依然没有黑框；
       · 万一两者都不可用 → 仍会打开浏览器并保持后台运行（此时需在任务管理器结束进程）。

普通源码运行：双击「启动_Windows.bat」/「启动_Mac.command」即可（它们用 pythonw 启动，没有黑框）。
PyInstaller 打包：本文件即打包入口（app.spec 已指向它，且 console=False）。
"""
import os
import sys
import time
import socket
import threading
import webbrowser
from pathlib import Path

# —— 冻结态（PyInstaller 打包后）：把数据目录固定到 exe 所在文件夹，而不是临时解包目录 ——
if getattr(sys, "frozen", False):
    exe_dir = Path(sys.executable).parent
    os.environ.setdefault("APW_BASE_DIR", str(exe_dir))
    try:
        os.chdir(exe_dir)
    except Exception:
        pass

def _ensure_console_streams():
    """pythonw.exe / 打包后（console=False）运行时 sys.stdout/stderr 为 None，
    届时任何 print() 都会抛 AttributeError，使无黑框启动器「静默崩溃」——表现就是
    双击没反应、后台也没起来。这里把它们重定向到 data/logs/launcher.log，
    既不会崩，又能在出问题时查日志。"""
    for name in ("stdout", "stderr"):
        if getattr(sys, name, None) is None:
            try:
                base = Path(os.environ.get("APW_BASE_DIR") or
                            (Path(sys.executable).parent if getattr(sys, "frozen", False)
                             else Path(__file__).resolve().parent))
                logdir = base / "data" / "logs"
                logdir.mkdir(parents=True, exist_ok=True)
                setattr(sys, name, open(logdir / "launcher.log", "a",
                                        encoding="utf-8", buffering=1))
            except Exception:
                try:
                    setattr(sys, name, open(os.devnull, "w"))
                except Exception:
                    pass


_ensure_console_streams()

HOST = "127.0.0.1"
APP_TITLE = "个人 AI 智库"


def _pick_port(preferred=5000):
    """优先用 5000；被占用就让系统分配一个空闲端口。"""
    for port in (preferred,):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind((HOST, port))
                return port
            except OSError:
                pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]


def _wait_until_up(port, timeout=12.0):
    """等服务器真正起来（避免窗口/浏览器打开时还连不上）。"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.4)
            try:
                s.connect((HOST, port))
                return True
            except OSError:
                time.sleep(0.15)
    return False


def _serve(app_obj, port):
    """后台线程里跑 WSGI 服务器：优先 waitress，回退到 werkzeug（都开多线程，保证流式输出可用）。"""
    try:
        from waitress import serve  # 生产级、稳定、默认多线程
        serve(app_obj, host=HOST, port=port, threads=8, _quiet=True)
        return
    except Exception:
        pass
    try:
        from werkzeug.serving import make_server
        srv = make_server(HOST, port, app_obj, threaded=True)
        srv.serve_forever()
        return
    except Exception:
        # 最后兜底：Flask 自带开发服务器（也开线程）
        app_obj.run(host=HOST, port=port, debug=False, use_reloader=False, threaded=True)


def _open_in_webview(url):
    """优先：独立程序窗口（pywebview）。返回 True 表示已用窗口接管（关闭窗口即退出）。"""
    try:
        import webview  # pywebview
    except Exception:
        return False
    try:
        webview.create_window(APP_TITLE, url, width=1280, height=860, min_size=(900, 600))
        webview.start()   # 阻塞，直到窗口被关闭
        return True
    except Exception:
        return False


def _open_in_browser_with_control(url):
    """回退：系统浏览器 + 一个very小的控制窗口（tkinter，自带），随时一键退出。"""
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        import tkinter as tk
    except Exception:
        return False
    try:
        root = tk.Tk()
        root.title(APP_TITLE)
        try:
            root.geometry("360x150")
            root.resizable(False, False)
        except Exception:
            pass
        tk.Label(root, text="个人 AI 智库 · 正在运行", font=("", 13, "bold")).pack(pady=(16, 4))
        tk.Label(root, text=url, fg="#666").pack()
        btns = tk.Frame(root)
        btns.pack(pady=14)
        tk.Button(btns, text="在浏览器中重新打开",
                  command=lambda: webbrowser.open(url)).pack(side="left", padx=6)

        def quit_app():
            try:
                root.destroy()
            finally:
                os._exit(0)

        tk.Button(btns, text="退出程序", command=quit_app).pack(side="left", padx=6)
        root.protocol("WM_DELETE_WINDOW", quit_app)
        root.mainloop()
        return True
    except Exception:
        return False


def main():
    # 导入即完成主工作台 + AI 智库的全部路由注册
    import app as _app

    port = _pick_port(5000)
    url = "http://%s:%d" % (HOST, port)

    t = threading.Thread(target=_serve, args=(_app.app, port), daemon=True)
    t.start()
    _wait_until_up(port)

    print("界面地址：", url)

    # 1) 独立程序窗口（最佳体验）
    if _open_in_webview(url):
        os._exit(0)
    # 2) 浏览器 + 退出控制窗（仍无黑框）
    if _open_in_browser_with_control(url):
        os._exit(0)
    # 3) 兜底：仅浏览器，后台常驻（主线程阻塞，保持进程存活）
    try:
        webbrowser.open(url)
    except Exception:
        pass
    while True:
        time.sleep(3600)


if __name__ == "__main__":
    main()
