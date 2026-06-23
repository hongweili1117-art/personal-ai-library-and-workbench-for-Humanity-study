# -*- coding: utf-8 -*-
"""
外置 OCR 脚本 —— 把「整本扫描 PDF」转成「可读 PDF」（带透明文字层），全程不用 AI。

这是和内置视觉 OCR 互补的另一半：
  · 内置（vision_ocr.py）：阅读时框选单张图，用 AI 看懂它。
  · 外置（本文件）       ：整本扫描书一次性转换，用传统 OCR，免费、本地、不联网。

转换后的新 PDF 外观和原来一模一样，但底下多了一层看不见、却能选中/复制/搜索的文字，
可以直接拖进你的工作台当普通 PDF 用。

依赖：
  1) pip install ocrmypdf
  2) 系统需安装 Tesseract（含语言包）和 Ghostscript：
       macOS:   brew install tesseract tesseract-lang ghostscript
       Ubuntu:  sudo apt install tesseract-ocr tesseract-ocr-deu tesseract-ocr-chi-sim ghostscript
       Windows: 安装 Tesseract 官方包 + Ghostscript，并把它们加入 PATH

用法：
    python ocr_pdf.py 输入.pdf 输出.pdf
    python ocr_pdf.py 输入.pdf 输出.pdf deu+chi_sim+eng     # 自定义语言
"""

import sys
import subprocess


def ocr(input_pdf: str, output_pdf: str, lang: str = "deu+chi_sim+eng"):
    """
    lang：要识别的语言，用 + 连接。常用代码：
          deu=德文, chi_sim=简体中文, eng=英文, ita=意大利文, fra=法文
          （每种语言都要先装好对应的 Tesseract 语言包）
    """
    cmd = [
        "ocrmypdf",
        "-l", lang,
        "--deskew",          # 自动纠偏（扫描歪了会摆正）
        "--rotate-pages",    # 自动把倒置/侧放的页面转正
        "--skip-text",       # 已经有文字层的页面跳过，不重复处理
        input_pdf,
        output_pdf,
    ]
    print("开始识别（厚书可能需要几分钟，请耐心等待）……")
    subprocess.run(cmd, check=True)
    print("✅ 完成：", output_pdf)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python ocr_pdf.py 输入.pdf 输出.pdf [语言]")
        print("示例: python ocr_pdf.py book_scan.pdf book_readable.pdf deu+chi_sim+eng")
        sys.exit(1)

    in_pdf = sys.argv[1]
    out_pdf = sys.argv[2]
    language = sys.argv[3] if len(sys.argv) > 3 else "deu+chi_sim+eng"
    ocr(in_pdf, out_pdf, language)
