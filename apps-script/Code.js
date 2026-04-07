/**
 * Personal OS — Google Sheets → Cloudflare Worker 同期スクリプト
 *
 * 使い方:
 *   1. Google Sheets を開く
 *   2. 拡張機能 > Apps Script
 *   3. このコードを貼り付け
 *   4. API_URL / API_KEY を確認
 *   5. syncToPersonalOS() を手動実行 or トリガー設定
 */

const API_URL = 'https://personal-os-api.drakunweb.workers.dev';
const API_KEY = 'drakunweb4567';

// 2つ目のスプレッドシート（ニュース・副業求人・転職求人）
const DB2_ID = '1_R6B4oH-Pt09PJ2J-6T7EqZVvmAimogXuaIFpqptM6w';

// 日付値 → "YYYY-MM-DD" 変換
// Google Sheets の getValues() は Date オブジェクトを返す場合がある
function excelDateToISO(serial) {
  if (!serial) return null;
  // Google Sheets が Date オブジェクトを返した場合
  if (serial instanceof Date) {
    if (isNaN(serial.getTime())) return null;
    return Utilities.formatDate(serial, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  // Excel シリアル数値の場合
  if (isNaN(serial)) return null;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  if (isNaN(date.getTime())) return null;
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
}

// Cloudflare Worker API に PATCH リクエスト
function patchAPI(payload) {
  const res = UrlFetchApp.fetch(`${API_URL}/data`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    Logger.log(`API Error ${code}: ${res.getContentText()}`);
  }
  return code === 200;
}

// ─── Food_data シートを読み込んで食事データを構築 ────────────────────────────
function syncFoodData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Food_data');
  if (!sheet) { Logger.log('Food_data シートが見つかりません'); return; }

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0]; // Date, Time, Category, Food, Protein, Fat, Carbon, Calorie, Memo
  const grouped = {}; // { "YYYY-MM-DD": { 朝食: [], 昼食: [], ... } }

  for (let i = 1; i < rows.length; i++) {
    const [dateSerial, , category, food, protein, fat, carbon, calorie, memo] = rows[i];
    if (!dateSerial || !food) continue;
    const date = excelDateToISO(dateSerial);
    if (!date) continue;

    if (!grouped[date]) grouped[date] = {};
    const cat = category || '間食';
    if (!grouped[date][cat]) grouped[date][cat] = [];

    grouped[date][cat].push({
      id: Date.now() + i,
      name: String(food),
      kcal: Number(calorie) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      carbon: Number(carbon) || 0,
      memo: String(memo || ''),
    });
  }

  // API に日付ごとに PATCH
  const payload = {};
  for (const [date, meals] of Object.entries(grouped)) {
    if (!payload[date]) payload[date] = {};
    payload[date].meals = meals;
  }

  if (Object.keys(payload).length > 0) {
    const ok = patchAPI(payload);
    Logger.log(`Food_data 同期: ${ok ? '✅' : '❌'} (${Object.keys(payload).length} 日分)`);
  }
}

// ─── Training_data シートを読み込んで筋トレデータを構築 ──────────────────────
function syncTrainingData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Training_data');
  if (!sheet) { Logger.log('Training_data シートが見つかりません'); return; }

  const rows = sheet.getDataRange().getValues();
  // Date, Time, Category, Place, Parts, How long(min), RPE, Name, Weight, Reps, Sets, Memo
  const grouped = {}; // { "YYYY-MM-DD": [ exercise, ... ] }

  for (let i = 1; i < rows.length; i++) {
    const [dateSerial, , , place, parts, duration, rpe, name, weight, reps, sets, memo] = rows[i];
    if (!dateSerial || !name) continue;
    const date = excelDateToISO(dateSerial);
    if (!date) continue;

    if (!grouped[date]) grouped[date] = [];
    grouped[date].push({
      id: Date.now() + i,
      name: String(name),
      weight: Number(weight) || 0,
      reps: Number(reps) || 0,
      sets: Number(sets) || 3,
      place: String(place || ''),
      parts: String(parts || ''),
      duration: Number(duration) || 0,
      rpe: Number(rpe) || 0,
      memo: String(memo || ''),
    });
  }

  const gymMenus = {};
  for (const [date, exercises] of Object.entries(grouped)) {
    gymMenus[date] = exercises;
  }

  if (Object.keys(gymMenus).length > 0) {
    const ok = patchAPI({ gym: { menus: gymMenus } });
    Logger.log(`Training_data 同期: ${ok ? '✅' : '❌'} (${Object.keys(gymMenus).length} 日分)`);
  }
}

