#!/usr/bin/env python3
"""git commit / git push の直前に、巻き戻り防止ガード（tests/guard.py）を自動で走らせるフック。

2026-09-19 設置。M1/M4 の2台運用で、古い版の上で作業したり、Dropbox が古いファイルを
書き戻したりして、一度入れた修正が消える事故が何度も起きたため。
ガードが NG を出したら、コミット/push は実行されない。
"""
import json
import os
import re
import subprocess
import sys

ROLLBACK_TAG = "[意図的な巻き戻し]"
GIT_OP = re.compile(r"\bgit\s+(?:-C\s+(?:\"[^\"]*\"|'[^']*'|\S+)\s+)?(commit|push)\b")


def main() -> int:
    try:
        cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
    except Exception:
        return 0
    ops = set()
    for line in cmd.splitlines():
        for m in GIT_OP.finditer(line.split("#", 1)[0]):
            ops.add(m.group(1))
    if not ops:
        return 0

    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    guard = os.path.join(root, "tests", "guard.py")
    if not os.path.exists(guard):
        return 0
    args = ["python3", guard]
    if "push" in ops:
        args.append("--push")
    if ROLLBACK_TAG in cmd:
        args.append("--allow-rollback")
    r = subprocess.run(args, cwd=root, capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        sys.stderr.write(r.stdout + r.stderr)
        sys.stderr.write("\n→ 直してから、もう一度コミット/pushすること。ガードを外したり回避したりしないこと。\n")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
