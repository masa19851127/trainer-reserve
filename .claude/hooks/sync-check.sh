#!/bin/bash
# セッション開始時に GitHub と自動で同期する。
# ・遅れてるだけ → 自動で取り込む（早送りのみ・履歴は書き換えない）
# ・分岐してる   → 声を大きくして警告（もう一台で作業した合図）
# ・未pushあり   → push忘れを警告
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
git fetch github --quiet 2>/dev/null || { echo "【同期】GitHub に繋がらなかった。オフラインかも。作業前に git fetch github を試して。"; exit 0; }
counts=$(git rev-list --left-right --count github/main...HEAD 2>/dev/null) || exit 0
behind=$(printf '%s' "$counts" | awk '{print $1}')
ahead=$(printf '%s' "$counts" | awk '{print $2}')
dirty=$(git status --porcelain -uno)
if [ "$behind" -gt 0 ] && [ "$ahead" -gt 0 ]; then
  echo "【最重要・履歴が分岐してる】GitHubのみ ${behind}件 / ローカルのみ ${ahead}件。"
  echo "もう一台のMacで作業した合図。git merge github/main で必ず合流させること。"
  echo "絶対に --force で push しないこと（過去に9コミット消えた事故あり）。"
elif [ "$behind" -gt 0 ]; then
  if [ -z "$dirty" ]; then
    if git merge --ff-only github/main >/dev/null 2>&1; then
      echo "【自動同期】もう一台の作業 ${behind}件 を GitHub から取り込んだ。最新の状態で作業してOK。"
    else
      echo "【警告】GitHubに ${behind}件 の新しい変更あり。自動取り込みに失敗したので git merge github/main を実行して。"
    fi
  else
    echo "【警告】GitHubに ${behind}件 の新しい変更あり。未コミットの変更があるので自動取り込みは見送った。先にコミットしてから git merge github/main すること。"
  fi
elif [ "$ahead" -gt 0 ]; then
  echo "【未push】ローカルに ${ahead}件 の未pushコミットあり。作業が終わったら git push github main（--force なし）。"
fi
exit 0
