// Pure logic for Catatan Keuangan: no DOM, no storage.
const MAX_AMOUNT = 1e12;
const MAX_CATEGORY = 40;
const MAX_NOTE = 120;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parseAmount(raw) {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string' || raw.includes('-')) return NaN;
  const digits = raw.replace(/\D/g, '');
  return digits ? Number(digits) : NaN;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function validateTx(input) {
  const i = input || {};
  if (i.type !== 'in' && i.type !== 'out') return { ok: false, error: 'Jenis transaksi tidak valid.' };
  const amount = parseAmount(i.amount);
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'Jumlah harus angka bulat lebih dari 0.' };
  if (amount > MAX_AMOUNT) return { ok: false, error: 'Jumlah terlalu besar.' };
  const category = typeof i.category === 'string' ? i.category.trim() : '';
  if (!category) return { ok: false, error: 'Kategori wajib diisi.' };
  if (category.length > MAX_CATEGORY) return { ok: false, error: `Kategori maksimal ${MAX_CATEGORY} karakter.` };
  const note = typeof i.note === 'string' ? i.note.trim() : '';
  if (note.length > MAX_NOTE) return { ok: false, error: `Catatan maksimal ${MAX_NOTE} karakter.` };
  if (!isValidDate(i.date)) return { ok: false, error: 'Tanggal tidak valid.' };
  const id = typeof i.id === 'string' && i.id ? i.id : newId();
  return { ok: true, tx: { id, type: i.type, amount, category, note, date: i.date } };
}

export const monthKey = (date) => date.slice(0, 7);

export function filterMonth(txs, key) {
  return txs
    .filter((t) => monthKey(t.date) === key)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function summarize(txs) {
  const income = txs.filter((t) => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter((t) => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income - expense };
}

export function byCategory(txs, type) {
  const totals = new Map();
  for (const t of txs) {
    if (t.type === type) totals.set(t.category, (totals.get(t.category) || 0) + t.amount);
  }
  return [...totals].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File cadangan bukan JSON yang valid.' };
  }
  if (!Array.isArray(data)) return { ok: false, error: 'Format cadangan tidak dikenali.' };
  const txs = [];
  for (const [n, item] of data.entries()) {
    if (!item || typeof item.id !== 'string' || !item.id) {
      return { ok: false, error: `Data ke-${n + 1} tidak memiliki id.` };
    }
    const r = validateTx(item);
    if (!r.ok) return { ok: false, error: `Data ke-${n + 1}: ${r.error}` };
    txs.push(r.tx);
  }
  return { ok: true, txs };
}

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
export const formatRupiah = (n) => rupiah.format(n);