// ─── health_data シートを読み込んで健康指標を構築 ─────────────────────────────
function syncHealthData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('health_data');
  if (!sheet) { Logger.log('health_data シートが見つかりません'); return; }

  const rows = sheet.getDataRange().getValues();
  // Date, Steps, Active Energy, Passive Energy, Total Energy, Weight
  const payload = {};

  for (let i = 1; i < rows.length; i++) {
    const [dateSerial, steps, activeEnergy, passiveEnergy, totalEnergy, weight] = rows[i];
    if (!dateSerial) continue;
    const date = excelDateToISO(dateSerial);
    if (!date) continue;

    if (!payload[date]) payload[date] = {};
    payload[date].metrics = {
      weight: Number(weight) || 0,
      steps: Number(steps) || 0,
      activeEnergy: Math.round(Number(activeEnergy) || 0),
      totalEnergy: Math.round(Number(totalEnergy) || 0),
    };
  }

  if (Object.keys(payload).length > 0) {
    const ok = patchAPI(payload);
    Logger.log(`health_data 同期: ${ok ? '✅' : '❌'} (${Object.keys(payload).length} 日分)`);
  }
}

// ─── Food_summary シートを読み込んで日次PFCサマリーを構築 ────────────────────
function syncFoodSummary() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Food_summary');
  if (!sheet) { Logger.log('Food_summary シートが見つかりません'); return; }

  const rows = sheet.getDataRange().getValues();
  // Date, Protein, Fat, Carbon, Calorie, Memo
  const payload = {};

  for (let i = 1; i < rows.length; i++) {
    const [dateSerial, protein, fat, carbon, calorie, memo] = rows[i];
    if (!dateSerial) continue;
    const date = excelDateToISO(dateSerial);
    if (!date) continue;

    if (!payload[date]) payload[date] = {};
    payload[date].foodSummary = {
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      carbon: Number(carbon) || 0,
      calorie: Number(calorie) || 0,
      memo: String(memo || ''),
    };
  }

  if (Object.keys(payload).length > 0) {
    const ok = patchAPI(payload);
    Logger.log(`Food_summary 同期: ${ok ? '✅' : '❌'} (${Object.keys(payload).length} 日分)`);
  }
}

// ─── Google Calendar 同期（今日〜7日分）────────────────────────────────────
function syncCalendarEvents() {
  const today = new Date();
  const gcalEvents = {};

  for (let d = 0; d < 7; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    const dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');

    const events = CalendarApp.getDefaultCalendar().getEvents(date, nextDate);
    if (!events.length) continue;

    gcalEvents[dateStr] = events.map(e => {
      const start = e.getStartTime();
      const end   = e.getEndTime();
      return {
        id:       e.getId(),
        date:     dateStr,
        time:     Utilities.formatDate(start, 'Asia/Tokyo', 'HH:mm'),
        text:     e.getTitle(),
        duration: Math.round((end - start) / 60000), // minutes
        color:    'var(--accent)',
        tab:      '',
        gcal:     true,
      };
    });
  }

  const ok = patchAPI({ gcalEvents });
  Logger.log('Google Calendar 同期: ' + (ok ? '✅' : '❌') + ' (' + Object.keys(gcalEvents).length + '日分)');
}

// ─── DB2: ニュース・副業求人・転職求人 同期 ──────────────────────────────────
/**
 * スプレッドシート: Databese_PerOS (ID: DB2_ID)
 *
 * [news]    date | category | topic | about | url | what_for
 * [sidebis] date | name | about | rate or salary | platform | url
 * [newjob]  date | name | about | rate or salary | platform | url
 *
 * category → app の cat マッピング:
 *   business/biz → 'biz', health → 'health', tech → 'tech',
 *   finance/economy/fin → 'fin', その他 → 'other'
 */
