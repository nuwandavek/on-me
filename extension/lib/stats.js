import {isMock} from './settings.js';

const DAY = 864e5;

export function siteOf(url) {
  try { return new URL(url).hostname.replace(/^www\./,'') || 'Unknown'; } catch { return 'Unknown'; }
}

// Top `limit` websites by try-on count, with everything else folded into "Other".
export function topSites(records,limit = 5) {
  const counts = new Map();
  for (const record of records) { const site = siteOf(record.pageUrl);counts.set(site,(counts.get(site) || 0) + 1); }
  const sorted = [...counts].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const rows = sorted.slice(0,limit).map(([site,count]) => ({site,count,other:false}));
  const rest = sorted.slice(limit);
  if (rest.length) rows.push({site:`Other (${rest.length} site${rest.length === 1 ? '' : 's'})`,count:rest.reduce((sum,[,count]) => sum + count,0),other:true});
  return rows;
}

// One row per week (weeks start Monday) for the last `weeks` weeks, oldest first, zero-filled.
export function weeklyCounts(records,weeks = 8,now = new Date()) {
  const today = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const monday = new Date(today);monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const rows = [];
  for (let i = weeks - 1;i >= 0;i--) {
    const start = new Date(monday);start.setDate(monday.getDate() - i * 7);
    const end = new Date(start);end.setDate(start.getDate() + 7);
    rows.push({week:start.toISOString().slice(0,10),start:start.getTime(),count:records.filter(r => r.createdAt >= start.getTime() && r.createdAt < end.getTime()).length});
  }
  return rows;
}

export function usageStats(records,ledger,now = Date.now()) {
  const finished = records.filter(r => r.status !== 'pending');
  const completed = records.filter(r => r.status === 'completed');
  const real = completed.filter(r => !isMock(r));
  const durations = real.filter(r => r.completedAt && r.generatingAt).map(r => (r.completedAt - r.generatingAt) / 1000).sort((a,b) => a - b);
  const costs = ledger.filter(entry => entry.costUsd != null && entry.costSource !== 'mock');
  const days = new Map();
  for (const record of records) { const key = new Date(record.createdAt).toDateString();days.set(key,(days.get(key) || 0) + 1); }
  const weekday = new Array(7).fill(0);
  for (const record of records) weekday[new Date(record.createdAt).getDay()]++;
  const favoriteDay = records.length ? weekday.indexOf(Math.max(...weekday)) : null;
  return {
    total:records.length,
    completed:completed.length,
    failed:records.filter(r => r.status === 'failed').length,
    liked:records.filter(r => r.liked).length,
    successRate:finished.length ? completed.length / finished.length : null,
    sites:new Set(records.map(r => siteOf(r.pageUrl))).size,
    last30:records.filter(r => r.createdAt >= now - 30 * DAY).length,
    activeDays:days.size,
    medianSeconds:durations.length ? durations[Math.floor(durations.length / 2)] : null,
    averageCost:costs.length ? costs.reduce((sum,entry) => sum + entry.costUsd,0) / costs.length : null,
    favoriteDay,
  };
}
