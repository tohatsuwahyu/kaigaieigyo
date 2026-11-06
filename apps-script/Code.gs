/**
 * TSH Export Desk – backend (Google Sheets + Apps Script)
 * 海外営業デスク用バックエンド / Backend for the Export Desk web app.
 *
 * Setup (once):  Extensions ▸ Apps Script ▸ paste this file ▸ run setup() ▸ Deploy ▸ Web app
 * See docs/SETUP.md.  Access is protected by a secret TOKEN stored in Script Properties.
 */
const TZ = 'Asia/Tokyo';
const CHUNK = 45000;          // a Sheets cell holds max 50,000 chars → JSON is split in chunks
const NCHUNK = 4;
const TEXTCOLS = ['id','invoiceNo','customer','date','etd','eta','due','status','currency','lcExpiry','quoteEnd','missing','name','json0','json1','json2','json3'];
const TABS = {
  shipments: ['id','u','del','invoiceNo','customer','date','etd','eta','due','status','currency','total','balance','progress','lcExpiry','quoteEnd','missing','json0','json1','json2','json3'],
  customers: ['id','u','del','name','json0','json1','json2','json3'],
  products:  ['id','u','del','name','json0','json1','json2','json3'],
  hs:        ['id','u','del','name','json0','json1','json2','json3'],
  settings:  ['id','u','del','name','json0','json1','json2','json3']
};

/* ---------- one-time setup (run from the editor) ---------- */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  props.setProperty('SSID', ss.getId());
  if (!props.getProperty('TOKEN')) props.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, ''));
  Object.keys(TABS).forEach(function (name) {
    const cols = TABS[name];
    let sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#16233f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    cols.forEach(function (c, i) { if (TEXTCOLS.indexOf(c) >= 0) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@'); });
    if (name === 'shipments') sh.hideColumns(18, 4);   // json columns
    else sh.hideColumns(5, 4);
  });
  let info = ss.getSheetByName('_setup') || ss.insertSheet('_setup');
  info.clear();
  info.getRange('A1:B3').setValues([['TOKEN (paste into the app ▸ Settings ▸ Cloud sync)', props.getProperty('TOKEN')],
    ['Web app URL', '(Deploy ▸ New deployment ▸ Web app, then paste the URL here for reference)'], ['Time zone', TZ]]);
  info.setColumnWidth(1, 360); info.setColumnWidth(2, 460);
  installTriggers_(8);
  Logger.log('TOKEN = ' + props.getProperty('TOKEN'));
}

/* ---------- web app ---------- */
function doGet() { return json_({ ok: true, name: 'TSH Export Desk backend', time: new Date().toISOString() }); }

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    if (!req.token || req.token !== PropertiesService.getScriptProperties().getProperty('TOKEN')) return json_({ ok: false, error: 'unauthorized' });
    switch (req.action) {
      case 'ping':          return json_({ ok: true, now: Date.now() });
      case 'pull':          return json_({ ok: true, now: Date.now(), records: pull_() });
      case 'push':          return json_(push_(req.records || []));
      case 'install':       installTriggers_(Number(req.hour) || 8); return json_({ ok: true });
      case 'testDigest':    return json_({ ok: true, sent: runDigest_(true) });
      case 'syncCalendar':  return json_({ ok: true, events: syncCalendar_() });
      default:              return json_({ ok: false, error: 'unknown action' });
    }
  } catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- storage helpers ---------- */
function ss_() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SSID')); }
function sheet_(name) { const s = ss_().getSheetByName(name); if (!s) throw new Error('Run setup() first (missing sheet ' + name + ')'); return s; }
function readAll_(name) {
  const sh = sheet_(name), cols = TABS[name], last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, cols.length).getValues().map(function (row, i) {
    const o = { _row: i + 2 };
    cols.forEach(function (c, j) { o[c] = row[j]; });
    o.u = Number(o.u) || 0; o.del = o.del === true || o.del === 'TRUE' || o.del === 'true' || o.del === 1;
    return o;
  });
}
function joinJson_(o) { return [o.json0, o.json1, o.json2, o.json3].join(''); }
function splitJson_(s) { const a = []; for (let i = 0; i < NCHUNK; i++) a.push((s || '').substr(i * CHUNK, CHUNK)); if ((s || '').length > CHUNK * NCHUNK) throw new Error('record too large'); return a; }

function pull_() {
  const out = [];
  Object.keys(TABS).forEach(function (k) {
    readAll_(k).forEach(function (r) { if (r.id) out.push({ k: k, id: String(r.id), u: r.u, del: r.del, json: r.del ? '' : joinJson_(r) }); });
  });
  return out;
}

