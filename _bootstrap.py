# -*- coding: utf-8 -*-
"""
兼容入口：旧版打包/脚本可能仍指向本文件。现在统一委托给 desktop.py，
即「后台起服务器 + 弹独立窗口/浏览器」的无黑框启动方式。
正式打包入口已是 desktop.py（见 app.spec），本文件仅作向后兼容。
"""
import desktop

if __name__ == "__main__":
    desktop.main()
