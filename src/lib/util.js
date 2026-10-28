"use strict";

function parseOmieDate(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function num(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const HTML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// A API da Omie devolve textos com entidades HTML ("COM &amp; IMP").
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, ent) => {
    if (ent[0] === "#") {
      const code = ent[1].toLowerCase() === "x" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return HTML_ENTITIES[ent.toLowerCase()] ?? match;
  });
}

function str(value, max) {
  if (value == null) return null;
  const s = decodeEntities(String(value)).trim();
  if (!s) return null;
  return max ? s.slice(0, max) : s;
}

function flag(value, fallback = "N") {
  if (value == null || value === "") return fallback;
  const s = String(value).trim().toUpperCase();
  if (s === "S" || s === "N") return s;
  if (s === "TRUE" || s === "1") return "S";
  if (s === "FALSE" || s === "0") return "N";
  return fallback;
}

function todayBr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function addMonths(date, delta) {
  const d = new Date(date.getFullYear(), date.getMonth() + delta, 1);
  return d;
}

function formatBr(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

function lastDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function monthWindows(monthsBack) {
  const now = new Date();
  const windows = [];
  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const start = addMonths(now, -i);
    const end = lastDayOfMonth(start);
    const clippedEnd = i === 0 ? now : end;
    windows.push({
      de: formatBr(new Date(start.getFullYear(), start.getMonth(), 1)),
      ate: formatBr(clippedEnd),
      ano: start.getFullYear(),
      mes: start.getMonth() + 1,
    });
  }
  return windows;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Executa fn sobre items com no máximo `limit` em paralelo, preservando a ordem.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}

function maskKey(key) {
  const s = String(key || "");
  return s.length > 4 ? `***${s.slice(-4)}` : "***";
}

module.exports = {
  parseOmieDate,
  num,
  str,
  flag,
  todayBr,
  formatBr,
  monthWindows,
  sleep,
  mapLimit,
  maskKey,
};
