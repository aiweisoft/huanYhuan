#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
邮箱投稿收集器（半自动）

只做三件事：
1. 用 IMAP 收 sxzhizhi@163.com 的邮件，只认白名单发件人
2. 提取正文 / 链接 / 附件（txt、docx、pdf）
3. 在 docs/import/inbox/ 生成可直接导入的草稿 JSON

改写和导入仍然人工过一遍。用法：
  python tools/mail-inbox.py
  python tools/mail-inbox.py --dry-run
  python tools/mail-inbox.py --allow-sender someone@example.com
  python tools/mail-inbox.py --limit 5 --since-days 7
"""

import argparse
import email
import hashlib
import imaplib
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from email.header import decode_header
from email.utils import parsedate_to_datetime
from io import BytesIO
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INBOX_DIR = PROJECT_ROOT / "docs" / "import" / "inbox"
STATE_FILE = PROJECT_ROOT / "tools" / ".mail-import-state.json"
LOG_FILE = PROJECT_ROOT / "tools" / "mail-import.log"

DEFAULT_ALLOW = ["dyp_2001@163.com"]
CONFIG_PATHS = [
    Path(r"E:\ai-content-ops\tools\邮件配置.json"),
    Path(r"C:\Users\Administrator\ai-content-ops\tools\邮件配置.json"),
    Path.home() / ".config" / "opencode" / "skills" / "email-sender" / "config" / "mail.json",
]

URL_RE = re.compile(r"https?://[^\s<>\"'）)】\]]+", re.I)


def log(message):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}"
    print(line)
    try:
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def load_config():
    for path in CONFIG_PATHS:
        if path.exists():
            with path.open(encoding="utf-8") as f:
                cfg = json.load(f)
            if cfg.get("sender") and cfg.get("authcode"):
                return cfg
    raise SystemExit("找不到邮件配置（sender / authcode）")


def decode_header_value(value):
    if not value:
        return ""
    out = []
    for text, enc in decode_header(value):
        if isinstance(text, bytes):
            out.append(text.decode(enc or "utf-8", "ignore"))
        else:
            out.append(text)
    return "".join(out)


def clean_title(subject):
    title = decode_header_value(subject).strip()
    title = re.sub(r"^(re|fw|fwd|回复|转发)\s*[:：]\s*", "", title, flags=re.I)
    title = re.sub(r"^[\[【（(][^\]】）)]{1,12}[\]】）)]\s*", "", title)
    return title.strip() or "邮件投稿"


def html_to_text(html):
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return re.sub(r"<[^>]+>", " ", html)

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "header", "footer", "aside", "form"]):
        tag.decompose()
    blocks = [
        b.get_text(" ", strip=True)
        for b in soup.find_all(["p", "h1", "h2", "h3", "li", "blockquote"])
    ]
    blocks = [b for b in blocks if b]
    if len(blocks) >= 2:
        return "\n\n".join(blocks)
    text = soup.get_text("\n", strip=True)
    return text


def extract_pdf(data):
    try:
        from pypdf import PdfReader
    except ImportError:
        return ""
    try:
        reader = PdfReader(BytesIO(data))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception as exc:
        log(f"PDF 解析失败：{exc}")
        return ""


def extract_docx(data):
    try:
        import docx
    except ImportError:
        return ""
    try:
        doc = docx.Document(BytesIO(data))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as exc:
        log(f"DOCX 解析失败：{exc}")
        return ""


def extract_message(msg):
    """返回 (正文纯文本, 附件文本列表, 附件名列表)"""
    plain = []
    html = []
    attachments = []
    attachment_names = []

    for part in msg.walk():
        if part.is_multipart():
            continue
        ctype = (part.get_content_type() or "").lower()
        filename = decode_header_value(part.get_filename() or "")
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        charset = part.get_content_charset() or "utf-8"

        if filename:
            attachment_names.append(filename)
            lower = filename.lower()
            if lower.endswith(".txt"):
                attachments.append(payload.decode(charset, "ignore"))
            elif lower.endswith(".docx"):
                attachments.append(extract_docx(payload))
            elif lower.endswith(".pdf"):
                attachments.append(extract_pdf(payload))
            continue

        if ctype == "text/plain":
            plain.append(payload.decode(charset, "ignore"))
        elif ctype == "text/html":
            html.append(payload.decode(charset, "ignore"))

    body = "\n\n".join(p.strip() for p in plain if p.strip())
    if len(body) < 40 and html:
        body = html_to_text("\n".join(html))
    return body, [a for a in attachments if a.strip()], attachment_names


def fetch_url(url):
    try:
        import requests
    except ImportError:
        return ""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=20, allow_redirects=True)
        if resp.status_code >= 400:
            log(f"链接抓取失败 HTTP {resp.status_code}：{url}")
            return ""
        text = html_to_text(resp.text) if "<html" in resp.text[:500].lower() else resp.text
        title = ""
        match = re.search(r"<title[^>]*>(.*?)</title>", resp.text, re.I | re.S)
        if match:
            title = re.sub(r"\s+", " ", match.group(1)).strip()
        return (title, text)
    except Exception as exc:
        log(f"链接抓取异常：{url}（{exc}）")
        return ""


def normalize_blocks(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[\t\u00a0]+", " ", text)
    blocks = [re.sub(r"[ \u3000]+", " ", b).strip() for b in re.split(r"\n\s*\n+", text)]
    blocks = [b for b in blocks if b]
    if len(blocks) == 1 and len(blocks[0]) > 600:
        # 一大段时按句号粗切，方便后台编辑
        sentences = re.split(r"(?<=[。！？!?])", blocks[0])
        chunk, merged = "", []
        for sentence in sentences:
            chunk += sentence
            if len(chunk) >= 180:
                merged.append(chunk.strip())
                chunk = ""
        if chunk.strip():
            merged.append(chunk.strip())
        blocks = merged
    return blocks[:50]


def build_article(msg):
    subject = clean_title(msg.get("Subject"))
    date = msg.get("Date") or ""
    message_id = (msg.get("Message-ID") or "").strip()
    sender = decode_header_value(msg.get("From"))

    body_text, attachment_text, attachment_names = extract_message(msg)
    combined = "\n\n".join(x for x in [body_text] + attachment_text if x.strip())
    if not combined.strip():
        log(f"跳过（正文为空）：{subject}")
        return None

    urls = URL_RE.findall(combined)
    source_url = urls[0].rstrip(".,;，。；、") if urls else ""

    # 正文只有一个链接时，尝试抓取页面
    stripped = combined.strip()
    if source_url and len(stripped) <= len(source_url) + 40:
        fetched = fetch_url(source_url)
        if fetched:
            page_title, page_text = fetched
            if page_text.strip():
                combined = page_text
                if subject in ("邮件投稿", page_title):
                    subject = clean_title(page_title)

    blocks = normalize_blocks(combined)
    if not blocks:
        log(f"跳过（提取不到段落）：{subject}")
        return None

    total_chars = sum(len(b) for b in blocks)
    minutes = max(1, min(120, (total_chars + 149) // 150))
    summary = blocks[0][:120]

    digest = hashlib.sha1((message_id or f"{subject}{date}").encode("utf-8")).hexdigest()[:12]
    article_id = f"mail-{digest}"

    source = "邮件投稿"
    if source_url:
        match = re.match(r"https?://([^/]+)", source_url)
        if match:
            source = match.group(1)

    article = {
        "id": article_id,
        "title": subject,
        "category": "外部导入",
        "source": source,
        "summary": summary,
        "body": blocks,
        "url": source_url,
        "minutes": minutes,
        "status": "draft",
        "sort": 0,
        "_mail": {
            "messageId": message_id,
            "from": sender,
            "date": date,
            "attachments": attachment_names,
        },
    }
    return article


def load_state():
    if not STATE_FILE.exists():
        return set()
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return set(data.get("processed", []))
    except Exception:
        return set()


def save_state(processed):
    items = sorted(processed)[-800:]
    STATE_FILE.write_text(
        json.dumps({"processed": items}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(description="邮箱投稿收集器")
    parser.add_argument("--limit", type=int, default=10, help="本次最多处理几封")
    parser.add_argument("--scan-limit", type=int, default=200, help="最多扫描最近多少封邮件")
    parser.add_argument("--since-days", type=int, default=30, help="只查最近几天的邮件")
    parser.add_argument("--allow-sender", action="append", default=[], help="额外允许的发件人")
    parser.add_argument("--dry-run", action="store_true", help="只打印，不写文件")
    args = parser.parse_args()

    allow = [x.strip().lower() for x in DEFAULT_ALLOW + args.allow_sender if x.strip()]
    cfg = load_config()
    state = load_state()
    INBOX_DIR.mkdir(parents=True, exist_ok=True)

    since = (datetime.now() - timedelta(days=args.since_days)).strftime("%d-%b-%Y")
    client = imaplib.IMAP4_SSL("imap.163.com", 993, timeout=20)
    client.login(cfg["sender"], cfg["authcode"])
    try:
        client.xatom("ID", '("name" "huanhuan-mail-import" "version" "1.0" "vendor" "local")')
    except Exception:
        pass
    client.select("INBOX", readonly=True)

    # 163 的 IMAP 不支持按 FROM 搜索，只能按日期取回来在本地过滤
    typ, data = client.search(None, "SINCE", since)
    ids = data[0].split() if typ == "OK" and data and data[0] else []
    ids = list(dict.fromkeys(ids))[-args.scan_limit:]

    log(f"扫描最近 {len(ids)} 封邮件（白名单：{', '.join(allow)}）")

    added = 0
    matched = 0
    for num in ids:
        if matched >= args.limit:
            break
        typ, head = client.fetch(num, "(BODY.PEEK[HEADER.FIELDS (FROM MESSAGE-ID SUBJECT DATE)])")
        if typ != "OK" or not head or not head[0]:
            continue
        head_msg = email.message_from_bytes(head[0][1])
        sender = decode_header_value(head_msg.get("From")).lower()
        if not any(addr in sender for addr in allow):
            continue

        message_id = (head_msg.get("Message-ID") or "").strip()
        if message_id and message_id in state:
            continue

        typ, fetched = client.fetch(num, "(BODY.PEEK[])")
        if typ != "OK" or not fetched or not fetched[0]:
            continue
        msg = email.message_from_bytes(fetched[0][1])
        article = build_article(msg)
        if not article:
            names = []
            for part in msg.walk():
                if part.is_multipart():
                    continue
                name = decode_header_value(part.get_filename() or "")
                if name:
                    names.append(name)
            if names and not args.dry_run:
                digest = hashlib.sha1(
                    ((head_msg.get("Message-ID") or "") + clean_title(head_msg.get("Subject"))).encode("utf-8")
                ).hexdigest()[:12]
                note = INBOX_DIR / f"_skip-{digest}.md"
                note.write_text(
                    "# 未自动收录的投稿\n\n"
                    f"- 标题：{clean_title(head_msg.get('Subject'))}\n"
                    f"- 发件人：{decode_header_value(head_msg.get('From'))}\n"
                    f"- 时间：{head_msg.get('Date')}\n"
                    f"- 附件：{', '.join(names)}\n\n"
                    "正文为空，或只有图片/不支持的附件。请把文字直接粘在邮件正文里，"
                    "或改发 txt / docx / pdf。\n",
                    encoding="utf-8",
                )
                log(f"正文为空，已留待处理说明：{note.name}（附件：{', '.join(names)}）")
            else:
                log(f"跳过（正文为空）：{clean_title(head_msg.get('Subject'))}")
            if message_id and not args.dry_run:
                state.add(message_id)
            continue

        matched += 1
        log(f"收录：{article['title']}（{len(article['body'])} 段，约 {article['minutes']} 分钟）")
        if args.dry_run:
            continue
        target = INBOX_DIR / f"{article['id']}.json"
        target.write_text(json.dumps([article], ensure_ascii=False, indent="\t"), encoding="utf-8")
        if message_id:
            state.add(message_id)
        added += 1

    client.logout()
    if not args.dry_run:
        save_state(state)
    log(f"完成：命中 {matched} 封，新增 {added} 篇草稿" + ("（dry-run，未写文件）" if args.dry_run else ""))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        log(f"运行失败：{type(exc).__name__}: {exc}")
        sys.exit(1)
