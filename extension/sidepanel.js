import { getAll } from './lib/db.js';
import { safePageUrl } from './lib/model.js';
import { likeButton } from './lib/likes.js';
import {normalizeSettings,isMock,modelLabel} from './lib/settings.js';
import {progressText} from './lib/progress.js';

const $ = selector => document.querySelector(selector);
const channel = new BroadcastChannel('cbm-data');
let urls = [];
let records = [];
let refreshing = false;
let refreshAgain = false;
let selection = null;
let scrolledSelection = null;
let windowId;
let filter = 'all';
let renderedState;
let config = {settings:normalizeSettings(),hasKey:false};
let activeSite = null;
let siteRefresh = 0;
const ready = chrome.windows.getCurrent().then(window => { windowId = window.id; });

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function image(blob, alt) {
  const img = node('img');img.alt = alt;
  const url = URL.createObjectURL(blob);urls.push(url);img.src = url;
  return img;
}
function error(message) { $('#panel-error').textContent = message;$('#panel-error').hidden = false; }
function domain(url) { try { return new URL(url).hostname.replace(/^www\./,''); } catch { return 'Original page'; } }

async function expand(id) {
  $('#panel-error').hidden = true;
  try {
    await ready;
    const [tab] = await chrome.tabs.query({ active:true, windowId });
    if (!tab) throw new Error('Open a shopping page to expand the comparison.');
    const response = await chrome.runtime.sendMessage({ type:'CBM_COMPARE', id, tabId:tab.id });
    if (!response?.ok) throw new Error(response?.error || 'Could not open this comparison.');
  } catch (cause) { error(cause.message); }
}

