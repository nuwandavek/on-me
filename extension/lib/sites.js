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

// "all": on everywhere except skippedSites. "some": off everywhere except allowedSites.
export const siteMode = value => value === 'some' ? 'some' : 'all';
export const allowedSites = value => skippedSites(Array.isArray(value) ? value : []);

export function isSiteOff(url,policy = {}) {
  if (siteMode(policy.siteMode) === 'some') return !isSkippedSite(url,allowedSites(policy.allowedSites));
  return isSkippedSite(url,policy.skippedSites);
}

// The list the user edits in the current mode: sites turned off ("all") or turned on ("some").
export const policyListKey = mode => siteMode(mode) === 'some' ? 'allowedSites' : 'skippedSites';
export const SITE_POLICY_KEYS = Object.freeze(['siteMode','skippedSites','allowedSites']);

// Turn one site on or off under the current mode. Returns the storage key and its new list.
// fromTab: the request came from the open page, so a matching parent entry
// (e.g. zara.com for shop.zara.com) is removed too; otherwise the click would do nothing.
export function updateSiteList(stored,hostname,{turnOff,fromTab = false}) {
  const key = policyListKey(stored.siteMode);
  const normalize = key === 'allowedSites' ? allowedSites : skippedSites;
  const add = key === 'allowedSites' ? !turnOff : turnOff;
  let list = normalize(stored[key]);
  if (add) list = normalize([...list,hostname]);
  else list = list.filter(site => site !== hostname && !(fromTab && hostname.endsWith(`.${site}`)));
  return {key,list};
}
