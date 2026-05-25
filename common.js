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

// === Trainer Reserve 共通ユーティリティ関数 ===

// 日付を 'YYYY-MM-DD' 形式に変換
function localISO(d){
  var y=d.getFullYear();
  var m=String(d.getMonth()+1).padStart(2,'0');
  var dd=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+dd;
}

// セルキー生成（localISO(date)+'_'+time）
function ck(d,t){return localISO(d)+'_'+t;}

// 終了時刻計算（'10:00' → '11:00'）
function et(t){return (parseInt(t)+1)+':00';}

// 月/日 形式の文字列
function fmt(d){return (d.getMonth()+1)+'/'+d.getDate();}

// 週の日付配列（月曜始まり、トレーナー用）
function wkDates(o){
  var n=new Date(),dy=n.getDay(),m=new Date(n);
  m.setDate(n.getDate()-(dy===0?6:dy-1)+o*7);
  var a=[];
  for(var i=0;i<7;i++){var d=new Date(m);d.setDate(m.getDate()+i);a.push(d);}
  return a;
}

// 週の日付配列（今日始まり、お客様用）
function clientWkDates(o){
  var n=new Date();n.setHours(0,0,0,0);
  var a=[];
  for(var i=0;i<7;i++){var d=new Date(n);d.setDate(n.getDate()+o*7+i);a.push(d);}
  return a;
}

// 過去日判定
function isPast(d){
  var t=new Date();t.setHours(0,0,0,0);
  var x=new Date(d);x.setHours(0,0,0,0);
  return x<t;
}

// 過去スロット判定（iso日付＋時刻文字列が現在時刻より過去か）
function isPastSlot(iso,t){
  var slotDate=new Date(iso+'T'+t+':00');
  return slotDate<new Date();
}

// 当日判定
function isToday(d){return d.toDateString()===new Date().toDateString();}

// 当日判定（ISO文字列版）
function isTodayStr(iso){return new Date(iso).toDateString()===new Date().toDateString();}

// メニュー・場所のフルラベル（'training-ebisu' → 'トレーニング：恵比寿'）
function _fullLabel(ml){
  var p=ml.split('-');
  var ms=p[0]==='training'?'トレーニング':'ピラティス';
  return ms+'：'+(LOCS[p[1]]||p[1]);
}

// === Trainer Reserve Supabaseクライアント ===

const SB_URL='https://lxcfkcmqnlueacxagemn.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4Y2ZrY21xbmx1ZWFjeGFnZW1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMTg5MDksImV4cCI6MjA5Mzg5NDkwOX0._6BmtsxKMuOMbO3zOWQl-IEkcbcpRyzAZSWhk5-6Pgs';
const sb=supabase.createClient(SB_URL,SB_KEY);

// === DB操作関数 ===

async function saveSlot(k,menu,loc){await sb.from('slots').insert({date_key:k,menu:menu,loc:loc,is_off:false});}
async function saveOffSlot(k){await sb.from('slots').delete().eq('date_key',k);await sb.from('slots').insert({date_key:k,menu:null,loc:null,is_off:true});}
async function deleteSlot(k,m,l){await sb.from('slots').delete().match({date_key:k,menu:m,loc:l});}
async function deleteAllSlots(k){await sb.from('slots').delete().eq('date_key',k);}
async function saveDayOff(iso){await sb.from('day_offs').upsert({date_iso:iso},{onConflict:'date_iso'});await sb.from('slots').delete().like('date_key',iso+'%');}
async function deleteDayOff(iso){await sb.from('day_offs').delete().eq('date_iso',iso);}
async function saveBooking(k,menu,loc,name,email,phone,msg){var r=await sb.from('bookings').insert({date_key:k,menu:menu,loc:loc,name:name,email:email,phone:phone,message:msg});return !r.error;}
async function deleteBooking(k){await sb.from('bookings').update({status:'cancelled'}).eq('date_key',k);}

