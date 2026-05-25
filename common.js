// === Trainer Reserve 共通定数 ===

// 時間枠（10:00〜21:00）
const TIMES=[];
for(var h=10;h<=21;h++) TIMES.push(h+':00');

// 曜日表記
const DJ=['日','月','火','水','木','金','土'];

// 場所
const LOCS={meguro:'目黒',yokohama:'横浜',ebisu:'恵比寿'};

// メニュー
const MENUS={pilates:'ピラティス',training:'パーソナルトレーニング'};

// メニューごとの利用可能な場所
const ML={pilates:['meguro','yokohama'],training:['ebisu','yokohama']};

// タグのCSSクラス
const TC={'pilates-meguro':'stag-pm','pilates-yokohama':'stag-py','training-ebisu':'stag-te','training-yokohama':'stag-ty'};

// タグの表示ラベル
const TL={'pilates-meguro':'P・目黒','pilates-yokohama':'P・横浜','training-ebisu':'T・恵比寿','training-yokohama':'T・横浜'};

// 予約済みセルのCSSクラス
const BKC={'pilates-meguro':'t-bk-pm','pilates-yokohama':'t-bk-py','training-yokohama':'t-bk-ty','training-ebisu':'t-bk-te'};

// 予約済みセルのテキスト色クラス
const BLC={'pilates-meguro':'bl-pm','pilates-yokohama':'bl-py','training-yokohama':'bl-ty','training-ebisu':'bl-te'};

// メニュー・場所ごとの色（背景・ボーダー・文字色）
const MLCOL={
  'pilates-meguro':{bg:'#f3e8ff',bd:'#d8b4fe',tc:'#6b21a8'},
  'pilates-yokohama':{bg:'#dcfce7',bd:'#86efac',tc:'#166534'},
  'training-yokohama':{bg:'#e0f2fe',bd:'#7dd3fc',tc:'#0369a1'},
  'training-ebisu':{bg:'#fce7f3',bd:'#f9a8d4',tc:'#9d174d'}
};

// 場所タグのCSSクラス
const LTAG={meguro:'tag-meguro',yokohama:'tag-yokohama',ebisu:'tag-ebisu'};

// メニュータグのCSSクラス
const MTAG={pilates:'tag-pilates',training:'tag-training'};

// 祝日のフォールバック（Google Calendar APIが使えない時用）
const HOLIDAYS_FALLBACK=['2025-01-01','2025-01-13','2025-02-11','2025-02-23','2025-02-24','2025-03-20','2025-04-29','2025-05-03','2025-05-04','2025-05-05','2025-05-06','2025-07-21','2025-08-11','2025-09-15','2025-09-23','2025-10-13','2025-11-03','2025-11-23','2025-11-24','2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20','2026-04-29','2026-05-03','2026-05-04','2026-05-05','2026-05-06','2026-07-20','2026-08-11','2026-09-21','2026-09-22','2026-09-23','2026-10-12','2026-11-03','2026-11-23','2027-01-01','2027-01-11','2027-02-11','2027-02-23','2027-03-21','2027-03-22','2027-04-29','2027-05-03','2027-05-04','2027-05-05','2027-07-19','2027-08-11','2027-09-20','2027-09-23','2027-10-11','2027-11-03','2027-11-23'];
