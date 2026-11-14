import {
  validateTx, monthKey, filterMonth, summarize, byCategory, parseBackup, formatRupiah,
} from './logic.js';
import { openSheet, closeSheet, initSheet, toast } from './ui-sheet.js';

const KEY = 'catatan-keuangan:v1';
const CATEGORIES = {
  out: [['Makan', '🍜'], ['Transport', '🚗'], ['Belanja', '🛒'], ['Tagihan', '🧾'],
    ['Hiburan', '🎮'], ['Kesehatan', '💊'], ['Rumah', '🏠'], ['Lainnya', '📦']],
  in: [['Gaji', '💼'], ['Bonus', '🎁'], ['Usaha', '💰'], ['Lainnya', '📦']],
};
const ICONS = new Map([...CATEGORIES.out, ...CATEGORIES.in]);
const categoryIcon = (name) => ICONS.get(name) || '📦';

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toKey(new Date());
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
const longFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const signed = (t) => `${t.type === 'in' ? '+' : '−'}${formatRupiah(t.amount)}`;

function load() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    toast('Penyimpanan browser tidak bisa dibaca. Data tidak akan tersimpan.', true);
    return [];
  }
  if (!raw) return [];
  const r = parseBackup(raw);
  if (r.ok) return r.txs;
  // Keep the unreadable copy so a later save never destroys it.
  try { localStorage.setItem(`${KEY}:rusak-${Date.now()}`, raw); } catch { /* reported below */ }
  toast(`Data tersimpan rusak (${r.error}). Salinannya disimpan terpisah.`, true);
  return [];
}

let txs = load();
let month = monthKey(todayStr());
let selected = null; // transaction shown in the detail sheet

// Returns true only if the new list was persisted; state changes only then.
function commit(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    toast('Gagal menyimpan data. Penyimpanan mungkin penuh atau diblokir.', true);
    return false;
  }
  txs = next;
  render();
  return true;
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function icon(name, type) {
  const span = el('span', { className: `cat-icon ${type}`, textContent: categoryIcon(name) });
  span.setAttribute('aria-hidden', 'true');
  return span;
}

function dayLabel(date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === todayStr()) return 'Hari ini';
  if (date === toKey(yesterday)) return 'Kemarin';
  return dayFmt.format(parseDate(date));
}

function txRow(t) {
  const info = el('span', { className: 'tx-info' }, el('span', { className: 'tx-cat', textContent: t.category }));
  if (t.note) info.append(el('span', { className: 'tx-note', textContent: t.note }));
  const btn = el('button', { type: 'button', className: 'tx' },
    icon(t.category, t.type), info, el('span', { className: `amt ${t.type}`, textContent: signed(t) }));
  btn.addEventListener('click', () => showDetail(t));
  return el('li', {}, btn);
}

function renderList(monthTxs) {
  const groups = [];
  for (const t of monthTxs) {
    const last = groups[groups.length - 1];
    if (last?.date === t.date) last.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }
  $('list').replaceChildren(...groups.map((g) => el('div', { className: 'day' },
    el('h3', { className: 'section-title', textContent: dayLabel(g.date) }),
    el('ul', { className: 'group glass tx-list' }, ...g.items.map(txRow)))));
  $('empty').hidden = monthTxs.length > 0;
}

function renderCategories(monthTxs) {
  const cats = byCategory(monthTxs, 'out');
  const total = cats.reduce((s, c) => s + c.total, 0);
  $('cats').replaceChildren(...cats.map((c) => {
    const share = (c.total / total) * 100;
    const bar = el('span', { className: 'bar' });
    bar.style.width = `${share}%`;
    return el('li', { className: 'cat-row' }, icon(c.category, 'out'),
      el('div', { className: 'cat-main' },
        el('div', { className: 'cat-top' },
          el('span', { className: 'tx-cat', textContent: c.category }),
          el('span', { className: 'amt', textContent: formatRupiah(c.total) })),
        el('div', { className: 'cat-bottom' },
          el('div', { className: 'track' }, bar),
          el('span', { className: 'pct', textContent: `${Math.round(share)}%` }))));
  }));
  $('cats').classList.toggle('group', cats.length > 0);
  $('cats').classList.toggle('glass', cats.length > 0);
  $('cats-empty').hidden = cats.length > 0;
}

function render() {
  const monthTxs = filterMonth(txs, month);
  const s = summarize(monthTxs);
  $('month-label').textContent = monthFmt.format(parseDate(`${month}-01`));
  $('sum-in').textContent = formatRupiah(s.income);
  $('sum-out').textContent = formatRupiah(s.expense);
  $('sum-bal').textContent = formatRupiah(s.balance);
  $('sum-bal').classList.toggle('neg', s.balance < 0);
  renderList(monthTxs);
  renderCategories(monthTxs);
}

