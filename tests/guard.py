#!/usr/bin/env python3
"""巻き戻り防止ガード（M1 / M4 どちらのMacでも動く）

コミット・push の前に自動で実行され（.claude/hooks/regression-guard.py から呼ばれる）、
1つでも引っかかったら止める。手動でも実行できる:

    python3 tests/guard.py            # 今の作業フォルダをチェック
    python3 tests/guard.py --push     # push しようとしているコミットもチェック

チェック内容:
  1. 機能チェックリスト … これまでの修正の「目印」がコードに残っているか
  2. 巻き戻り検出     … 変更したファイルが、過去のどこかの版とまったく同じ中身に戻っていないか
                         （Dropbox が古い版を書き戻した 2026-09-04 の事故のパターン）
  3. 古い土台の検出   … GitHub より遅れた状態でコミット／push しようとしていないか
  4. 日付計算のテスト … 赤ポチの「3日前から表示」が、どの年・月・タイムゾーンでも正しいか

機能を「わざと」消したり変えたりする時は、下の FEATURES から該当行を消すか直すこと。
過去の版に「わざと」戻す時は、コミットメッセージに [意図的な巻き戻し] と書くこと。
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REMOTE = "github"
BRANCH = "main"
ROLLBACK_TAG = "[意図的な巻き戻し]"

T = "trainer-reserve.html"
C = "client.html"
J = "common.js"

# (機能名, ファイル, コードに必ず含まれているべき文字列)
FEATURES = [
    # --- 予約0件の赤ポチ（2026-08-22 作成 / 2026-09-19 3日前ルール・赤ポチ化） ---
    ("赤ポチ: 3日前から表示", T, "var ZERO_DAY_MARK_DAYS=3;"),
    ("赤ポチ: 表示条件", T, "_daysAhead(d)<=ZERO_DAY_MARK_DAYS"),
    ("赤ポチ: 丸い見た目", T, "border-radius:50%;background:#dc143c"),
    ("赤ポチ: 押すとクローズ確認", T, "openZeroDayDialog"),
    ("赤ポチ: クローズ直前の予約再確認", T, "この日に予約が入ったため、クローズしませんでした"),
    ("赤ポチ: 枠数はボタンの数で数える", T, "return n+slotSets[k].size"),
    # --- コスト集計（2026-08-22） ---
    ("コスト: 交通費2068円", T, "var TRANSIT_COST=2068"),
    ("コスト: 施設利用料", T, "施設利用料"),
    ("コスト: 交通費は1日1回", T, "1日1回まで"),
    # --- メモ（2026-06-12 作成 / 08-02 全期間 / 08-22 過去も表示） ---
    ("メモ: 保存先", T, "trainer_memos"),
    ("メモ: 追加", T, "openMemoAddModal"),
    ("メモ: 削除", T, "openMemoDeleteDialog"),
    ("メモ: 全期間を読み込む", T, "from('trainer_memos').select('*').order('date_key',{ascending:true})"),
    ("メモ: 過去の日程にも表示", T, "_memo&&!(past&&bk)"),
    # --- 空き枠カウント（2026-08-26） ---
    ("空き枠カウント: 移動ブロックで潰れた時間を除外", T,
     "[...slotSets[k]].some(function(ml){return !(blockedSlots[k]&&blockedSlots[k].has(ml));})"),
    # --- 見た目 ---
    ("ロゴ: Trainer をオレンジ", T, "color:#f97316"),
    ("ロゴ: Reserve を水色", T, "logo span{color:#87ceeb;}"),
    ("ヘッダー画像: 17枚ランダム", T, "pic/unk.gif"),
    ("予約のみ表示ボタン", T, "予約のみ表示"),
    ("日付ヘッダーで縦列一括選択", T, "toggleDateColumn"),
    ("カスタムダイアログ(トレーナー)", T, "openActionDialog"),
    ("キャンセルダイアログ(トレーナー)", T, "openCancelDialog"),
    ("回数券ログ", T, "ticket_logs"),
    ("移動時間ブロック(トレーナー)", T, "_recomputeBlockedSlots"),
    ("Safari下切れ対策(トレーナー)", T, "viewport-fit=cover"),
    ("キャッシュ対策(トレーナー)", T, "no-cache, no-store"),
    # --- お客様画面 ---
    ("当日予約不可", C, "当日予約はできません"),
    ("移動時間ブロック(お客様)", C, "移動時間のため予約できません"),
    ("回数券不足チェック", C, "回数券が無いため予約できません"),
    ("二重予約チェック", C, "この枠はすでに予約済みです"),
    ("当日キャンセルは回数券消化", C, "cancel_sameday"),
    ("キャンセル済みの再キャンセル防止", C, "chk.data.status==='cancelled'"),
    ("キャンセルダイアログ(お客様)", C, "openCancelDialog"),
    ("ログアウト確認", C, "ログアウトしますか？"),
    ("移動時間ブロック(お客様)の再計算", C, "_recomputeBlockedSlots"),
    ("Safari下切れ対策(お客様)", C, "viewport-fit=cover"),
    ("キャッシュ対策(お客様)", C, "no-cache, no-store"),
    # --- 共通 ---
    ("予約保存はupsert", J, "onConflict:'date_key'"),
    ("時刻を過ぎた枠の判定", J, "function isPastSlot"),
    ("祝日の予備リスト", J, "HOLIDAYS_FALLBACK"),
    ("お着替え込みの表記", J, "お着替え"),
    # --- 安全装置そのもの ---
    ("安全装置: 強制pushブロック", ".claude/hooks/block-force-push.py", "def main"),
    ("安全装置: 起動時の自動同期", ".claude/hooks/sync-check.sh", "merge --ff-only"),
    ("安全装置: 巻き戻り防止フック", ".claude/hooks/regression-guard.py", "tests/guard.py"),
]
REQUIRED_FILES = ["manual/index.html"]


def git(*args, check=False):
    r = subprocess.run(["git", "-C", ROOT] + list(args), capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(r.stderr.strip())
    return r


def read_worktree(path):
    p = os.path.join(ROOT, path)
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8", errors="replace") as f:
        return f.read()


def read_index(path):
    r = git("show", ":" + path)
    return r.stdout if r.returncode == 0 else None


def read_head(path):
    r = git("show", "HEAD:" + path)
    return r.stdout if r.returncode == 0 else None


def check_features():
    errors = []
    for name, path, needle in FEATURES:
        wt, idx = read_worktree(path), read_index(path)
        targets = [("作業フォルダ", wt)]
        # ステージに、作業フォルダともHEADとも違う中身が入ってる時だけ、それも確認する
        # （git add 前の古いステージを誤って NG にしないため）
        if idx is not None and idx != wt and idx != read_head(path):
            targets.append(("ステージ済み", idx))
        for where, content in targets:
            if content is None:
                errors.append(f"{name}: {path} が無い")
                continue
            if needle not in content:
                errors.append(f"{name}: {path}（{where}）から消えている → 「{needle[:40]}」")
    for path in REQUIRED_FILES:
        if not os.path.exists(os.path.join(ROOT, path)):
            errors.append(f"必須ファイルが無い: {path}")
    return sorted(set(errors))


def historical_blobs(path, until="HEAD"):
    """そのファイルが過去に取ったことのある全ての中身（ブロブID）"""
    r = git("log", "--raw", "--no-abbrev", "--format=", until, "--", path)
    blobs = set()
    for line in r.stdout.splitlines():
        if line.startswith(":"):
            parts = line.split()
            if len(parts) >= 4:
                blobs.update(parts[2:4])
    blobs.discard("0" * 40)
    return blobs


def check_rollback_worktree():
    """これからコミットする変更が、過去の版への丸ごと巻き戻しになっていないか"""
    errors = []
    head_ok = git("rev-parse", "--verify", "HEAD").returncode == 0
    if not head_ok:
        return errors
    changed = set(git("diff", "--name-only", "HEAD").stdout.split("\n"))
    changed |= set(git("diff", "--name-only", "--cached", "HEAD").stdout.split("\n"))
    for path in sorted(p for p in changed if p):
        head_blob = git("rev-parse", "HEAD:" + path).stdout.strip()
        candidates = set()
        if os.path.isfile(os.path.join(ROOT, path)):
            candidates.add(git("hash-object", os.path.join(ROOT, path)).stdout.strip())
        idx = git("rev-parse", ":" + path)
        if idx.returncode == 0:
            candidates.add(idx.stdout.strip())
        old = historical_blobs(path) - {head_blob}
        for b in candidates:
            if b and b != head_blob and b in old:
                found = git("log", "--reverse", "--format=%h %ad %s", "--date=short", "--find-object=" + b).stdout.splitlines()
                when = found[0].strip() if found else ""
                errors.append(f"{path} が過去の版に丸ごと戻っている（{when or '過去のコミット'} の時点と同じ中身）")
    return errors


def check_rollback_commits(base):
    """push しようとしているコミットの中に、過去の版への巻き戻しが混ざっていないか"""
    errors = []
    for c in git("rev-list", "--reverse", f"{base}..HEAD").stdout.split():
        msg = git("log", "-1", "--format=%B", c).stdout
        if msg.startswith("Revert") or ROLLBACK_TAG in msg:
            continue
        parent = git("rev-parse", c + "^").stdout.strip()
        for line in git("diff-tree", "--no-commit-id", "-r", "--raw", "--no-abbrev", c).stdout.splitlines():
            parts = line.split("\t")
            meta = parts[0].split()
            if len(meta) < 5 or len(parts) < 2:
                continue
            old_blob, new_blob, path = meta[2], meta[3], parts[-1]
            if new_blob == "0" * 40:
                continue
            if new_blob in historical_blobs(path, parent) - {old_blob}:
                subj = git("log", "-1", "--format=%h %s", c).stdout.strip()
                errors.append(f"コミット {subj} で {path} が過去の版に丸ごと戻っている")
    return errors


def check_base():
    """GitHub より遅れた状態・分岐した状態でコミット/push していないか"""
    r = git("fetch", REMOTE, "--quiet")
    if r.returncode != 0:
        return [], "GitHub に繋がらなかったので、遅れのチェックは省略した"
    remote = f"{REMOTE}/{BRANCH}"
    if git("rev-parse", "--verify", remote).returncode != 0:
        return [], None
    behind = git("rev-list", "--count", f"HEAD..{remote}").stdout.strip()
    if behind and behind != "0":
        return [f"GitHub の方が {behind}件 進んでいる（もう一台のMacで作業した跡）。"
                f"先に git pull {REMOTE} {BRANCH} で取り込むこと"], None
    return [], None


def check_logic():
    script = os.path.join(ROOT, "tests", "zero_day_logic.js")
    html = os.path.join(ROOT, T)
    if not os.path.exists(script):
        return ["日付計算テスト(tests/zero_day_logic.js)が無い"], []
    results, errors = [], []
    if shutil.which("node"):
        runs = [(["node", script, html], {"TZ": tz}) for tz in
                ("Asia/Tokyo", "America/New_York", "Europe/London", "Australia/Sydney")]
    else:
        runs = [(["osascript", "-l", "JavaScript", script, html], {})]
    for cmd, env in runs:
        r = subprocess.run(cmd, capture_output=True, text=True, env=dict(os.environ, **env), timeout=120)
        out = (r.stdout.strip() or r.stderr.strip())
        results.append(out.splitlines()[0] if out else "(出力なし)")
        if r.returncode != 0 or not out.startswith("OK"):
            errors.append("日付計算テスト失敗: " + out)
    return errors, results


def main():
    push_mode = "--push" in sys.argv
    allow_rollback = "--allow-rollback" in sys.argv
    errors, notes = [], []

    errors += check_features()
    if not allow_rollback:
        errors += check_rollback_worktree()
    base_err, note = check_base()
    errors += base_err
    if note:
        notes.append(note)
    if push_mode and not base_err:
        base = f"{REMOTE}/{BRANCH}"
        if git("rev-parse", "--verify", base).returncode == 0 and not allow_rollback:
            errors += check_rollback_commits(base)
    logic_err, logic_res = check_logic()
    errors += logic_err

    print(f"[巻き戻り防止ガード] 機能チェック {len(FEATURES)}項目 / 日付計算 {', '.join(logic_res) or '-'}")
    for n in notes:
        print("  注意: " + n)
    if errors:
        print("NG: 巻き戻り・消失の可能性がある。止めた。")
        for e in errors:
            print("  - " + e)
        print("わざと消した・戻した場合: 機能なら tests/guard.py の FEATURES を直す。"
              f"過去の版に戻すならコミットメッセージに {ROLLBACK_TAG} と書く。")
        return 1
    print("OK: 巻き戻りなし")
    return 0


if __name__ == "__main__":
    sys.exit(main())
