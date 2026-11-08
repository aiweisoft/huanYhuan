#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
邮箱总管：一个任务，10 分钟一轮，按顺序做三件事

1. 收内容投稿（主题不是知智快报的）→ docs/import/inbox
2. 处理「缓一缓」投稿：改写 + 导入草稿
3. 处理知智快报指令：做/发第 N 条

这样只保留一个计划任务，避免多个任务同时醒来、重复连邮箱。
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
LOG_FILE = TOOLS / "mail-hub.log"
LOCK_FILE = TOOLS / ".mail-hub.lock"
ZHIZHI_CMD = Path(r"E:\ai-content-ops\tools\邮件指令.py")
CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0


def log(message):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}"
    print(line)
    try:
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def pid_alive(pid):
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.OpenProcess(0x1000, False, pid)
        if handle:
            kernel32.CloseHandle(handle)
            return True
    except Exception:
        pass
    return False


def acquire_lock():
    if LOCK_FILE.exists():
        try:
            pid = int(LOCK_FILE.read_text(encoding="utf-8").strip())
            if pid_alive(pid):
                return False
        except Exception:
            pass
    LOCK_FILE.write_text(str(os.getpid()), encoding="utf-8")
    return True


def release_lock():
    try:
        LOCK_FILE.unlink()
    except OSError:
        pass


def run_step(name, script, timeout):
    if not script.exists():
        log(f"跳过 {name}：{script.name} 不存在")
        return 0
    log(f"开始 {name}")
    started = time.time()
    try:
        proc = subprocess.run(
            [sys.executable, str(script)],
            cwd=str(ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            creationflags=CREATE_NO_WINDOW,
            env=dict(os.environ, PYTHONIOENCODING="utf-8"),
        )
        output = (proc.stdout or b"").decode("utf-8", "ignore").strip()
        for line in output.splitlines()[-6:]:
            log(f"  {line}")
        log(f"完成 {name}（{time.time() - started:.1f}s，退出码 {proc.returncode}）")
        return proc.returncode
    except subprocess.TimeoutExpired:
        log(f"超时 {name}（{timeout}s）")
        return 1
    except Exception as exc:
        log(f"失败 {name}：{type(exc).__name__}: {exc}")
        return 1


def main():
    if not acquire_lock():
        log("上一轮还没跑完，跳过")
        return
    try:
        log("==== 邮箱总管开始 ====")
        run_step("收内容投稿", TOOLS / "mail-inbox.py", 300)
        zhizhi = ZHIZHI_CMD if ZHIZHI_CMD.exists() else None
        if zhizhi:
            log("开始 知智邮件指令")
            try:
                proc = subprocess.run(
                    [sys.executable, str(zhizhi)],
                    cwd=str(ZHIZHI_CMD.parent.parent),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    timeout=300,
                    creationflags=CREATE_NO_WINDOW,
                    env=dict(os.environ, PYTHONIOENCODING="utf-8"),
                )
                output = (proc.stdout or b"").decode("utf-8", "ignore").strip()
                for line in output.splitlines()[-6:]:
                    log(f"  {line}")
                log(f"完成 知智邮件指令（退出码 {proc.returncode}）")
            except Exception as exc:
                log(f"知智邮件指令失败：{type(exc).__name__}: {exc}")
        run_step("处理缓一缓投稿", TOOLS / "process-huanhuan.py", 25 * 60)
        log("==== 邮箱总管结束 ====")
    finally:
        release_lock()


if __name__ == "__main__":
    main()