function syncDB2() {
  let ss;
  try {
    ss = SpreadsheetApp.openById(DB2_ID);
  } catch (e) {
    Logger.log('DB2 スプレッドシートを開けません: ' + e.message);
    return;
  }

  const payload = {};

  // カテゴリ文字列 → app の cat キー変換
  function toCat(raw) {
    const s = String(raw || '').toLowerCase().trim();
    if (s.match(/biz|business|work|監査|audit/)) return 'biz';
    if (s.match(/health|fitness|gym|医療|健康/))  return 'health';
    if (s.match(/tech|technology|it|ai|テック/))   return 'tech';
    if (s.match(/fin|finance|economy|投資|経済/))  return 'fin';
    return 'other';
  }

  function toDate(val) {
    if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Tokyo', 'yyyy-MM-dd');
    return String(val || '').trim();
  }

  // ── news シート ──
  try {
    const sheet = ss.getSheetByName('news');
    if (sheet) {
      const rows = sheet.getDataRange().getValues();
      // headers: date(0) category(1) topic(2) about(3) url(4) what_for(5)
      const items = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[2] && !r[1]) continue; // topic空ならスキップ
        items.unshift({
          id:     i * 10000,
          date:   toDate(r[0]),
          cat:    toCat(r[1]),
          title:  String(r[2] || '').trim(),
          body:   String(r[3] || '').trim(),
          source: String(r[4] || '').trim(),   // url → source として表示
          note:   String(r[5] || '').trim(),   // what_for → note
        });
      }
      if (items.length) payload['newsItems'] = items;
      Logger.log('news: ' + items.length + '件');
    }
  } catch (e) { Logger.log('news 同期エラー: ' + e.message); }

  // ── sidebis シート（副業求人）──
  // date(0) name(1) about(2) rate or salary(3) platform(4) url(5)
  try {
    const sheet = ss.getSheetByName('sidebis');
    if (sheet) {
      const rows = sheet.getDataRange().getValues();
      const items = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[1]) continue;
        const rate = String(r[3] || '').trim();
        const platform = String(r[4] || '').trim();
        const note = [rate ? '💰 ' + rate : '', platform ? '📍 ' + platform : ''].filter(Boolean).join(' / ');
        items.unshift({
          id:    i * 10000,
          date:  toDate(r[0]),
          title: String(r[1] || '').trim(),
          note:  (String(r[2] || '').trim() + (note ? '\n' + note : '')).trim(),
          url:   String(r[5] || '').trim(),
          type:  'project',
          pin:   false,
        });
      }
      if (items.length) payload['sidePosts'] = items;
      Logger.log('sidebis: ' + items.length + '件');
    }
  } catch (e) { Logger.log('sidebis 同期エラー: ' + e.message); }

  // ── newjob シート（転職求人）──
  // date(0) name(1) about(2) rate or salary(3) platform(4) url(5)
  try {
    const sheet = ss.getSheetByName('newjob');
    if (sheet) {
      const rows = sheet.getDataRange().getValues();
      const items = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[1]) continue;
        const rate = String(r[3] || '').trim();
        const platform = String(r[4] || '').trim();
        const note = [rate ? '💰 ' + rate : '', platform ? '📍 ' + platform : ''].filter(Boolean).join(' / ');
        // name列を会社名 / 職種に分割試みる（スラッシュ区切り）
        const nameParts = String(r[1] || '').split(/[\/｜|]/).map(s => s.trim());
        items.unshift({
          id:       i * 10000,
          date:     toDate(r[0]),
          company:  nameParts[0] || String(r[1]).trim(),
          position: nameParts[1] || String(r[2] || '').trim().slice(0, 30),
          note:     (String(r[2] || '').trim() + (note ? '\n' + note : '')).trim(),
          url:      String(r[5] || '').trim(),
          status:   'watch',
        });
      }
      if (items.length) payload['careerJobs'] = items;
      Logger.log('newjob: ' + items.length + '件');
    }
  } catch (e) { Logger.log('newjob 同期エラー: ' + e.message); }

  if (Object.keys(payload).length > 0) {
    const ok = patchAPI(payload);
    Logger.log('DB2 同期: ' + (ok ? '✅' : '❌'));
  }
}

// ─── 全シート一括同期 ────────────────────────────────────────────────────────
function syncToPersonalOS() {
  Logger.log('=== Personal OS 同期開始 ===');
  syncHealthData();
  syncFoodData();
  syncFoodSummary();
  syncTrainingData();
  syncCalendarEvents();
  syncDB2();
  Logger.log('=== 同期完了 ===');
}

// ─── 時間トリガー設定（1日1回 午前3時に自動同期）───────────────────────────
function setupDailyTrigger() {
  // 既存トリガーを削除
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncToPersonalOS') {
      ScriptApp.deleteTrigger(t);
    }
  });
  // 新しいトリガーを設定
  ScriptApp.newTrigger('syncToPersonalOS')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
  Logger.log('毎日午前3時の自動同期トリガーを設定しました');
}
