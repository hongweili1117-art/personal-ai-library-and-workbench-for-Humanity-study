# CLAUDE.md — 个人 AI 智库 · 项目交接与开发参考

> 这是给 Claude Code 的常驻上下文。接手本项目前请通读本文件。
> 用户（项目所有者）母语为中文、偏好**简体中文**沟通、**密集行文、少用列表/加粗**。
> 用户是**非程序员**：用很短的指令（常常只是「继续」）确认方向，具体改动全部交给 AI 完成。
> 因此：动手前先读代码、改动要小步可回滚、每步都自测；除非用户明确要求，不要大改架构。

---

## 1. 这是什么

一个**本地运行**的学术精读工作台：Flask 后端 + 原生 JS/PDF.js 前端，浏览器界面。
面向人文社科（批判理论、政治哲学、法学、政治经济学）的德/中/英文献精读。
核心能力：PDF 阅读与标注、划词翻译、AI 解读（逐句翻译+术语+语境义）、人文社科精读
（客观分析 / 深度阅读 / 视野对照）、笔记本与笔记↔阅读勾连、框选 OCR、文献库与分组、
RAG 检索（BM25+语义）、印刷页码映射。所有 AI 调用走用户自带的第三方 API Key。

---

## 2. 运行与自测（**改动后必须跑**）

本项目**没有自动化测试套件**；用下面这套轻量冒烟测试，每改一处就跑一遍。

前端 JS 语法：
```bash
node --check web/app.js
```

后端导入 + Flask 冒烟（在项目根目录）：
```bash
APW_BASE_DIR=$(pwd) python3 -c "import app"          # 能 import 即模块结构没崩
APW_BASE_DIR=$(pwd) python3 - <<'PY'
import app
c=app.app.test_client()
print(c.get('/',headers={'Host':'127.0.0.1'}).status_code)          # 期望 200
print(c.get('/',headers={'Host':'127.0.0.1'}).headers.get('X-Frame-Options'))  # 期望 DENY
print(c.get('/web/app.js',headers={'Host':'127.0.0.1'}).status_code)# 期望 200
print(c.get('/',headers={'Host':'evil.com'}).status_code)           # 期望 403（Host 防护）
print(len(list(app.app.url_map.iter_rules())))                      # 期望 42（增删路由时同步更新）
PY
```

要点：
- **`from config import *` 等会让 pyflakes 失灵**（检测不到未定义名），别依赖 lint，用上面的 import+冒烟来验证。
- `index()` 路由把 `web/index.html` 里的 `__PDFJS__` / `__WORKER__` 占位符在响应时替换；
  直接看磁盘上的 index.html 会有占位符，是正常的。
- 改 AI 流式端点后，注意 `ai_clients.py` 顶部必须 `from flask import Response`（曾因此踩坑：
  `sse_stream` 移走后丢了 Response 导致所有流式路由 500）。

启动方式（用户侧）：
- Windows 无黑框：双击 `启动_Windows_无黑框.vbs` → `pythonw.exe desktop.py`（后台起服务 + 弹窗/浏览器）。
- 直接源码跑：`python app.py`（开发用，带黑色控制台，关掉即停服）。
- 打包：`app.spec`（PyInstaller，入口 desktop.py，console=False）。

---

## 3. 目录与文件地图

后端（Python，约 2800 行）：
- `app.py`（~2037 行）：Flask 应用主体——**全部 42 个路由**、各领域 helper、AI 提示词、
  PDF 文本/页码、RAG 索引、OCR 路由。`_text_cache`（book_pages_text 用）**特意留在这里**，没搬走。
- `config.py`（94 行）：所有路径常量 + 目录创建 + AI 供应商 base/模型名 + `OPENAI_COMPAT`
  + `VISION_DEFAULT_MODEL` + `OCR_TASK_PROMPTS` + `PDFJS_CDN`/`WORKER_CDN` + `STOPWORDS` + `IRON`。
- `storage.py`（185 行，`__all__` 守卫）：`load_json/save_json/append_log/safe_library/
  safe_highlights/safe_ocr_cache/safe_ai_collection/unique_pdf_dest/find_book/resolve_pdf_path`。
- `ai_clients.py`（301 行，`__all__` 守卫，**需 `from flask import Response`**）：`_msg_text/
  _openai_compatible_chat/_openai_responses_chat/llm_chat/llm_chat_stream/sse_stream/llm_call/
  vision_ocr/vision_chat/resolve_key`。