function push_(records) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    let written = 0, skipped = 0;
    const byTab = {};
    records.forEach(function (r) { if (TABS[r.k]) (byTab[r.k] = byTab[r.k] || []).push(r); });
    Object.keys(byTab).forEach(function (k) {
      const cols = TABS[k], sh = sheet_(k), existing = readAll_(k), rowOf = {}, uOf = {};
      existing.forEach(function (e) { rowOf[e.id] = e._row; uOf[e.id] = e.u; });
      let next = Math.max(sh.getLastRow(), 1) + 1;
      byTab[k].forEach(function (r) {
        if (r.id in uOf && uOf[r.id] >= r.u) { skipped++; return; }   // newer on server wins
        const flat = r.flat || {}, ch = splitJson_(r.del ? '' : r.json), rec = { id: r.id, u: r.u, del: !!r.del, name: flat.name || '', json0: ch[0], json1: ch[1], json2: ch[2], json3: ch[3] };
        Object.keys(flat).forEach(function (f) { rec[f] = flat[f]; });
        const vals = cols.map(function (c) { return rec[c] === undefined ? '' : rec[c]; });
        const row = rowOf[r.id] || next++;
        sh.getRange(row, 1, 1, cols.length).setValues([vals]);
        written++;
      });
    });
    return { ok: true, written: written, skipped: skipped, now: Date.now() };
  } finally { lock.releaseLock(); }
}

/* ---------- reminders ---------- */
function cfg_() {
  const row = readAll_('settings').filter(function (r) { return r.id === 'main' && !r.del; })[0];
  const s = row ? JSON.parse(joinJson_(row)) : {};
  const r = s.reminders || {};
  const list = function (v, d) { return String(v == null ? d : v).split(/[,\s]+/).filter(String).map(Number); };
  return { email: r.email || Session.getEffectiveUser().getEmail(), etd: list(r.etd, '7,3,1'), due: list(r.due, '7,3,0'), lc: list(r.lc, '14,7'), quote: list(r.quote, '3'), eta: list(r.eta, '1'),
           checkEtd: Number(r.checkEtd == null ? 3 : r.checkEtd), calendar: r.calendar !== false, hour: Number(r.hour) || 8 };
}
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function days_(a, b) { return Math.round((Date.parse(a + 'T00:00:00+09:00') - Date.parse(b + 'T00:00:00+09:00')) / 864e5); }

function collect_() {
  const c = cfg_(), t = today_(), items = [];
  readAll_('shipments').forEach(function (r) {
    if (r.del || r.status === 'paid') return;
    const who = r.invoiceNo + ' · ' + r.customer, st = r.status, bal = Number(r.balance) || 0, cur = r.currency;
    if (r.etd && ['quote', 'order', 'production'].indexOf(st) >= 0) {
      const d = days_(r.etd, t);
      if (c.etd.indexOf(d) >= 0) items.push({ lvl: d === 0 ? 'today' : 'soon', who: who, en: 'ETD in ' + d + ' day(s) (' + r.etd + ')', ja: 'ETDまであと' + d + '日（' + r.etd + '）' });
      if (d < 0) items.push({ lvl: 'late', who: who, en: 'ETD passed ' + (-d) + ' day(s) ago but not marked Shipped', ja: 'ETDを' + (-d) + '日過ぎていますが「出荷済」になっていません' });
      if (d >= 0 && d <= c.checkEtd && r.missing) items.push({ lvl: 'soon', who: who, en: 'Before shipping, still missing: ' + r.missing, ja: '出荷前に未完了：' + r.missing });
    }
    if (r.eta && st === 'shipped') { const d = days_(r.eta, t); if (c.eta.indexOf(d) >= 0) items.push({ lvl: 'soon', who: who, en: 'Arrival (ETA) in ' + d + ' day(s)', ja: '到着予定（ETA）まであと' + d + '日' }); }
    if (r.due && ['order', 'production', 'shipped'].indexOf(st) >= 0 && bal > 0) {
      const d = days_(r.due, t), amt = cur + ' ' + bal.toLocaleString('en-US');
      if (d < 0) items.push({ lvl: 'late', who: who, en: 'Payment OVERDUE ' + (-d) + ' day(s): ' + amt, ja: '入金が' + (-d) + '日遅延：' + amt });
      else if (c.due.indexOf(d) >= 0) items.push({ lvl: d === 0 ? 'today' : 'soon', who: who, en: 'Payment due in ' + d + ' day(s): ' + amt, ja: '入金期日まであと' + d + '日：' + amt });
    }
    if (r.lcExpiry) { const d = days_(r.lcExpiry, t); if (c.lc.indexOf(d) >= 0) items.push({ lvl: 'soon', who: who, en: 'L/C expires in ' + d + ' day(s)', ja: 'L/C期限まであと' + d + '日' }); }
    if (r.quoteEnd && st === 'quote') { const d = days_(r.quoteEnd, t); if (c.quote.indexOf(d) >= 0) items.push({ lvl: 'soon', who: who, en: 'Quotation expires in ' + d + ' day(s)', ja: '見積の有効期限まであと' + d + '日' }); }
  });
  const rank = { late: 0, today: 1, soon: 2 };
  items.sort(function (a, b) { return rank[a.lvl] - rank[b.lvl]; });
  return { cfg: c, items: items, today: t };
}

