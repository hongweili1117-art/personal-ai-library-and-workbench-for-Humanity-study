# -*- coding: utf-8 -*-
"""
个人 AI 智库 · 冒烟测试
运行方式：
  Windows：双击「运行测试_Windows.bat」
  Mac/Linux：python3 smoke_test.py
全部显示 [OK] 才算通过；出现 [FAIL] 说明有问题，看提示修复后重新跑。
"""
import sys
import os
import importlib

os.environ.setdefault("APW_BASE_DIR", os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PASS = 0
FAIL = 0

def ok(msg):
    global PASS
    PASS += 1
    print(f"  [OK]  {msg}")

def fail(msg, hint=""):
    global FAIL
    FAIL += 1
    print(f"  [FAIL] {msg}")
    if hint:
        print(f"         → {hint}")

def check(label, cond, hint=""):
    if cond:
        ok(label)
    else:
        fail(label, hint)

print()
print("=" * 56)
print("  个人 AI 智库 · 冒烟测试")
print("=" * 56)

# ── 1. 核心依赖 ──────────────────────────────────────────
print("\n【1】核心依赖")
for mod, pkg in [("flask","flask"), ("fitz","PyMuPDF"), ("numpy","numpy"),
                 ("waitress","waitress"), ("webview","pywebview")]:
    try:
        importlib.import_module(mod)
        ok(f"{pkg} 已安装")
    except ImportError:
        fail(f"{pkg} 未安装", f"运行：pip install {pkg}")

# ── 2. 关键文件存在 ──────────────────────────────────────
print("\n【2】关键文件")
for f in ["app.py","config.py","storage.py","ai_clients.py",
          "desktop.py","requirements.txt",
          "web/index.html","web/app.js","web/style.css",
          ".gitignore","README.md","LICENSE"]:
    check(f, os.path.isfile(f), f"文件不存在：{f}")

# ── 3. Flask 路由与安全头 ─────────────────────────────────
print("\n【3】Flask 路由与安全")
try:
    import app as _app
    c = _app.app.test_client()

    r = c.get("/", headers={"Host": "127.0.0.1"})
    check("首页返回 200", r.status_code == 200,
          f"实际状态码：{r.status_code}")
    check("X-Frame-Options: DENY", r.headers.get("X-Frame-Options") == "DENY",
          "缺少安全头，可能允许被嵌入到其他页面（点击劫持风险）")
    check("Cache-Control: no-store（首页）",
          "no-store" in (r.headers.get("Cache-Control") or ""),
          "缺少缓存控制，前端改动后浏览器可能仍加载旧版")
    body = r.get_data(as_text=True)
    check("CSS 带版本号（?v=）", "style.css?v=" in body,
          "缓存破坏机制未生效")
    check("JS 带版本号（?v=）", "app.js?v=" in body,
          "缓存破坏机制未生效")

    r2 = c.get("/web/app.js", headers={"Host": "127.0.0.1"})
    check("app.js 返回 200", r2.status_code == 200)
    check("app.js Cache-Control: no-store",
          "no-store" in (r2.headers.get("Cache-Control") or ""),
          "前端 JS 没有禁止缓存")
    js = r2.get_data(as_text=True)
    check("划词空白span保护存在", "userSelect" in js,
          "空白 span 防误选代码丢失")
    check("功能菜单关闭修复（pointerdown）存在", "pointerdown" in js,
          "功能菜单关闭修复丢失，重新应用 app.js 的改动")

    r3 = c.get("/web/style.css", headers={"Host": "127.0.0.1"})
    css = r3.get_data(as_text=True)
    import re as _re
    bare_grid = _re.search(r'(?<!\.open )\b\.tb-pop-grid\s*\{([^}]*)\}', css)
    has_bare_display_grid = bool(bare_grid and "display" in bare_grid.group(1) and "grid" in bare_grid.group(1))
    check("CSS 功能菜单可关闭（无裸 display:grid）",
          not has_bare_display_grid,
          "style.css 里 .tb-pop-grid 仍带 display:grid，功能菜单无法关闭")

    r_evil = c.get("/", headers={"Host": "evil.com"})
    check("非法 Host 返回 403（防 DNS 重绑定）",
          r_evil.status_code == 403,
          "Host 白名单失效，存在安全风险")

    routes = len(list(_app.app.url_map.iter_rules()))
    check(f"路由数量为 42（实际 {routes}）", routes == 42,
          "路由数量变了，请同步更新 CLAUDE.md §9")

except Exception as e:
    fail(f"Flask 测试崩溃：{e}", "检查 app.py 是否有语法错误")

# ── 4. data/ 和 .venv/ 不会被 Git 追踪 ──────────────────
print("\n【4】Git 安全（私人数据不上传）")
gi = ".gitignore"
if os.path.isfile(gi):
    content = open(gi, encoding="utf-8").read()
    check("data/ 在 .gitignore 中", "data/" in content,
          "书库/笔记/PDF 可能被误传到 GitHub！")
    check(".venv/ 在 .gitignore 中", ".venv/" in content,
          "虚拟环境（几百MB）可能被误传！")
else:
    fail(".gitignore 文件不存在", "运行项目初始化脚本创建它")

# ── 结果汇总 ─────────────────────────────────────────────
print()
print("=" * 56)
total = PASS + FAIL
if FAIL == 0:
    print(f"  全部通过 {PASS}/{total}  ✓  可以放心打包或上传 GitHub")
else:
    print(f"  通过 {PASS}/{total}，失败 {FAIL} 项  ✗  请修复上方 [FAIL] 项后重新测试")
print("=" * 56)
print()
sys.exit(0 if FAIL == 0 else 1)