- `desktop.py`（195 行）：无黑框启动器。后台线程跑 waitress（回退 werkzeug→Flask dev），
  挑空闲端口，开 pywebview 窗口 / 否则浏览器+tkinter 控制窗 / 再否则纯浏览器常驻。
  **`_ensure_console_streams()`**：pythonw 下 `sys.stdout/err` 为 None，重定向到
  `data/logs/launcher.log`，避免任何 `print()` 让启动器静默崩溃。
- `_bootstrap.py`：向后兼容入口，委托 `desktop.main()`。
- `build_exe.py` / `把扫描版PDF转成可搜索PDF.py`：打包脚本 / OCRmyPDF 小工具。

前端（`web/`，从早期 app.py 里的大字符串外移成真实文件）：
- `web/index.html`（383 行）：单页结构。顶栏、书架/设置抽屉、阅读区 `#viewer`/`#pages`、
  右侧工具坞 `#dock`、各浮窗（翻译/AI解读/精读/笔记本/AI内容集合）、划词小菜单、键盘帮助。
- `web/app.js`（1049 行）：全部前端逻辑（**无框架、无构建**，原生 JS）。详见 §4。
- `web/style.css`（319 行）：全部样式（CSS 变量主题，sepia 等阅读底色）。

数据与资源：
- `data/`（**运行时生成，打包时排除**）：`library.json`、`pdfs/`、`highlights.json`、
  `notes.json`、`ai_collection.json`、`rag_indexes/`、`logs/`、`exports/`。
- `lib/`：离线 PDF.js 资源（可选）。
- `.venv/`：**随包附带的 Windows 虚拟环境**（Scripts/，非 bin/）。Linux/Mac 用户须用
  `requirements.txt` 自建环境，勿直接用这个 .venv。

---

## 4. 前端架构要点（web/app.js）

- 状态：`settings` 对象存 localStorage（`saveSettings()`）。关键键见 §6。
- 阅读模式（**新**）：两组正交开关
  `settings.scrollMode ∈ {continuous, fixed}` × `settings.pageLayout ∈ {single, double}`，
  helper `isContinuous()` / `isDouble()`。旧的单一 `settings.viewMode`（scroll/double/paged）
  仅用于一次性迁移（见 app.js 顶部，scroll→连续单页，double→固定双页，paged→固定单页）。
  顶栏两个分段控件 `#seg-scroll` / `#seg-layout`（按钮带 `data-v`）驱动。
  `buildPages()` 处理 4 种组合，**连续+双页**是新增分支（按对纵向排列 + IntersectionObserver）。
- 渲染：`renderPageEl()`（按页懒渲染，含上方页高度补偿避免滚动跳动 + 空白 span 关闭选择）；
  `makePageEl()`（含 `.pg-badge` 印刷页角标）；`computeFitScale()`/`cycleFit()`（适配宽/整页/自由）。
- 工具坞 `#dock`：宽屏（≥820px）时把「翻译 win-translate」「AI解读 win-qa」**重定位**进 `#dock`，
  加 `.docked` 类（position:static, flex 布局）。两面板间有**可上下拖动的分隔条 `#dock-split`**
  （仅两个都开时显示，body 加 `dock-split-on`；拖动改 `--dock-top-h`，存 `rw_docktoph`）。
  左缘 `#dock-resize` 拖宽（存 `rw_dockw`）；`#dock-collapse`/`#dock-reopen` 收起/展开。
  默认宽 `--dock-w:24vw`。窄屏走 `@media(max-width:819px)` 隐藏，翻译/解读回退浮窗。
- 窗口开关：`openWin/closeWin`，**`toggleWin(id)`（点开/再点关，菜单项与 Alt 快捷键都用它）**，
  `winVisible(id)` 兼顾 docked 与浮窗、以及坞收起态。`humInit()` 已并入 `openWin('hum')`。
- 顶栏：JS 量测真实高度写入 `--topbar-h`（ResizeObserver 监听 `#topbar`），故 CSS 改紧凑后
  阅读区/坞会自动跟随。`.tb-center` 现为 `nowrap`（工具与功能同一行；**勿加 overflow，会裁掉下拉框**）。
- 划词：`#pop-tr`(翻译)/`#pop-ex`(解释→openQA+runExplainInChat)/荧光笔；OCR 框选 `captureOCR`。

