"use strict";

const { AsyncLocalStorage } = require("node:async_hooks");
const { sleep } = require("../lib/util");

const BASE_DELAY_MS = 280;
const MAX_RETRIES = 4;
const omieStore = new AsyncLocalStorage();

function withOmieCreds(creds, fn) {
  return omieStore.run(creds, fn);
}

function currentCreds() {
  const stored = omieStore.getStore();
  if (stored && stored.app_key && stored.app_secret) return stored;
  const env = {
    app_key: process.env.OMIE_APP_KEY,
    app_secret: process.env.OMIE_APP_SECRET,
  };
  if (!env.app_key || !env.app_secret) {
    throw new OmieError("Credenciais Omie ausentes", {});
  }
  return env;
}

class OmieError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "OmieError";
    this.details = details || {};
  }
}

function buildBody(call, param) {
  const creds = currentCreds();
  return {
    call,
    param: [param || {}],
    app_key: creds.app_key,
    app_secret: creds.app_secret,
  };
}

async function omieCall(url, call, param, options = {}) {
  const timeoutMs = options.timeoutMs || 45000;
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(call, param)),
        signal: controller.signal,
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new OmieError("Resposta Omie nao e JSON", {
          status: res.status,
          body: text.slice(0, 400),
        });
      }

      if (json.faultstring || json.faultcode || json.omie_fail) {
        const desc =
          json.faultstring ||
          json.omie_fail?.description ||
          json.faultcode ||
          "omie_fail";
        const retryable = /too many requests|425|429|temporar/i.test(String(desc));
        if (retryable && attempt < MAX_RETRIES) {
          const wait = BASE_DELAY_MS * attempt * 3;
          await sleep(wait);
          lastError = new OmieError(desc, { status: res.status, json });
          continue;
        }
        throw new OmieError(desc, { status: res.status, json });
      }

      if (!res.ok) {
        throw new OmieError(`HTTP ${res.status}`, { status: res.status, json });
      }

      await sleep(BASE_DELAY_MS);
      return json;
    } catch (err) {
      lastError = err;
      if (err.name === "AbortError") {
        lastError = new OmieError("Timeout na Omie", { call, url });
      }
      const retryable =
        err.name === "AbortError" ||
        /fetch failed|ECONNRESET|ETIMEDOUT|too many/i.test(err.message || "");
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * attempt * 3);
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

function paginationMeta(json) {
  return {
    page: json.pagina ?? json.nPagina ?? 1,
    totalPages: json.total_de_paginas ?? json.nTotPaginas ?? 1,
    records: json.registros ?? json.nRegistros ?? null,
    totalRecords: json.total_de_registros ?? json.nTotRegistros ?? null,
  };
}

function extractRecords(json, preferredKey) {
  if (preferredKey && Array.isArray(json[preferredKey])) {
    return json[preferredKey];
  }
  const skip = new Set([
    "pagina",
    "nPagina",
    "total_de_paginas",
    "nTotPaginas",
    "registros",
    "nRegistros",
    "total_de_registros",
    "nTotRegistros",
    "nRegPorPagina",
    "registros_por_pagina",
  ]);
  for (const [key, value] of Object.entries(json)) {
    if (skip.has(key)) continue;
    if (Array.isArray(value) && value.length && typeof value[0] === "object") {
      return value;
    }
  }
  for (const [key, value] of Object.entries(json)) {
    if (skip.has(key)) continue;
    if (Array.isArray(value)) return value;
  }
  return [];
}

async function paginate(url, call, baseParam, options = {}) {
  const style = options.style || "pagina";
  const pageKey = style === "nPagina" ? "nPagina" : "pagina";
  const sizeKey = style === "nPagina" ? "nRegPorPagina" : "registros_por_pagina";
  const pageSize = Math.min(options.pageSize || 50, 100);
  const maxPages = options.maxPages || Infinity;
  const preferredKey = options.recordsKey;
  const onPage = options.onPage;

  const all = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= maxPages) {
    const param = { ...baseParam, [pageKey]: page, [sizeKey]: pageSize };
    const json = await omieCall(url, call, param);
    const meta = paginationMeta(json);
    totalPages = meta.totalPages || 1;
    const records = extractRecords(json, preferredKey);
    all.push(...records);
    if (onPage) await onPage({ page, totalPages, records, json, meta });
    if (!records.length && page >= totalPages) break;
    page += 1;
  }

  return all;
}

module.exports = {
  OmieError,
  omieCall,
  paginationMeta,
  extractRecords,
  paginate,
  withOmieCreds,
  currentCreds,
};
