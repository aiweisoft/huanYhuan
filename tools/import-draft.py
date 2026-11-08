#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把一份草稿 JSON 写进云端 huanhuan-articles。

做法：临时给云对象加一个本地导入方法 → 用 HBuilderX CLI 本地运行 → 立刻还原源码。
只在开发机本地跑，方法不会部署到云端。

用法：
  python tools/import-draft.py --json docs/import/inbox/xxx.rewritten.json
  python tools/import-draft.py --json docs/import/inbox/xxx.json --dry-run
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OBJ_PATH = ROOT / "uniCloud-alipay" / "cloudfunctions" / "huanhuan-co" / "index.obj.js"
PARAM_PATH = OBJ_PATH.parent / "huanhuan-co.param.js"
CLI_CANDIDATES = [
    Path(r"D:\HBuilderX.5.01.2026021122-alpha\HBuilderX\cli.exe"),
]
METHOD_MARKER = "\tasync listPosts("
METHOD_BLOCK = """\tasync importDraftsTemp({ articles } = {}) {
\t\tconst list = Array.isArray(articles) ? articles : []
\t\tlet inserted = 0
\t\tlet skipped = 0
\t\tfor (const item of list) {
\t\t\tconst data = normalizeArticle(item)
\t\t\tdata.status = 'draft'
\t\t\tconst id = item && item.id ? String(item.id).slice(0, 64) : ''
\t\t\tif (id) {
\t\t\t\ttry {
\t\t\t\t\tconst exist = await this.articles.doc(id).get()
\t\t\t\t\tif (exist.data && exist.data.length) { skipped++; continue }
\t\t\t\t} catch (e) {}
\t\t\t}
\t\t\tconst now = Date.now()
\t\t\ttry {
\t\t\t\tawait this.articles.add(Object.assign({}, data, id ? { _id: id } : {}, {
\t\t\t\t\tcreated_at: now,
\t\t\t\t\tupdated_at: now,
\t\t\t\t\tcreated_by: 'mail-import'
\t\t\t\t}))
\t\t\t\tinserted++
\t\t\t} catch (error) {
\t\t\t\tif (isDuplicate(error)) { skipped++; continue }
\t\t\t\tthrow error
\t\t\t}
\t\t}
\t\treturn JSON.stringify({ inserted, skipped })
\t},

"""


def log(message):
    print(message, flush=True)


def find_cli():
    for path in CLI_CANDIDATES:
        if path.exists():
            return str(path)
    found = shutil.which("cli")
    if found:
        return found
    raise RuntimeError("找不到 HBuilderX cli.exe")


def hbuilderx_running():
    try:
        out = subprocess.run(
            ["tasklist", "/FI", "IMAGENAME eq HBuilderX.exe"],
            capture_output=True, text=True, timeout=10,
        ).stdout
        return "HBuilderX.exe" in out
    except Exception:
        return False


def ensure_hbuilderx(cli):
    if hbuilderx_running():
        return
    log("HBuilderX 没开，尝试启动…")
    subprocess.Popen([cli, "open"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(30):
        time.sleep(2)
        if hbuilderx_running():
            log("HBuilderX 已启动")
            time.sleep(10)
            return
    raise RuntimeError("HBuilderX 启动超时")


def read_text(path):
    with open(path, encoding="utf-8", newline="") as f:
        return f.read()


def write_text(path, text):
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def import_articles(articles, cli):
    original = read_text(OBJ_PATH)
    if original and ord(original[0]) == 0xFEFF:
        original = original[1:]
    if METHOD_MARKER not in original:
        raise RuntimeError("index.obj.js 里找不到插入位置")
    patched = original.replace(METHOD_MARKER, METHOD_BLOCK + METHOD_MARKER, 1)
    write_text(OBJ_PATH, patched)
    write_text(
        PARAM_PATH,
        "// 临时运行参数，导入脚本生成，用完即删\n"
        "const clientInfo = {\n\tappId: '__UNI__8927398',\n\tuniPlatform: 'app',\n\tsource: 'client'\n}\n\n"
        "importDraftsTemp(" + json.dumps({"articles": articles}, ensure_ascii=False, indent="\t") + ")\n",
    )
    try:
        proc = subprocess.run(
            [cli, "cloud", "functions", "--run", "cloudobject",
             "--prj", "huanYhuan", "--provider", "alipay", "--name", "huanhuan-co"],
            capture_output=True, timeout=300,
        )
        out = (proc.stdout or b"").decode("utf-8", "ignore") + (proc.stderr or b"").decode("utf-8", "ignore")
        log(out.strip())
        match = re.search(r'\{"inserted":\s*(\d+),\s*"skipped":\s*(\d+)\}', out)
        if not match:
            raise RuntimeError("没拿到导入结果：" + out[-300:])
        return int(match.group(1)), int(match.group(2))
    finally:
        write_text(OBJ_PATH, original)
        try:
            PARAM_PATH.unlink()
        except OSError:
            pass


def main():
    parser = argparse.ArgumentParser(description="导入文章草稿")
    parser.add_argument("--json", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    path = Path(args.json)
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    articles = data if isinstance(data, list) else data.get("articles", [])
    articles = [a for a in articles if a.get("title") and a.get("body")]
    if not articles:
        raise SystemExit("没有可导入的文章")
    for article in articles:
        article["status"] = "draft"

    log(f"准备导入 {len(articles)} 篇：" + "、".join(a["title"] for a in articles))
    if args.dry_run:
        return

    cli = find_cli()
    ensure_hbuilderx(cli)
    inserted, skipped = import_articles(articles, cli)
    log(f"完成：新增 {inserted} 篇，跳过 {skipped} 篇")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log(f"导入失败：{type(exc).__name__}: {exc}")
        sys.exit(1)