前后端**输出格式契约**（改提示词时必须同步前端解析器）：
- `视野对照` (dual_horizon_stream) 输出 markdown `## 中文视野` / `## 外文视野` / `## 对照小结`，
  由 `renderDualOut()` 解析成两栏+小结。改了输出结构就要改 renderDualOut。
- `AI 解读` (explain_stream) 固定三块：①句子翻译 ②关键术语(3-5个,保留原文词) ③结合上下文含义。
- 所有 AI 引文页码标记走后端 `_plab()`，引用的是**印刷页码**而非阅读序号。

---

## 5. 关键约定与红线（**改动前务必注意**）

- **AI 提示词是精调过的，勿随意重写**。位置（app.py）：
  `explain_stream`(~1022)、`framework_stream`=客观分析(~1909)、`critique_stream`=深度阅读(~1932)、
  `dual_horizon_stream`=视野对照(~1966)、笔记↔阅读勾连(~2000/~2022)。
  共同约定：都以 `IRON`（config.py 里的硬性收尾约束常量）结尾，输出简体中文、忠于原文不臆测。
  客观分析=只描述不评价（五维：研究问题/关键概念/理论方法/论证形式与逻辑/材料·史实·案例）；
  深度阅读=先以最强意义重构作者论证再批判（内在批判+隐含价值/反身性+概念史+谱系学，织成连贯短论）；
  视野对照=中文/外文(英·德·法)两栏。改提示词请保留这些结构契约与 IRON。
- 术语渲染习惯（翻译项目沿用）：`Kontingenz`/`Diskurs`/`Komplexität` 等关键术语**保留原文词**、
  以原文语言自身语义为准、浅白中文解释。
- `safe_library()` **必须保留每本书的 `page_offset`**（曾有 bug：重建 schema 时丢了 offset，
  导致页码映射失效——已修，勿回退）。
- `_text_cache` 留在 app.py（给 `book_pages_text`），不要搬进 storage.py。
- `desktop.py` 里**不要加裸 `print()` 假设有控制台**；pythonw 下靠 `_ensure_console_streams()` 兜底。
- 安全：CSP、SSRF 限制（`api_fetch_url` 抓网页转 PDF 时）、Host 白名单（防 DNS rebinding，
  非白名单 Host 返回 403）、`/web/<path>` 与 `/lib/<path>` 有路径穿越守卫。改这些要重测冒烟里的 403/200。
- 打包排除清单：`data/`、`__pycache__`、`*.bak/*.humbak/*.presplit/*.stage0bak/*.jbak`；
  保留 `.venv`；用 Python `zipfile` 写中文名（顶层文件夹 `个人AI智库`）。

---

## 6. settings 键（localStorage）

引擎/模型：`engine, keys, target, glossary, dsModel, oaModel, oaEffort, claudeModel, claudeEffort,
zaiModel, qwenModel, kimiModel, customBase, customModel`。
阅读：`scrollMode(连续/固定), pageLayout(单页/双页), fitMode(width/page/off), viewMode(仅迁移用·勿再读),
readerBg, readerBgCustom`。
AI/工具：`aiThink, toolMode, hlColor`。笔记：`nbFont, nbSize`。顶栏：`barLocked`。
另有非 settings 的 UI 持久化键：`rw_dockw`(坞宽), `rw_docktoph`(坞上下分隔), `rw_geom`(浮窗几何)。

AI 供应商（config.py）：`OPENAI_COMPAT` = {DeepSeek, ZAI, Qwen, Kimi → (base,model)}；
OpenAI/Claude 走各自 SDK；视觉 OCR 供应商 `VISION_DEFAULT_MODEL` = {Qwen, Kimi, GLM}。
Key 存在浏览器端、随请求传后端（`resolve_key`），后端不持久化 key。

---

## 7. 已完成的功能（近期重构）

- **精简**：删除 6 个旧功能（文献卡片/摘要/AI智库/对比/图表/原文）及五维提炼/文献库定位，连同其路由、
  前端窗口、JS、快捷键、菜单项一并清除。保留所有保存路由与「🗂️AI内容集合」面板。
- **AI 解读合并**：解释+问答 合成单一「💡 AI 解读」窗（流式 `/api/explain_stream`，三块式提示词，
  检索范围 around/all/range，思考开关透传 effort）。
