// Photo sets ("profiles"): each reference photo belongs to one set, and try-ons use the active set.
// Photos saved before sets existed have no profileId; they belong to the default set ("Set 1").
export const DEFAULT_PROFILE_ID = 'default';
export const PROFILE_KEYS = ['profiles','activeProfile'];
export const MAX_PROFILES = 8;
export const MIN_REFERENCES = 2;
export const MAX_REFERENCES = 6;

const cleanName = name => String(name ?? '').replace(/\s+/g,' ').trim().slice(0,40);
export const DETAIL_MAX = 200;
const cleanDetail = text => String(text ?? '').replace(/\s+/g,' ').trim().slice(0,DETAIL_MAX);
// Optional notes a set can carry; empty ones are dropped.
function withDetails(profile,source) {
  for (const key of ['build','sizes']) { const value = cleanDetail(source?.[key]);if (value) profile[key] = value; }
  return profile;
}

export function profileList(stored = {}) {
  const list = Array.isArray(stored.profiles) ? stored.profiles : [];
  const seen = new Set([DEFAULT_PROFILE_ID]);
  const saved = list.find(p => p?.id === DEFAULT_PROFILE_ID);
  const profiles = [withDetails({id:DEFAULT_PROFILE_ID,name:cleanName(saved?.name) || 'Set 1'},saved)];
  for (const p of list) {
    if (typeof p?.id !== 'string' || !p.id || seen.has(p.id)) continue;
    seen.add(p.id);profiles.push(withDetails({id:p.id,name:cleanName(p.name) || 'Untitled set'},p));
  }
  return profiles;
}

export function activeProfileId(stored = {}) {
  return profileList(stored).some(p => p.id === stored.activeProfile) ? stored.activeProfile : DEFAULT_PROFILE_ID;
}

export const profileOf = item => item?.profileId || DEFAULT_PROFILE_ID;
export const inProfile = (items,id) => items.filter(item => profileOf(item) === id);

// New sets are named "Set N" (the first free number). They aren't used until chosen, since they start empty.
export function addProfile(stored,id) {
  const profiles = profileList(stored);
  if (profiles.length >= MAX_PROFILES) throw new Error(`You can keep up to ${MAX_PROFILES} photo sets.`);
  const taken = new Set(profiles.map(p => p.name.toLowerCase()));
  let n = profiles.length + 1;while (taken.has(`set ${n}`)) n++;
  return {profiles:[...profiles,{id,name:`Set ${n}`}]};
}

export function renameProfile(stored,id,name) {
  const clean = cleanName(name);
  if (!clean) throw new Error('Give the photo set a name.');
  const profiles = profileList(stored);
  if (profiles.some(p => p.id !== id && p.name.toLowerCase() === clean.toLowerCase())) throw new Error(`You already have a set called “${clean}”.`);
  return {profiles:profiles.map(p => p.id === id ? {...p,name:clean} : p)};
}

export function updateProfileDetails(stored,id,details) {
  return {profiles:profileList(stored).map(p => p.id === id ? withDetails({id:p.id,name:p.name},{...p,...details}) : p)};
}

// Appended to the try-on prompt when the set in use has a build or sizes filled in.
export function profilePromptNote(profile) {
  const lines = [];
  if (profile?.build) lines.push(`- Build: ${profile.build}`);
  if (profile?.sizes) lines.push(`- Sizes they usually wear: ${profile.sizes}`);
  if (!lines.length) return '';
  return `\n\nUSER'S DESCRIPTION OF THE PERSON IN THE REFERENCE PHOTOS\nUse this for body proportions and how the clothing fits. Where it disagrees with the photos, trust the photos.\n${lines.join('\n')}`;
}

// The default set can't be removed; removing the active set switches back to it.
export function removeProfile(stored,id) {
  if (id === DEFAULT_PROFILE_ID) throw new Error('The first photo set can’t be deleted.');
  const active = activeProfileId(stored);
  return {profiles:profileList(stored).filter(p => p.id !== id),activeProfile:active === id ? DEFAULT_PROFILE_ID : active};
}

// One-time, idempotent upgrade for photos saved before sets existed.
export function referencesToMigrate(references) {
  return references.filter(ref => !ref.profileId).map(ref => ({...ref,profileId:DEFAULT_PROFILE_ID}));
}
