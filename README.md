# 个人 AI 智库

一个**本地运行**的学术精读工作台：Flask 后端 + 原生 JS/PDF.js 前端，浏览器界面。  
面向人文社科（批判理论、政治哲学、法学、政治经济学）的德 / 中 / 英文献精读。  
所有 AI 调用走你自己的第三方 API Key，数据全部留在本机。

## 功能

- PDF 阅读与标注（荧光笔、橡皮擦）
- 划词翻译
- AI 解读（逐句翻译 + 术语 + 语境义）
- 人文社科精读：客观分析 / 深度阅读 / 视野对照（中文 + 外文两栏）
- 笔记本（与阅读内容双向勾连）
- 框选 OCR 文字识别
- 文献库与分组管理
- RAG 检索（BM25 + 语义）
- 印刷页码映射

## 支持的 AI 供应商

OpenAI、Claude（Anthropic）、DeepSeek、通义千问（Qwen）、Kimi、GLM（Z.ai）、自定义 OpenAI 兼容端点

## 安装与启动

### Windows

1. 安装 Python 3.10+（https://www.python.org）
2. 双击 `一键安装_Windows.bat` → 自动创建环境、安装依赖、启动程序
3. 以后启动：双击 `启动_Windows_无黑框.vbs`

### macOS

1. 确认已有 Python 3（终端输入 `python3 --version`；没有则 `xcode-select --install`）
2. 右键点击 `一键安装_Mac.command` → 打开（第一次需右键，之后可直接双击）
3. 以后启动：双击 `启动_Mac.command`

### Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python desktop.py
```

## 配置

启动后点左上角 ☰ → 设置，填入你的 AI 供应商 API Key。Key 只存在本机浏览器，不上传。

## 技术栈

- 后端：Python / Flask（`app.py` ~2000 行，含全部路由、AI 提示词、RAG、OCR）
- 前端：原生 HTML / CSS / JS + PDF.js（无框架、无构建步骤）
- 数据：JSON 文件存本地 `data/` 目录

## 开源协议

MIT License
