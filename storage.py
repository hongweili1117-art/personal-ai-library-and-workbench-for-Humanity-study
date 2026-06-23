"""数据存取层：library.json / highlights / notes / ai_collection / ocr 缓存 的读写与修复，
以及 PDF 物理路径解析（含失效路径自愈）。由 app.py 通过 `from storage import *` 引入。"""
import json
import os
import re
import shutil
import uuid
import traceback
from datetime import datetime
from pathlib import Path

from config import *

__all__ = ['load_json', 'save_json', 'append_log', 'safe_library', 'safe_highlights',
           'safe_ocr_cache', 'safe_ai_collection', 'unique_pdf_dest', 'find_book', 'resolve_pdf_path']


def load_json(p, default):
    try:
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default


def save_json(p, data):
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def append_log(title, detail=""):
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write("\n" + "=" * 70 + "\n")
            f.write(datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "  " + str(title) + "\n")
            if detail:
                f.write(str(detail) + "\n")
    except Exception:
        pass


def safe_library():
    """读取并修复 library.json，避免旧版本/损坏记录导致上传 HTTP 500。"""
    raw = load_json(LIB_FILE, [])
    if not isinstance(raw, list):
        append_log("library.json 格式不是列表，已重置", repr(raw)[:1000])
        raw = []
    fixed = []
    changed = False
    seen = set()
    for item in raw:
        if not isinstance(item, dict):
            changed = True
            continue
        bid = str(item.get("id") or "").strip()
        name = str(item.get("name") or bid or "未命名 PDF").strip()
        path = str(item.get("path") or "").strip()
        if not bid or not path or bid in seen:
            changed = True
            continue
        seen.add(bid)
        try:
            total_pages = int(item.get("total_pages") or 0)
        except Exception:
            total_pages = 0
        try:
            current_page = int(item.get("current_page") or 0)
        except Exception:
            current_page = 0
        rec = {
            "id": bid,
            "name": name,
            "path": path,
            "total_pages": max(0, total_pages),
            "current_page": max(0, current_page),
            "added": item.get("added") or "",
        }
        _grp = item.get("group")
        if isinstance(_grp, str) and _grp.strip():
            rec["group"] = _grp.strip()[:60]
        _k = item.get("kind")
        if _k in ("text", "snippet"):
            rec["kind"] = _k
        try:
            _off = int(item.get("page_offset") or 0)
        except Exception:
            _off = 0
        if _off:
            rec["page_offset"] = _off
        fixed.append(rec)
        if item.get("id") != bid or item.get("path") != path:
            changed = True
    if changed:
        try:
            backup = LIB_FILE.with_suffix(".broken_backup_" + datetime.now().strftime("%Y%m%d_%H%M%S") + ".json")
            if LIB_FILE.exists():
                shutil.copy2(LIB_FILE, backup)
            save_json(LIB_FILE, fixed)
        except Exception as e:
            append_log("library.json 自动修复失败", traceback.format_exc())
    return fixed


def safe_highlights():
    raw = load_json(HL_FILE, [])
    return raw if isinstance(raw, list) else []


def safe_ocr_cache():
    raw = load_json(OCR_FILE, {})
    return raw if isinstance(raw, dict) else {}


def safe_ai_collection():
    """读取 AI 内容集合（保存的各 AI 功能产出）。损坏或格式不对时返回空列表。"""
    raw = load_json(AI_COLLECTION_FILE, [])
    if not isinstance(raw, list):
        return []
    out = []
    for it in raw:
        if isinstance(it, dict) and it.get("id"):
            out.append(it)
    return out



def unique_pdf_dest(filename):
    original = (filename or "untitled.pdf").strip() or "untitled.pdf"
    safe = re.sub(r'[\\/:*?"<>|\r\n\t]', "_", original).strip(" .") or "untitled.pdf"
    if not safe.lower().endswith(".pdf"):
        safe += ".pdf"
    stem = Path(safe).stem or "untitled"
    suffix = Path(safe).suffix or ".pdf"
    dest = PDF_DIR / (stem + suffix)
    i = 1
    while dest.exists():
        dest = PDF_DIR / f"{stem}_{i}{suffix}"
        i += 1
    return dest.name, dest


def find_book(bid):
    return next((b for b in safe_library() if b.get("id") == bid), None)


def resolve_pdf_path(book):
    """稳健地定位 PDF 物理文件。

    旧版库里存的是“绝对路径”。一旦整个程序文件夹被移动、改名，或换台电脑，
    这个绝对路径就会失效，导致打开 PDF 时报 404 / “打开失败”。
    这里按优先级回退查找，并把命中的有效路径“自愈”写回库，避免反复回退：
      1) 库里记录的原路径（仍有效就直接用）
      2) data/pdfs/<id>          —— id 即文件名，最常见的真实位置
      3) data/pdfs/<原路径文件名>
    全部未命中时返回原值，保持上层既有报错行为。
    """
    book = book or {}
    stored = book.get("path") or ""
    bid = book.get("id") or ""
    candidates = []
    if stored:
        candidates.append(Path(stored))
    if bid:
        candidates.append(PDF_DIR / bid)
    if stored:
        candidates.append(PDF_DIR / Path(stored).name)
    for p in candidates:
        try:
            if p and p.exists() and p.is_file():
                rp = str(p.resolve())
                if rp != stored:  # 自愈：把失效路径更新成当前有效路径
                    try:
                        lib = safe_library()
                        for it in lib:
                            if it.get("id") == bid:
                                it["path"] = rp
                                break
                        save_json(LIB_FILE, lib)
                    except Exception:
                        pass
                return rp
        except Exception:
            continue
    return stored