// === メール送信 ===

async function sendMail(to,subject,html,text){
  try{await fetch(SB_URL+'/functions/v1/send-email',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_KEY},body:JSON.stringify({to:to,subject:subject,html:html,text:text||''})});}
  catch(e){console.log('mail err',e);}
}
function mailHtmlClient(name,ds,t,menu,loc){
  return '<div style="font-family:sans-serif;max-width:500px;margin:0 auto"><div style="background:#c2410c;padding:20px 24px"><div style="font-size:18px;font-weight:bold;color:#fff">Trainer Reserve</div><div style="font-size:12px;color:rgba(255,255,255,.75)">ご予約確認</div></div><div style="padding:24px"><p style="font-size:14px;margin:0 0 16px">'+name+' 様</p><table style="width:100%;border-collapse:collapse;background:#f5f5f5;border-radius:8px;margin-bottom:20px"><tr><td style="padding:10px 14px;color:#666;width:80px">日時</td><td style="padding:10px 14px;font-weight:bold">'+ds+'<br><span style="white-space:nowrap">'+t+'〜'+et(t)+'</span></td></tr><tr><td style="padding:10px 14px;color:#666;border-top:1px solid #e5e5e5">メニュー</td><td style="padding:10px 14px;font-weight:bold;border-top:1px solid #e5e5e5">'+MENUS[menu]+'</td></tr><tr><td style="padding:10px 14px;color:#666;border-top:1px solid #e5e5e5">場所</td><td style="padding:10px 14px;font-weight:bold;border-top:1px solid #e5e5e5">'+LOCS[loc]+'</td></tr></table><p style="font-size:13px;color:#666;line-height:1.7;margin:0">当日はお気をつけてお越しください。</p></div><div style="border-top:1px solid #e5e5e5;padding:14px 24px"><p style="font-size:12px;margin:0 0 8px"><a href="https://masa19851127.github.io/trainer-reserve/client.html" style="color:#c2410c;text-decoration:none">予約・確認はこちら →</a></p><p style="font-size:11px;color:#999;margin:0">このメールはTrainer Reserveより自動送信されています。</p></div></div>';
}
function mailHtmlTrainer(name,ds,t,menu,loc,phone,msg){
  return '<div style="font-family:sans-serif;max-width:500px;margin:0 auto"><div style="background:#1a1a2e;padding:20px 24px"><div style="font-size:18px;font-weight:bold;color:#fff">新規予約のお知らせ</div><div style="font-size:12px;color:rgba(255,255,255,.6)">Trainer Reserve</div></div><div style="padding:24px"><table style="width:100%;border-collapse:collapse;background:#f5f5f5;border-radius:8px"><tr><td style="padding:10px 14px;color:#666;width:80px">日時</td><td style="padding:10px 14px;font-weight:bold">'+ds+'<br><span style="white-space:nowrap">'+t+'〜'+et(t)+'</span></td></tr><tr><td style="padding:10px 14px;color:#666;border-top:1px solid #e5e5e5">メニュー</td><td style="padding:10px 14px;font-weight:bold;border-top:1px solid #e5e5e5">'+MENUS[menu]+'</td></tr><tr><td style="padding:10px 14px;color:#666;border-top:1px solid #e5e5e5">場所</td><td style="padding:10px 14px;font-weight:bold;border-top:1px solid #e5e5e5">'+LOCS[loc]+'</td></tr><tr><td style="padding:10px 14px;color:#666;border-top:1px solid #e5e5e5">お客様</td><td style="padding:10px 14px;font-weight:bold;border-top:1px solid #e5e5e5">'+name+' 様</td></tr><tr><td style="padding:10px 14px;color:#666;border-top:1px solid #e5e5e5">電話番号</td><td style="padding:10px 14px;border-top:1px solid #e5e5e5">'+(phone||'未入力')+'</td></tr><tr><td style="padding:10px 14px;color:#666;border-top:1px solid #e5e5e5">メッセージ</td><td style="padding:10px 14px;border-top:1px solid #e5e5e5">'+(msg||'なし')+'</td></tr></table></div></div>';
}
function mailHtmlCancel(name,ds,t,menu,loc,sameDay){
  return '<div style="font-family:sans-serif;max-width:500px;margin:0 auto"><div style="background:#64748b;padding:20px 24px"><div style="font-size:18px;font-weight:bold;color:#fff">Trainer Reserve</div><div style="font-size:12px;color:rgba(255,255,255,.75)">予約キャンセルのお知らせ</div></div><div style="padding:24px"><p style="font-size:14px;margin:0 0 16px">'+name+' 様</p><table style="width:100%;border-collapse:collapse;background:#f5f5f5;border-radius:8px;margin-bottom:16px"><tr><td style="padding:10px 14px;color:#666;width:80px">日時</td><td style="padding:10px 14px;font-weight:bold">'+ds+'<br><span style="white-space:nowrap">'+t+'〜'+et(t)+'</span></td></tr><tr><td style="padding:10px 14px;color:#666;border-top:1px solid #e5e5e5">メニュー</td><td style="padding:10px 14px;border-top:1px solid #e5e5e5">'+MENUS[menu]+'</td></tr><tr><td style="padding:10px 14px;color:#666;border-top:1px solid #e5e5e5">場所</td><td style="padding:10px 14px;border-top:1px solid #e5e5e5">'+LOCS[loc]+'</td></tr></table>'+(sameDay?'<div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px;font-size:12px;color:#854d0e">当日キャンセルのため、回数券1回分が消化されます。</div>':'')+'</div><div style="border-top:1px solid #e5e5e5;padding:14px 24px"><p style="font-size:12px;margin:0 0 8px"><a href="https://masa19851127.github.io/trainer-reserve/client.html" style="color:#c2410c;text-decoration:none">予約・確認はこちら →</a></p><p style="font-size:11px;color:#999;margin:0">このメールはTrainer Reserveより自動送信されています。</p></div></div>';
}
function mailTextClient(name,ds,t,menu,loc){
  return name+' 様\n\n【予約確認】\n日時：'+ds+' '+t+'〜'+et(t)+'\nメニュー：'+MENUS[menu]+'\n場所：'+LOCS[loc]+'\n\n当日はお気をつけてお越しください。\n\nTrainer Reserve\nhttps://masa19851127.github.io/trainer-reserve/client.html';
}
function mailTextTrainer(name,ds,t,menu,loc,phone,msg){
  return '【新規予約】\nお客様：'+name+' 様\n日時：'+ds+' '+t+'〜'+et(t)+'\nメニュー：'+MENUS[menu]+'\n場所：'+LOCS[loc]+'\n電話番号：'+(phone||'未入力')+'\nメッセージ：'+(msg||'なし')+'\n\nTrainer Reserve';
}
function mailTextCancel(name,ds,t,menu,loc,sameDay){
  return name+' 様\n\n【予約キャンセル】\n日時：'+ds+' '+t+'〜'+et(t)+'\nメニュー：'+MENUS[menu]+'\n場所：'+LOCS[loc]+(sameDay?'\n\n※当日キャンセルのため、回数券1回分が消化されます。':'')+'\n\nTrainer Reserve\nhttps://masa19851127.github.io/trainer-reserve/client.html';
}

