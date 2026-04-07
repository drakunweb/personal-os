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

// ─── 全シート一括同期 ────────────────────────────────────────────────────────
function syncToPersonalOS() {
  Logger.log('=== Personal OS 同期開始 ===');
  syncHealthData();
  syncFoodData();
  syncFoodSummary();
  syncTrainingData();
  syncCalendarEvents();
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
