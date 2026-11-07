import { get, getAll, finishGeneration, enqueueGeneration, toggleLike } from './lib/db.js';
import { safePageUrl } from './lib/model.js';
import {normalizeSettings} from './lib/settings.js';
import {siteHostname,skippedSites,allowedSites,isSiteOff,siteMode,policyListKey,SITE_POLICY_KEYS} from './lib/sites.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.runtime.openOptionsPage();
  runJobs().catch(console.error);
});

// Reference photos and settings are only available to extension pages.
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });

const active = new Map();
const changes = new BroadcastChannel('cbm-data');
let creatingOffscreen;
async function runJobs() {
  const contexts = await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[chrome.runtime.getURL('offscreen.html')]});
  if (!contexts.length) {
    if (!creatingOffscreen) creatingOffscreen = chrome.offscreen.createDocument({
      url:'offscreen.html',reasons:['BLOBS'],
      justification:'Decode and resize reference image blobs, process generated image blobs, and preserve image work while the sidebar is closed.',
    }).finally(() => { creatingOffscreen = null; });
    await creatingOffscreen;
  }
  await chrome.runtime.sendMessage({type:'CBM_RUN_JOBS'});
}
chrome.runtime.onStartup.addListener(() => runJobs().catch(console.error));

async function start(message,sender) {
  const pageUrl = safePageUrl(sender.tab?.url || message.pageUrl);
  if (!pageUrl) throw new Error('Try-on is available on regular websites.');
  const policy = await chrome.storage.local.get(SITE_POLICY_KEYS);
  if (isSiteOff(pageUrl,policy) || (safePageUrl(sender.url) && isSiteOff(sender.url,policy))) throw new Error('Try-ons are off on this website. You can enable it in the sidebar.');
  const key = `${sender.tab.id}:${message.imageUrl}`;
  if (active.has(key)) return active.get(key);
  const task = (async () => {
    const existing = (await getAll('jobs')).find(job => job.sourceTabId === sender.tab.id && job.imageUrl === message.imageUrl);
    if (existing) {
      await chrome.storage.session.set({[`selection:${sender.tab.windowId}`]:existing.id});
      await runJobs();return {ok:true,id:existing.id,pending:true};
    }
    const [references,stored] = await Promise.all([getAll('references'),chrome.storage.local.get(['generationSettings','openaiApiKey','promptMode','customPrompt'])]);
    const settings = normalizeSettings(stored.generationSettings);
    if (settings.mode === 'openai' && !stored.openaiApiKey) throw new Error('Add your OpenAI API key in Dashboard → Settings.');
    if (settings.mode === 'openai' && !references.length) throw new Error('Add a reference photo of you in your dashboard first.');
    let prompt = stored.promptMode === 'custom' && typeof stored.customPrompt === 'string' ? stored.customPrompt : '';
    if (!prompt.trim()) {
      const promptResponse = await fetch(chrome.runtime.getURL('prompts/try-on.txt'));
      if (!promptResponse.ok) throw new Error('Could not load prompts/try-on.txt.');
      prompt = await promptResponse.text();
    }
    if (!prompt.trim()) throw new Error('The try-on prompt is empty.');
    const record = {
      id:crypto.randomUUID(),createdAt:Date.now(),status:'pending',stage:'queued',
      pageUrl,pageTitle:String(sender.tab.title || message.pageTitle || 'Untitled page').slice(0,300),
      imageUrl:String(message.imageUrl || '').slice(0,10000),imageAlt:String(message.imageAlt || '').slice(0,300),
      sourceTabId:sender.tab.id,model:settings.mode === 'mock' ? 'mock-original' : settings.model,
      costUsd:null,referenceIds:references.map(ref => ref.id),settings,prompt,
    };
    await enqueueGeneration(record,{
      id:record.id,createdAt:record.createdAt,state:'queued',sourceTabId:sender.tab.id,
      imageUrl:message.imageUrl,snapshot:message.snapshot,references,settings,prompt,
    });
    await chrome.storage.session.set({[`selection:${sender.tab.windowId}`]:record.id});
    changes.postMessage('generations');
    try { await runJobs(); }
    catch {
      record.status = 'failed';record.error = 'Could not start image processing. Reload the extension and try again.';
      await finishGeneration(record,null);changes.postMessage('generations');
      throw new Error(record.error);
    }
    return {ok:true,id:record.id,pending:true};
  })();
  active.set(key,task);
  try { return await task; } finally { active.delete(key); }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !message || typeof message.type !== 'string') return;
  const ui = [chrome.runtime.getURL('sidepanel.html'),chrome.runtime.getURL('options.html')].includes(sender.url?.split('#')[0]);
  if (message.type === 'CBM_SITE_STATUS' && (sender.tab || ui)) {
    getSiteStatus(sender.tab || message.tabId,sender.tab ? sender.url : null).then(reply,error => reply({ok:false,error:error.message}));
    return true;
  } else if (message.type === 'CBM_SKIP_SITE' && ui) {
    saveSkippedSite(message).then(reply,error => reply({ok:false,error:error.message}));
    return true;
  } else if (message.type === 'CBM_API_KEY' && sender.url === chrome.runtime.getURL('offscreen.html')) {
    chrome.storage.local.get('openaiApiKey').then(value => reply({apiKey:value.openaiApiKey || ''}),() => reply({apiKey:''}));
    return true;
  } else if (message.type === 'CBM_PUBLIC_CONFIG' && [chrome.runtime.getURL('sidepanel.html'),chrome.runtime.getURL('options.html')].includes(sender.url?.split('#')[0])) {
    chrome.storage.local.get(['generationSettings','openaiApiKey']).then(value => reply({settings:normalizeSettings(value.generationSettings),hasKey:Boolean(value.openaiApiKey)}));
    return true;
  } else if (message.type === 'CBM_OPEN') {
    const hash = typeof message.id === 'string' ? `#generation=${encodeURIComponent(message.id)}` : '';
    chrome.tabs.create({ url: chrome.runtime.getURL(`options.html${hash}`) });
    reply({ ok: true });
  } else if (message.type === 'CBM_PANEL_OPEN' && sender.tab) {
    chrome.sidePanel.open({ windowId: sender.tab.windowId })
      .then(() => reply({ ok:true }), error => reply({ ok:false,error:error.message }));
    return true;
  } else if (message.type === 'CBM_TRY_ON' && sender.tab) {
    // Open synchronously with the content-script click, before any storage awaits.
    chrome.sidePanel.open({ windowId: sender.tab.windowId })
      .then(() => start(message, sender))
      .then(reply, error => reply({ ok: false, error: error.message }));
    return true;
  } else if (message.type === 'CBM_COMPARE' && sender.url === chrome.runtime.getURL('sidepanel.html')) {
    compareOnPage(message).then(reply, error => reply({ ok: false, error: error.message }));
    return true;
  } else if (message.type === 'CBM_COMPARE_STEP' && sender.tab && typeof message.id === 'string' && [-1,1].includes(message.direction)) {
    stepComparison(message,sender.tab.id).then(reply, error => reply({ ok: false, error: error.message }));
    return true;
  } else if (message.type === 'CBM_TOGGLE_LIKE' && typeof message.id === 'string') {
    toggleLike(message.id).then(result => {
      changes.postMessage('likes');
      reply({ok:true,...result});
    },error => reply({ok:false,error:error.message}));
    return true;
  }
});

