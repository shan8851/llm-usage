import os from 'node:os';
import path from 'node:path';

export const supportedSortFields = [
  'tokens_in',
  'tokens_out',
  'sessions',
  'turns',
  'cached_tokens',
  'reasoning_tokens',
  'model',
];

export function expandHome(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath === '~') return os.homedir();
  if (inputPath.startsWith('~/')) return path.join(os.homedir(), inputPath.slice(2));
  return inputPath;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-GB').format(Math.round(value || 0));
}

export function formatCompact(value) {
  return new Intl.NumberFormat('en-GB', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Math.round(value || 0));
}

export function parseTime(value, fallback) {
  if (!value) return fallback;
  if (value === 'now') return new Date();

  const rel = /^([0-9]+)\s*([mhdw])$/i.exec(value.trim());
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const msPer = {
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
    };
    return new Date(Date.now() - n * msPer[unit]);
  }

  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`Invalid time value: ${value}. Use ISO date or relative like 7d, 24h, 30m.`);
  }
  return dt;
}

export function safeDate(value) {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function inRange(date, from, to) {
  if (!date) return false;
  const t = date.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export function sortRows(rows, key = 'tokens_out') {
  const sortKey = supportedSortFields.includes(key) ? key : 'tokens_out';

  return [...rows].sort((a, b) => {
    if (sortKey === 'model') return String(a.model).localeCompare(String(b.model));
    return (b[sortKey] || 0) - (a[sortKey] || 0);
  });
}