function render() {
  // Storage notifications can repeat, and gaining visibility can refresh the same
  // data. Keep the existing controls and image URLs when nothing has changed.
  const state = JSON.stringify({filter,selection,config,records:records.map(record => ({
    ...record,
    original:record.original ? [record.original.size,record.original.type] : null,
    result:record.result ? [record.result.size,record.result.type] : null,
  }))});
  if (state === renderedState) return;
  const focused = document.activeElement?.dataset.generationId;
  const focusedLike = document.activeElement?.dataset.likeId;
  urls.forEach(url => URL.revokeObjectURL(url));urls = [];
  const list = $('#tryons');list.replaceChildren();
  const shown = filter === 'liked' ? records.filter(record => record.liked) : records;
  $('#empty').hidden = shown.length > 0;
  $('#empty h2').innerHTML = filter === 'liked' ? 'Your favorites<br>belong here.' : 'Keep browsing.<br>We’ll keep your try-ons here.';
  $('#empty p').textContent = filter === 'liked' ? 'Tap the heart on a try-on to save it to your likes.' : config.settings.mode === 'mock' ? 'Click a hanger on an image. Your mock preview will be ready in about 10 seconds.' : !config.hasKey ? 'Add your OpenAI API key and reference photos in the dashboard, then click a hanger on a shopping image.' : 'Click a hanger on an image. Keep browsing while your try-on is made.';
  $('#liked-count').textContent = records.filter(record => record.liked).length;
  const pending = records.filter(record => record.status === 'pending').length;
  const completed = records.filter(record => record.status === 'completed').length;
  $('#activity').textContent = pending ? `${pending} try-on${pending === 1 ? '' : 's'} in progress. Keep browsing.` : completed ? `${completed} ready. Click a preview to expand it on the page.` : 'Click a hanger on an image to start.';
  $('#activity').classList.toggle('busy', pending > 0);
  for (const record of shown) {
    const article = node('article', 'tryon');article.dataset.id = record.id;
    article.classList.toggle('selected', record.id === selection);
    const button = node('button','preview');button.type = 'button';button.dataset.generationId = record.id;
    button.disabled = record.status !== 'completed';
    button.setAttribute('aria-label', record.status === 'completed' ? `Expand try-on: ${record.imageAlt || domain(record.pageUrl)}` : record.status === 'pending' ? 'Try-on in progress' : 'Try-on failed');
    button.addEventListener('click',() => expand(record.id));
    const pair = node('div','pair');
    const original = node('div','photo');
    if (record.original) original.append(image(record.original,'Original image'));
    else original.append(node('div','placeholder','Saving image…'));
    original.append(node('span','caption','Original'));
    const result = node('div','photo');
    if (record.status === 'pending') {
      result.classList.add('pending-result');
      if (record.original) result.append(image(record.original,''));
      const waiting = node('div','waiting');
      const countdown = node('small');countdown.dataset.countdown = record.id;
      waiting.append(node('span','spinner'),countdown);result.append(waiting);
    } else if (record.result) result.append(image(record.result,isMock(record) ? 'Mock try-on: same as original' : 'Your try-on'));
    else result.append(node('div','placeholder','Preview unavailable'));
    result.append(node('span','caption',record.status === 'pending' ? 'Working on it' : 'Your try-on'));
    pair.append(original,result);button.append(pair);
    const details = node('div','details');const left = node('div');
    const source = node('a','source',domain(record.pageUrl));
    const url = safePageUrl(record.pageUrl);
    if (url) { source.href = url;source.target = '_blank';source.rel = 'noopener noreferrer'; }
    source.title = record.pageTitle;
    const when = new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(record.createdAt);
    left.append(source,node('p','when',when));
    const preview = node('div','preview-wrap');
    preview.append(button);
    if (record.status === 'completed') preview.append(likeButton(record,{onChange:refresh,onError:error}));
    details.append(left);
    article.append(preview,details);
    if (record.error) article.append(node('p','job-error',record.error));
    list.append(article);
  }
  tick();
  if (focused) list.querySelector(`[data-generation-id="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
  if (focusedLike) (list.querySelector(`[data-like-id="${CSS.escape(focusedLike)}"]`) || $('#liked-filter')).focus({preventScroll:true});
  if (selection && selection !== scrolledSelection) {
    const selected = list.querySelector(`[data-id="${CSS.escape(selection)}"]`);
    if (selected) { selected.scrollIntoView({block:'nearest'});scrolledSelection = selection; }
  }
  renderedState = state;
}

function tick() {
  for (const element of document.querySelectorAll('[data-countdown]')) {
    const record = records.find(item => item.id === element.dataset.countdown);
    if (record) element.textContent = progressText(record);
  }
}

async function refresh() {
  if (refreshing) { refreshAgain = true;return; }
  refreshing = true;
  try {
    await ready;
    const [generations,state,publicConfig] = await Promise.all([getAll('generations'),chrome.storage.session.get(`selection:${windowId}`),chrome.runtime.sendMessage({type:'CBM_PUBLIC_CONFIG'})]);
    config = {settings:normalizeSettings(publicConfig.settings),hasKey:publicConfig.hasKey};
    $('#mode-label').textContent = config.settings.mode === 'mock' ? 'MOCK MODE' : !config.hasKey ? 'SETUP' : config.settings.model.endsWith('flare') ? 'FLARE' : 'SUNBURST';
    $('#provider-note').textContent = config.settings.mode === 'mock' ? 'Mock previews use the original image.' : !config.hasKey ? 'Add your API key in the dashboard to start.' : `${modelLabel(config.settings.model)} · ${config.settings.quality} quality`;
    const nextSelection = state[`selection:${windowId}`] || null;
    if (nextSelection && nextSelection !== selection) setFilter('all',false);
    selection = nextSelection;
    records = generations.sort((a,b) => b.createdAt - a.createdAt);
    render();
  } catch (cause) { error(`Could not load your try-ons: ${cause.message}`); }
  finally { refreshing = false;if (refreshAgain) { refreshAgain = false;refresh(); } }
}

$('#dashboard').addEventListener('click',() => chrome.runtime.openOptionsPage());
async function refreshActiveSite() {
  const revision = ++siteRefresh;
  await ready;
  const [tab] = await chrome.tabs.query({active:true,windowId});
  if (!tab) return;
  const status = await chrome.runtime.sendMessage({type:'CBM_SITE_STATUS',tabId:tab.id});
  if (revision !== siteRefresh) return;
  activeSite = status?.ok ? {...status,tabId:tab.id} : null;
  $('#current-site').textContent = activeSite?.hostname || 'Open a website';
  $('#current-site').title = activeSite?.hostname || '';
  $('#skip-site').disabled = !activeSite?.hostname;
  $('#skip-site').textContent = activeSite?.skipped ? 'Enable on this website' : 'Skip this website';
}
$('#skip-site').addEventListener('click',async () => {
  if (!activeSite?.hostname) return;
  $('#skip-site').disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({type:'CBM_SKIP_SITE',tabId:activeSite.tabId,hostname:activeSite.hostname,skip:!activeSite.skipped});
    if (!result?.ok) throw new Error(result?.error || 'Could not update this website.');
    await refreshActiveSite();
  } catch (cause) { error(cause.message);await refreshActiveSite(); }
});
chrome.tabs.onActivated.addListener(info => { if (info.windowId === windowId) refreshActiveSite().catch(cause => error(cause.message)); });
chrome.tabs.onUpdated.addListener((tabId,change) => { if (tabId === activeSite?.tabId && (change.url || change.status === 'complete')) refreshActiveSite().catch(cause => error(cause.message)); });
function setFilter(value,rerender = true) {
  filter = value;
  for (const name of ['all','liked']) {
    $(`#${name}-filter`).classList.toggle('selected',name === value);
    $(`#${name}-filter`).setAttribute('aria-pressed',String(name === value));
  }
  if (rerender) render();
}
$('#all-filter').addEventListener('click',() => setFilter('all'));
$('#liked-filter').addEventListener('click',() => setFilter('liked'));
channel.onmessage = refresh;
chrome.storage.onChanged.addListener((changes,area) => {
  if ((area === 'session' && changes[`selection:${windowId}`]) || (area === 'local' && (changes.generationSettings || changes.openaiApiKey))) refresh();
  if (area === 'local' && changes.skippedSites) refreshActiveSite().catch(cause => error(cause.message));
});
// A window focus event fires between pointerdown and click when returning from
// the shopping page. Rebuilding here removes the button before its click fires.
addEventListener('visibilitychange',() => { if (!document.hidden)refresh(); });
const timer = setInterval(() => {
  tick();
},1000);
addEventListener('beforeunload',() => { clearInterval(timer);urls.forEach(url => URL.revokeObjectURL(url));channel.close(); });
refresh();
refreshActiveSite().catch(cause => error(cause.message));
