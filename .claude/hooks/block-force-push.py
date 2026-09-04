#!/usr/bin/env python3
"""force push を機械的にブロックするフック。

2026-09-04: M1/M4 の2台運用で force push により
コスト集計・交通費・メモ機能の9コミットが GitHub 上から消えた事故の再発防止。

判定は「行単位」かつ「# 以降のコメントを除外」して行う。
説明文やドキュメント内の記述で誤爆しないようにするため。
--force-with-lease（安全な方）は通す。
"""
import json
import re
import sys

MESSAGE = """【ブロック】force push は禁止。

理由: 2026-08-26 の事故。強制上書きで GitHub 上の9コミット
（コスト集計・交通費・メモ機能）が消えた。
強制上書きは「相手の履歴を消して自分で上書きしろ」という命令。
2台のMacで作業してるこのリポジトリでは、必ずもう一台の作業を消す。

正しい手順:
  1. git fetch github
  2. git merge github/main       ← 両方の作業が残る
  3. git push github main        ← 旗を付けずに素で実行

どうしても強制したいなら --force-with-lease を使うか、
りりか本人にターミナルで実行してもらうこと。
"""

# --force / -f / +refspec を検出。--force-with-lease は除外。
FORCE = re.compile(r"--force(?![-\w])|(?<=\s)-f(?=\s|$)|(?<=\s)\+[\w./-]+:")
PUSH = re.compile(r"\bgit\s+push\b")


def main() -> int:
    try:
        cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
    except Exception:
        return 0
    if not cmd:
        return 0
    for line in cmd.splitlines():
        if not PUSH.search(line):
            continue
        segment = line.split("#", 1)[0]
        if FORCE.search(segment):
            sys.stderr.write(MESSAGE)
            return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