// === 移動時間ブロック判定 ===

function _recomputeBlockedSlots(){
  blockedSlots={};
  var _allMls=['pilates-meguro','pilates-yokohama','training-yokohama','training-ebisu'];
  Object.values(bookings).forEach(function(bk){
    if(!bk||!bk.loc||!bk.menu||!bk.date_key)return;
    var bkMl=bk.menu+'-'+bk.loc;
    var _bp=bk.date_key.split('_');
    if(_bp.length<2)return;
    var _biso=_bp[0],_bhi=parseInt(_bp[1]);
    if(isNaN(_bhi))return;
    [-1,1].forEach(function(d){
      var _bh=_bhi+d;
      if(_bh<10||_bh>21)return;
      var _bk=_biso+'_'+_bh+':00';
      if(!blockedSlots[_bk])blockedSlots[_bk]=new Set();
      _allMls.forEach(function(ml){
        if(ml===bkMl)return;
        blockedSlots[_bk].add(ml);
      });
    });
  });
}

// === キャッシュ管理 ===

var weekCache={};
function _cacheKey(){var dates=mode==='client'?clientWkDates(wkOff):wkDates(wkOff);return mode+'|'+localISO(dates[0])+'|'+localISO(dates[6])+'|'+(localStorage.getItem('myEmail')||'');}
function _restoreFromCache(c){slotSets={};Object.keys(c.slotSets).forEach(function(k){slotSets[k]=new Set(c.slotSets[k]);});offSlots=Object.assign({},c.offSlots);bookings={};Object.keys(c.bookings).forEach(function(k){bookings[k]=Object.assign({},c.bookings[k]);});myBookings=new Set(c.myBookings);blockedSlots={};Object.keys(c.blockedSlots).forEach(function(k){blockedSlots[k]=new Set(c.blockedSlots[k]);});dayOffs=Object.assign({},c.dayOffs);}
function _saveToCache(){var key=_cacheKey();weekCache[key]={slotSets:Object.keys(slotSets).reduce(function(o,k){o[k]=new Set(slotSets[k]);return o;},{}),offSlots:Object.assign({},offSlots),bookings:Object.keys(bookings).reduce(function(o,k){o[k]=Object.assign({},bookings[k]);return o;},{}),myBookings:new Set(myBookings),blockedSlots:Object.keys(blockedSlots).reduce(function(o,k){o[k]=new Set(blockedSlots[k]);return o;},{}),dayOffs:Object.assign({},dayOffs)};}
function invalidateWeekCache(){weekCache={};}

