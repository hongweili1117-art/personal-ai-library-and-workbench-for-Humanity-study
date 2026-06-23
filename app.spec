# -*- mode: python ; coding: utf-8 -*-
# PyInstaller 打包配置 —— 在 Windows / macOS 上执行： pyinstaller app.spec
# 产物：dist/个人AI智库/个人AI智库(.exe)，onedir 模式（启动快、PyMuPDF 兼容性好）。
#
# 关键改动（无黑框版）：
#   · 打包入口改为 desktop.py（后台起服务器 + 弹独立窗口/浏览器，全程不依赖命令行）。
#   · console=False —— 不再弹出黑色命令行窗口（这正是「关掉黑框就 fail to fetch」的根源）。
#   · 不再 exclude tkinter —— 没装 pywebview 时，退出控制小窗要用到它（Python 自带）。
#   · 尽量把 waitress / pywebview 一并收进去（没装也不影响打包，运行时会自动回退）。

from PyInstaller.utils.hooks import collect_all
import os

datas = []
binaries = []

# 内置离线 PDF 引擎，避免打包后仍去连外部 CDN 出现 "Failed to fetch"。
for _f in ("pdf.min.js", "pdf.worker.min.js"):
    _p = os.path.join("lib", _f)
    if os.path.isfile(_p):
        datas.append((_p, "lib"))

# 前端静态资源（已从 app.py 外移到 web/，打包时必须一起带上，否则 exe 找不到界面）。
for _wf in ("index.html", "style.css", "app.js"):
    _wp = os.path.join("web", _wf)
    if os.path.isfile(_wp):
        datas.append((_wp, "web"))

hiddenimports = [
    # 运行时按需 import 的第三方库
    "fitz", "pymupdf", "numpy", "openai", "anthropic",
    # 本地服务器 / 桌面窗口（装了才收；没装运行时自动回退到浏览器+tkinter）
    "waitress", "webview",
    # 可选：装了才需要；没装可忽略
    # "chromadb", "fastembed", "docx",
]

for pkg in ("fitz", "pymupdf", "numpy", "openai", "anthropic", "waitress", "webview"):
    try:
        d, b, h = collect_all(pkg)
        datas += d; binaries += b; hiddenimports += h
    except Exception:
        pass

block_cipher = None

a = Analysis(
    ["desktop.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["matplotlib", "PyQt5", "PySide2"],   # 保留 tkinter（退出控制小窗需要）
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="个人AI智库",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,         # ★ 不弹黑色命令行窗口
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="个人AI智库",
)