function shiftMonth(delta) {
  const d = parseDate(`${month}-01`);
  d.setMonth(d.getMonth() + delta);
  month = monthKey(toKey(d));
  render();
}
$('prev').addEventListener('click', () => shiftMonth(-1));
$('next').addEventListener('click', () => shiftMonth(1));

// Tabs
const tabs = [[$('tab-tx'), $('panel-tx')], [$('tab-cat'), $('panel-cat')]];
function selectTab(tab) {
  for (const [btn, panel] of tabs) {
    const on = btn === tab;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
    panel.hidden = !on;
  }
  $('tabs').dataset.sel = String(tabs.findIndex(([b]) => b === tab)); // slides the thumb
}
for (const [btn] of tabs) {
  btn.addEventListener('click', () => selectTab(btn));
  btn.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const other = tabs.find(([b]) => b !== btn)[0];
    selectTab(other);
    other.focus();
  });
}

// Add sheet
function renderChips(type) {
  $('chips').replaceChildren(...CATEGORIES[type].map(([name, emoji], i) => {
    const face = el('span', { className: 'chip-face' },
      el('span', { className: 'chip-emoji', textContent: emoji }),
      el('span', { textContent: name }));
    return el('label', { className: 'chip' },
      el('input', { type: 'radio', name: 'category', value: name, checked: i === 0 }), face);
  }));
  $('form').dataset.type = type;
}

$('fab').addEventListener('click', () => {
  const f = $('form').elements;
  f.amount.value = '';
  f.note.value = '';
  f.date.value = todayStr();
  $('form-error').textContent = '';
  openSheet($('add-sheet'));
});

$('form').addEventListener('change', (e) => {
  if (e.target.name === 'type') renderChips(e.target.value);
});

$('amount').addEventListener('input', (e) => {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 13);
  e.target.value = digits ? Number(digits).toLocaleString('id-ID') : '';
});

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const r = validateTx({
    type: f.type.value,
    amount: f.amount.value,
    category: f.category.value,
    note: f.note.value,
    date: f.date.value,
  });
  if (!r.ok) {
    $('form-error').textContent = r.error;
    return;
  }
  $('form-error').textContent = '';
  if (!commit([...txs, r.tx])) return;
  month = monthKey(r.tx.date);
  render();
  navigator.vibrate?.(10);
  closeSheet();
  toast('Tersimpan ✓');
});

// Detail sheet
function showDetail(t) {
  selected = t;
  $('detail-icon').textContent = categoryIcon(t.category);
  $('detail-icon').className = `cat-icon big ${t.type}`;
  $('detail-amount').textContent = signed(t);
  $('detail-amount').className = `detail-amount ${t.type}`;
  $('detail-type').textContent = t.type === 'in' ? 'Pemasukan' : 'Pengeluaran';
  $('detail-cat').textContent = t.category;
  $('detail-note').textContent = t.note || '—';
  $('detail-date').textContent = longFmt.format(parseDate(t.date));
  openSheet($('detail-sheet'));
}

$('delete').addEventListener('click', () => {
  const t = selected;
  if (!t || !confirm(`Hapus transaksi ${t.category} ${formatRupiah(t.amount)}?`)) return;
  if (!commit(txs.filter((x) => x.id !== t.id))) return;
  navigator.vibrate?.(10);
  closeSheet();
  toast('Transaksi dihapus');
});

for (const id of ['add-cancel', 'detail-close', 'menu-cancel']) $(id).addEventListener('click', closeSheet);

// Menu sheet: backup
$('menu-btn').addEventListener('click', () => openSheet($('menu-sheet')));

const native = window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins : null;

// Android/iOS WebView ignores <a download>, so the APK writes the file and opens the share sheet.
async function exportNative(name, json) {
  try {
    const { uri } = await native.Filesystem.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' });
    await native.Share.share({ title: name, files: [uri] });
  } catch (err) {
    if (!/cancel/i.test(String(err?.message))) toast('Gagal mengekspor cadangan.', true);
  }
}

$('export').addEventListener('click', () => {
  closeSheet();
  const name = `catatan-keuangan-${todayStr()}.json`;
  const json = JSON.stringify(txs, null, 2);
  if (native) return exportNative(name, json);
  const blob = new Blob([json], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  closeSheet();
  let text;
  try {
    text = await file.text();
  } catch {
    toast('File tidak bisa dibaca.', true);
    return;
  }
  const r = parseBackup(text);
  if (!r.ok) {
    toast(r.error, true);
    return;
  }
  const msg = `Ganti ${txs.length} transaksi yang ada dengan ${r.txs.length} transaksi dari cadangan?`;
  if (txs.length && !confirm(msg)) return;
  if (commit(r.txs)) toast(`${r.txs.length} transaksi berhasil diimpor.`);
});

for (const id of ['add-sheet', 'detail-sheet', 'menu-sheet']) initSheet($(id));

// iOS-style collapsing nav bar: compact glass bar once the large title scrolls away.
const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
renderChips('out');
render();

if (!native && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
