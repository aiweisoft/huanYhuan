#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
处理主题为「缓一缓」的投稿：

1. 找到 docs/import/inbox 里还没处理过的「缓一缓」草稿
2. 让 opencode 改写成 5–6 段、适合「读一点」的短文
3. 校验后调用 import-draft.py 写入云端草稿
4. 标记已处理

用法：
  python tools/process-huanhuan.py
  python tools/process-huanhuan.py --dry-run
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / "docs" / "import" / "inbox"
LOG_FILE = ROOT / "tools" / "mail-process.log"
LOCK_FILE = ROOT / "tools" / ".mail-process.lock"
IMPORTER = ROOT / "tools" / "import-draft.py"
MODEL_POLICY = Path.home() / ".config" / "opencode" / "model_policy.py"
FALLBACK_MODEL = "deepseek/deepseek-flash"
QUOTA_RE = re.compile(r"(quota|rate.?limit|429|too many requests|free usage|limit reached|exceeded)", re.I)


def model_candidates():
    try:
        out = subprocess.run(
            [sys.executable, str(MODEL_POLICY), "--candidates"],
            capture_output=True, text=True, timeout=20,
        )
        data = json.loads(out.stdout)
        if isinstance(data, list) and data:
            return data
    except Exception:
        pass
    return [FALLBACK_MODEL]


def mark_exhausted():
    try:
        subprocess.run(
            [sys.executable, str(MODEL_POLICY), "--mark-exhausted"],
            capture_output=True, timeout=20,
        )
    except Exception:
        pass


def log(message):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}"
    print(line)
    try:
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def write_json(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent="\t"), encoding="utf-8")


def build_instruction(raw_path, raw_article, out_path):
    return f"""# 改写任务：缓一缓投稿

请把下面这份原始草稿改写成适合「缓一缓」App「读一点」栏目的短文。

- 原文件：{raw_path}
- 只写一个文件：{out_path}

## 输出格式

JSON 数组，一个对象，字段：
`id`（沿用原 id）、`title`、`category`、`source`、`summary`、`body`、`url`、`minutes`、`status`、`sort`

## 要求

1. `body` 5–6 段，每段 80–150 字，总字数 450–700；不要 40 段那种长文。
2. 保留原文的核心机制和可执行建议，但不整篇搬运；不要逐句改写。
3. 去掉：性别/阶层偏见、绝对化结论、诊断式表达、过重的词（如「奴役」「最残忍」）。
4. `category` 从「关系 / 认识情绪 / 自我关照 / 睡眠 / 求助指南」里选一个。
5. `source` 写「读者投稿（改编）」；`url` 沿用原文件（没有就留空）。
6. `summary` 不超过 60 字。
7. `minutes` 按中文约 150 字/分，向上取整。
8. `status` 必须是 `"draft"`，`sort` 用 0。
9. 如果内容涉及心理困扰，最后一段给一句「持续影响生活时找专业评估」，不要给诊断或用药建议。
10. 不要发布、不要导入、不要改其他文件；写完这个 JSON 就结束。

## 风格参考

`docs/import/2026-11-08-zhihu-renxing.json`

## 原始草稿

{json.dumps(raw_article, ensure_ascii=False, indent=2)}
"""


def valid_article(item):
    if not isinstance(item, dict):
        return False
    if not str(item.get("title") or "").strip():
        return False
    body = item.get("body")
    if not isinstance(body, list) or not (3 <= len(body) <= 10):
        return False
    if any(not str(p).strip() for p in body):
        return False
    return item.get("status") == "draft"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=1)
    args = parser.parse_args()

    if LOCK_FILE.exists():
        log("上一条还在处理，跳过")
        return

    pending = []
    for path in sorted(INBOX.glob("*.json")):
        if path.name.endswith(".rewritten.json"):
            continue
        try:
            data = read_json(path)
        except Exception:
            continue
        items = data if isinstance(data, list) else data.get("articles", [])
        if not items:
            continue
        first = items[0]
        mail = first.get("_mail") or {}
        subject = str(mail.get("subject") or "")
        if "缓一缓" not in subject:
            continue
        if mail.get("processed"):
            continue
        pending.append((path, first))
        if len(pending) >= args.limit:
            break

    if not pending:
        log("没有待处理的「缓一缓」投稿")
        return

    opencode = shutil.which("opencode")
    if not opencode and not args.dry_run:
        log("找不到 opencode 命令")
        return

    LOCK_FILE.write_text(str(os.getpid()), encoding="utf-8")
    try:
        for raw_path, article in pending:
            article_id = str(article.get("id") or raw_path.stem)
            out_path = raw_path.with_name(raw_path.stem + ".rewritten.json")
            instruction_path = raw_path.with_name(raw_path.stem + ".instruction.md")
            instruction_path.write_text(
                build_instruction(raw_path, article, out_path), encoding="utf-8"
            )
            log(f"开始改写：{article_id}（{raw_path.name}）")

            if args.dry_run:
                log(f"dry-run：指令已写到 {instruction_path.name}")
                continue

            prompt = f"请读取并严格执行 {instruction_path} 里的改写任务。"
            log_path = raw_path.with_name(raw_path.stem + ".opencode.log")
            if out_path.exists():
                out_path.unlink()
            success = False
            for model in model_candidates():
                command = (
                    f'"{opencode}" run --auto --model {model} '
                    f'--title "改写投稿 {article_id}" "{prompt}"'
                )
                log(f"使用模型：{model}")
                with log_path.open("a", encoding="utf-8") as out:
                    out.write(f"\n==== model {model} {datetime.now()} ====\n")
                    out.flush()
                    proc = subprocess.run(
                        command, cwd=str(ROOT), shell=True,
                        stdout=out, stderr=subprocess.STDOUT, timeout=20 * 60,
                    )
                if proc.returncode == 0 and out_path.exists():
                    success = True
                    break
                text = log_path.read_text(encoding="utf-8", errors="ignore")[-4000:]
                if QUOTA_RE.search(text):
                    log("免费额度可能用完了，切换付费模型")
                    mark_exhausted()
                    continue
                break
            if not success:
                log(f"改写失败，详见 {log_path.name}")
                continue

            try:
                data = read_json(out_path)
            except Exception as exc:
                log(f"改写结果不是合法 JSON：{exc}")
                continue
            items = data if isinstance(data, list) else data.get("articles", [])
            if not items or not valid_article(items[0]):
                log("改写结果未通过校验，未导入")
                continue

            article_out = items[0]
            article_out["id"] = article_id
            article_out["status"] = "draft"
            write_json(out_path, [article_out])

            result = subprocess.run(
                [sys.executable, str(IMPORTER), "--json", str(out_path)],
                cwd=str(ROOT), capture_output=True, text=True, timeout=300,
            )
            log((result.stdout or "").strip().splitlines()[-1] if result.stdout else "")
            if result.returncode != 0:
                log("导入失败，保留改写文件等下次重试")
                continue

            article["_mail"] = dict(article.get("_mail") or {})
            article["_mail"]["processed"] = True
            article["_mail"]["processedAt"] = datetime.now().isoformat(timespec="seconds")
            article["_mail"]["rewritten"] = out_path.name
            write_json(raw_path, [article])
            log(f"完成：{article_id} 已进草稿")
    except subprocess.TimeoutExpired:
        log("改写超时（20 分钟）")
    except Exception as exc:
        log(f"处理失败：{type(exc).__name__}: {exc}")
    finally:
        try:
            LOCK_FILE.unlink()
        except OSError:
            pass


if __name__ == "__main__":
    main()
