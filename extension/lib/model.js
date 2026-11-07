export const MOCK_MODEL = 'mock-original';

export function dollars(value, precise = false) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
    maximumFractionDigits: precise ? 4 : 2,
  }).format(value || 0);
}

export function summarize(records, ledger) {
  return {
    count: records.filter(r => r.status === 'completed').length,
    pending: records.filter(r => r.status === 'pending').length,
    total: ledger.reduce((sum, entry) => sum + (entry.costUsd ?? 0), 0),
    unknown: ledger.filter(entry => entry.costUsd == null).length,
  };
}

export function safePageUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

// Replace only this provider when enabling a real API. Never invent token usage.
export async function generateTryOn({ original, references, delay = 10000 }) {
  await new Promise(resolve => setTimeout(resolve, delay));
  return {
    result: original,
    model: MOCK_MODEL,
    costUsd: 0,
    costSource: 'mock',
    usage: null,
    referenceIds: references.map(ref => ref.id),
  };
}

// Title for the larger comparison view. Never the image alt text: shops fill it with
// whole product descriptions ("Image 1 of 8, For this easy jacket…").
export function detailTitle(record) {
  const title = String(record?.pageTitle ?? '').trim();
  if (title) return title;
  try { return new URL(record.pageUrl).hostname.replace(/^www\./,'') || 'Your try-on'; } catch { return 'Your try-on'; }
}
