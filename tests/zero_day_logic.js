// 予約0件マーカー（赤ポチ）の「3日前から表示」判定のテスト。
// trainer-reserve.html から本物の関数を取り出して、偽の時計で動かす。
// Node でも macOS 標準の osascript (JavaScript for Automation) でも動く。
//
// 使い方: node tests/zero_day_logic.js <trainer-reserve.htmlの中身のファイルパス>
//         osascript -l JavaScript tests/zero_day_logic.js <同上>

function readText(path) {
  if (typeof require === 'function') return require('fs').readFileSync(path, 'utf8');
  // osascript (JXA)
  var s = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
  return ObjC.unwrap(s);
}

function runTests(html) {
  var fails = [];
  var mDays = html.match(/var ZERO_DAY_MARK_DAYS=(\d+);/);
  var mFn = html.match(/function _daysAhead\(d\)\{[\s\S]*?return Math\.round\([^;]*\);\}/);
  if (!mDays) return ['ZERO_DAY_MARK_DAYS の定義が見つからない'];
  if (!mFn) return ['_daysAhead 関数が見つからない'];
  var LIMIT = parseInt(mDays[1], 10);
  if (LIMIT !== 3) fails.push('表示開始が3日前になっていない（今は' + LIMIT + '日前）');

  var RealDate = Date;
  var NOW = 0;
  function FakeDate(a, b, c, d, e, f, g) {
    if (arguments.length === 0) return new RealDate(NOW);
    if (arguments.length === 1) return new RealDate(a);
    return new RealDate(a, b, c || 1, d || 0, e || 0, f || 0, g || 0);
  }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = function () { return NOW; };
  var daysAhead = new Function('Date', mFn[0] + '; return _daysAhead;')(FakeDate);

  function at(y, mo, d, h, mi, s) { return new RealDate(y, mo, d, h, mi, s).getTime(); }
  function label(y, mo, d) { return y + '/' + (mo + 1) + '/' + d; }

  // 2026/1/1 〜 2035/12/31 の毎日について、境目の時刻で判定する
  var count = 0;
  for (var t = new RealDate(2026, 0, 1); t.getFullYear() <= 2035; t = new RealDate(t.getFullYear(), t.getMonth(), t.getDate() + 1)) {
    var y = t.getFullYear(), mo = t.getMonth(), d = t.getDate();
    var target = new RealDate(y, mo, d);
    var cases = [
      [at(y, mo, d - 4, 23, 59, 59), 4, false], // 4日前の23:59:59 → まだ出ない
      [at(y, mo, d - 3, 0, 0, 0), 3, true],     // 3日前の0:00 → 出る
      [at(y, mo, d - 3, 12, 0, 0), 3, true],
      [at(y, mo, d - 1, 23, 59, 59), 1, true],
      [at(y, mo, d, 0, 0, 0), 0, true],         // 当日
      [at(y, mo, d, 23, 59, 59), 0, true]
    ];
    for (var i = 0; i < cases.length; i++) {
      NOW = cases[i][0];
      var got = daysAhead(target);
      var shown = got <= LIMIT;
      count++;
      if (got !== cases[i][1] || shown !== cases[i][2]) {
        if (fails.length < 10) fails.push(label(y, mo, d) + ' を ' + new RealDate(NOW).toString() + ' に判定 → ' + got + '日後（期待 ' + cases[i][1] + '日後）');
      }
    }
  }
  // うるう日
  NOW = at(2028, 1, 26, 0, 0, 0);
  if (daysAhead(new RealDate(2028, 1, 29)) !== 3) fails.push('うるう年 2028/2/29 の3日前判定がずれている');
  NOW = at(2028, 1, 29, 10, 0, 0);
  if (daysAhead(new RealDate(2028, 2, 3)) !== 3) fails.push('うるう年 2/29 → 3/3 がずれている');
  // 年またぎ
  NOW = at(2026, 11, 29, 0, 0, 0);
  if (daysAhead(new RealDate(2027, 0, 1)) !== 3) fails.push('年またぎ 12/29 → 1/1 がずれている');
  NOW = at(2026, 11, 28, 23, 59, 59);
  if (daysAhead(new RealDate(2027, 0, 1)) !== 4) fails.push('年またぎ 12/28 23:59 → 1/1 がずれている');

  return { fails: fails, count: count };
}

function main(args) {
  var r = runTests(readText(args[0]));
  if (Array.isArray(r)) r = { fails: r, count: 0 };
  var tz = (typeof process !== 'undefined' && process.env.TZ) ? process.env.TZ : 'system';
  if (r.fails.length) return 'NG [' + tz + '] ' + r.fails.length + '件\n  ' + r.fails.join('\n  ');
  return 'OK [' + tz + '] ' + r.count + '通りの日時で判定が正しい';
}

if (typeof require === 'function' && typeof process !== 'undefined') {
  var out = main(process.argv.slice(2));
  console.log(out);
  process.exit(out.indexOf('OK') === 0 ? 0 : 1);
}

// osascript 用の入口
function run(argv) { return main(argv); }