async function imageDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  return `data:${blob.type};base64,${btoa(chunks.join(''))}`;
}

async function compareOnPage(message) {
  const record = await get('generations', message.id);
  if (!record || record.status !== 'completed') throw new Error('This try-on is not ready yet.');
  const tab = await chrome.tabs.get(message.tabId);
  if (!safePageUrl(tab.url)) throw new Error('Open a shopping page to expand the comparison, or view it in history.');
  const original = await imageDataUrl(record.original);
  const result = record.result === record.original ? original : await imageDataUrl(record.result);
  const order = await comparisonOrder();const index = order.indexOf(record.id);
  try {
    return await chrome.tabs.sendMessage(tab.id, {
      type: 'CBM_SHOW_COMPARISON', id: record.id, original, result, liked:Boolean(record.liked), model:record.model,
      position:index + 1, total:order.length, hasPrev:index > 0, hasNext:index >= 0 && index < order.length - 1,
    }, { frameId: 0 });
  } catch {
    throw new Error('Refresh your shopping page, then click the preview again. You can also view it in history.');
  }
}

// Finished try-ons, newest first: the same order as the side panel list.
async function comparisonOrder() {
  return (await getAll('generations')).filter(record => record.status === 'completed').sort((a,b) => b.createdAt - a.createdAt).map(record => record.id);
}

async function stepComparison(message,tabId) {
  const order = await comparisonOrder();
  const index = order.indexOf(message.id);
  const id = index < 0 ? null : order[index + message.direction];
  if (!id) throw new Error('No more try-ons in that direction.');
  return compareOnPage({id,tabId});
}

async function getSiteStatus(tabOrId,frameUrl) {
  const tab = typeof tabOrId === 'number' ? await chrome.tabs.get(tabOrId) : tabOrId;
  const url = safePageUrl(tab?.url);
  const stored = await chrome.storage.local.get(SITE_POLICY_KEYS);
  return {ok:true,hostname:url ? siteHostname(url) : null,skipped:Boolean(url) && isSiteOff(url,stored),mode:siteMode(stored.siteMode),
    enabled:Boolean(url && !isSiteOff(url,stored) && (!safePageUrl(frameUrl) || !isSiteOff(frameUrl,stored)))};
}

let siteWrites = Promise.resolve();
function saveSkippedSite(message) {
  const task = siteWrites.catch(() => {}).then(async () => {
    let hostname = siteHostname(message.hostname);
    if (typeof message.tabId === 'number') {
      const tab = await chrome.tabs.get(message.tabId);
      if (!safePageUrl(tab.url)) throw new Error('Open a regular website first.');
      const current = siteHostname(tab.url);
      if (hostname && hostname !== current) throw new Error('The website changed. Click the button again.');
      hostname = current;
    }
    if (!hostname) throw new Error('Enter a valid website, such as youtube.com.');
    // message.skip means "turn this site off". In "all" mode that adds to the skip list;
    // in "some" mode it removes from the allow list (and the reverse to turn it on).
    const stored = await chrome.storage.local.get(SITE_POLICY_KEYS);
    const key = policyListKey(stored.siteMode);
    const normalize = key === 'allowedSites' ? allowedSites : skippedSites;
    const add = key === 'allowedSites' ? !message.skip : message.skip;
    let list = normalize(stored[key]);
    if (add) list = normalize([...list,hostname]);
    else list = list.filter(site => site !== hostname && !(typeof message.tabId === 'number' && hostname.endsWith(`.${site}`)));
    await chrome.storage.local.set({[key]:list});
    return {ok:true,hostname,sites:list};
  });
  siteWrites = task;
  return task;
}

chrome.storage.onChanged.addListener((changes,area) => {
  if (area !== 'local' || !SITE_POLICY_KEYS.some(key => changes[key])) return;
  // Tell every frame to re-read only its site policy. No image scans on skipped sites.
  chrome.tabs.query({}).then(tabs => {
    for (const tab of tabs) chrome.tabs.sendMessage(tab.id,{type:'CBM_REFRESH_SITE_STATE'}).catch(() => {});
  }).catch(console.error);
});