// === 祝日取得 ===

function _applyHolidays(arr){
  arr.forEach(function(d){holidays.add(d);});
  if(typeof renderT==='function'&&mode==='trainer')renderT();
  else if(typeof renderC==='function'&&mode==='client')renderC();
}
async function loadHolidays(){
  var CK='holidaysCache_v1',TK='holidaysCacheTs_v1';
  HOLIDAYS_FALLBACK.forEach(function(d){holidays.add(d);});
  try{
    var hCacheStr=localStorage.getItem(CK);
    var hCacheTs=parseInt(localStorage.getItem(TK)||'0');
    var now=Date.now(),WEEK=7*24*3600*1000;
    if(hCacheStr&&(now-hCacheTs)<WEEK){
      try{_applyHolidays(JSON.parse(hCacheStr));return;}catch(_){}
    }
    var r=await fetch('https://www.googleapis.com/calendar/v3/calendars/ja.japanese%23holiday%40group.v.calendar.google.com/events?key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY&timeMin=2025-01-01T00:00:00Z&timeMax=2028-01-01T00:00:00Z&singleEvents=true&orderBy=startTime');
    var j=await r.json();
    var arr=[];
    (j.items||[]).forEach(function(item){if(item.start&&item.start.date)arr.push(item.start.date);});
    if(arr.length){try{localStorage.setItem(CK,JSON.stringify(arr));localStorage.setItem(TK,String(now));}catch(_){}_applyHolidays(arr);}
    else{if(typeof renderT==='function'&&mode==='trainer')renderT();else if(typeof renderC==='function'&&mode==='client')renderC();}
  }catch(e){
    var s=localStorage.getItem(CK);
    if(s){try{_applyHolidays(JSON.parse(s));return;}catch(_){}}
    if(typeof renderT==='function'&&mode==='trainer')renderT();else if(typeof renderC==='function'&&mode==='client')renderC();
  }
}