function runDigest_(test) {
  const x = collect_();
  if (!x.items.length && !test) return 0;
  const icon = { late: '🔴', today: '🟠', soon: '🟡' };
  const lines = x.items.map(function (i) { return icon[i.lvl] + ' ' + i.who + '\n    ' + i.ja + '\n    ' + i.en; });
  const body = (x.items.length ? lines.join('\n\n') : '（リマインダーはありません / No reminders today）') + '\n\n— TSH Export Desk / 海外営業デスク';
  const html = '<div style="font-family:Arial,sans-serif;max-width:640px"><h2 style="color:#16233f;border-bottom:2px solid #b8935a">TSH Export Desk · ' + x.today + '</h2>' +
    (x.items.length ? x.items.map(function (i) { return '<p style="margin:10px 0">' + icon[i.lvl] + ' <b>' + esc_(i.who) + '</b><br>' + esc_(i.ja) + '<br><span style="color:#666">' + esc_(i.en) + '</span></p>'; }).join('') : '<p>No reminders today / リマインダーはありません</p>') + '</div>';
  MailApp.sendEmail({ to: x.cfg.email, subject: '【TSH Export Desk】' + (x.items.length ? x.items.length + '件のリマインダー / ' + x.items.length + ' reminder(s)' : 'テスト送信 / Test') + ' ' + x.today, body: body, htmlBody: html });
  return x.items.length;
}
function esc_(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

/* ---------- Google Calendar (all-day events with pop-up / e-mail reminders) ---------- */
function syncCalendar_() {
  const props = PropertiesService.getScriptProperties();
  const map = JSON.parse(props.getProperty('CALMAP') || '{}');
  const cal = CalendarApp.getCalendarsByName('TSH Export')[0] || CalendarApp.createCalendar('TSH Export');
  const want = {};
  readAll_('shipments').forEach(function (r) {
    if (r.del || r.status === 'paid') return;
    const who = r.invoiceNo + ' ' + r.customer;
    [['ETD', r.etd, ['quote', 'order', 'production']], ['ETA', r.eta, ['shipped']], ['Payment due', r.due, ['order', 'production', 'shipped']], ['L/C expiry', r.lcExpiry, null], ['Quotation valid until', r.quoteEnd, ['quote']]].forEach(function (e) {
      if (e[1] && (!e[2] || e[2].indexOf(r.status) >= 0)) want[r.id + '|' + e[0]] = { date: String(e[1]), title: e[0] + ' – ' + who };
    });
  });
  let n = 0;
  Object.keys(map).forEach(function (k) {                                   // remove obsolete / changed
    if (!want[k] || want[k].date !== map[k].date) { try { const ev = cal.getEventById(map[k].id); if (ev) ev.deleteEvent(); } catch (err) {} delete map[k]; }
  });
  Object.keys(want).forEach(function (k) {
    if (map[k]) return;
    const p = want[k].date.split('-').map(Number), ev = cal.createAllDayEvent(want[k].title, new Date(p[0], p[1] - 1, p[2]));
    ev.removeAllReminders(); ev.addPopupReminder(900); ev.addEmailReminder(900);   // 15h before 00:00 = 9:00 the day before
    map[k] = { id: ev.getId(), date: want[k].date }; n++;
  });
  props.setProperty('CALMAP', JSON.stringify(map));
  return n;
}

/* ---------- triggers ---------- */
function dailyJob() { runDigest_(false); if (cfg_().calendar) syncCalendar_(); }
function installTriggers_(hour) {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dailyJob') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(hour).inTimezone(TZ).create();
}
