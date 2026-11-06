export const DEFAULT_SKIPPED_SITES = Object.freeze(['youtube.com']);

export function siteHostname(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const text = value.trim().replace(/^\*\./,'');
    const url = new URL(text.includes('://') ? text : `https://${text}`);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.hostname.toLowerCase().replace(/^www\./,'').replace(/\.$/,'') || null;
  } catch { return null; }
}

export function skippedSites(value) {
  const list = value === undefined ? DEFAULT_SKIPPED_SITES : Array.isArray(value) ? value : [];
  return [...new Set(list.map(siteHostname).filter(Boolean))].sort();
}

export function isSkippedSite(url,list) {
  const host = siteHostname(url);
  return Boolean(host && skippedSites(list).some(site => host === site || host.endsWith(`.${site}`)));
}