- **划词/荧光笔体验**：滚动跳动补偿、滚动节流(rAF)、左侧空白不可选、荧光笔透明度调整。
- **人文社科精读重构**：三按钮 客观分析/深度阅读/视野对照（提示词见 §5），视野对照两栏渲染。
- **工具坞**：右侧 dock 容纳 翻译+AI解读，可拖宽/收起；本轮新增**两面板间可自由拖动的分隔条**、
  默认宽降到 24vw。
- **印刷页码**：PDF 内嵌 PageLabels 优先 → 每书 page_offset → 阅读序号兜底；角标可点设 offset；
  所有 AI 引文用印刷页码。
- **菜单项开关化**：功能菜单四项 + Alt 快捷键都改成 `toggleWin`（点开/再点关）。
- **阅读模式拆分**：连续/固定 × 单页/双页 两组正交开关（含新「连续+双页」）。
- **顶栏紧凑化**：功能贴工具同一行（nowrap）、按钮/间距/高度压缩。
- **后端模块拆分**：从 app.py 拆出 config/storage/ai_clients（行为保持，已逐步测过）。
- **无黑框启动加固**：desktop.py 加 pythonw 流保护、清理已删模块的 THINK_TANK 残留引用。
- **打包**：Python zipfile 出 `个人AI智库.zip`（顶层中文夹名、含 Windows .venv、排除测试数据与备份）。

---

## 8. 待办 / 下一步（按优先级，供参考）

1. **真机验证本轮交互**（dock 分隔条拖动、四种阅读组合尤其连续+双页、菜单开关、顶栏单行）——
   这些是 UI 行为，需在浏览器里实际点验；逻辑/语法已自测过但手感未验证。
2. **`使用说明.txt` 过时**：仍提到已删/改名功能（双视野/文献卡片/摘要/AI智库等）。需重写成当前
   四项菜单结构（翻译 / AI 解读 / 人文社科精读 / 笔记本 + 工具里的框选OCR）。
3. **顶栏"缩小50%"口径待定**：当前是"元素整体压扁"。若用户其实想要"整条只占半屏宽的居中悬浮条"，
   那是另一种布局改法（注意左上角 ☰ 与标题的位置）。等用户确认。
4. **死代码清理**（低优先、谨慎）：app.py 内仍有未接入活跃流程的 `chapter_context` /
   `build_paper_card_context` 残留（约 ~578/~679，含两处阅读序号页码标记），无害但可清。
5. **更深的后端模块化**（高风险、已暂缓）：可考虑再拆 pdf/rag/text 模块或改 Flask Blueprints。
   做之前先和用户确认，并务必行为保持 + 逐步冒烟。

工作方式建议：用户喜欢**很小的增量**、改完给一句话说明（中文、密集行文）。除非用户说"打包"，
否则只改代码、不重新生成 zip。打包时严格按 §5 的排除清单。

---

## 9. 全部路由清单（42，改动后同步更新）

页面/静态：`GET /`(index)、`GET /web/<path>`(web_static)、`GET /lib/<path>`(api_lib)。
文献库：`GET /api/library`、`POST /api/upload`、`POST /api/lib/add_text`、`POST /api/lib/delete`、
`POST /api/lib/set_group`、`POST /api/lib/rename_group`、`POST /api/lib/delete_group`、
`GET /api/pdf/<bid>`、`GET /api/pagetext/<bid>`、`GET /api/export/<bid>`、`POST /api/progress`。
页码：`GET /api/page_labels/<bid>`、`POST /api/page_offset`。
标注/笔记：`POST/GET /api/highlights`、`GET /api/highlights/<bid>`、`POST /api/highlights/delete`、
`GET /api/highlights/export_pdf/<bid>`、`GET /api/notes/<bid>`、`POST /api/notes/save`、
`POST /api/notes/delete`。
AI：`POST /api/translate`、`POST /api/explain_stream`、`POST /api/ask`、`POST /api/ask_stream`、
`POST /api/hum/framework_stream`、`POST /api/hum/critique_stream`、`POST /api/hum/dual_horizon_stream`、
`POST /api/links/notes_from_reading_stream`、`POST /api/links/evidence_from_notes_stream`。
检索/RAG：`GET /api/search/<bid>`、`POST /api/build_rag_index`、`GET /api/rag_status/<bid>`。
OCR/抓取：`POST /api/ocr`、`POST /api/fetch_url`。
AI内容集合：`GET /api/ai_collection`、`POST /api/ai_collection/save`、
`POST /api/ai_collection/update`、`POST /api/ai_collection/delete`。
