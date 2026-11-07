import { getAll, put, remove } from './lib/db.js';
import { dollars, summarize, safePageUrl } from './lib/model.js';
import { likeButton, syncLikeButtons } from './lib/likes.js';
import {normalizeSettings,isMock,modelLabel} from './lib/settings.js';
import {progressText} from './lib/progress.js';
import {skippedSites,siteHostname} from './lib/sites.js';

const $ = selector => document.querySelector(selector);
const date = value => new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).format(value);
let generations = [];
let references = [];
let ledger = [];
let filter = 'all';
let historyUrls = [];
let referenceUrls = [];
let detailUrls = [];
let detailVersion;
let toastTimer;
let refreshing = false;
let queuedRefresh = false;
let settings = normalizeSettings();
let hasApiKey = false;
const channel = new BroadcastChannel('cbm-data');
channel.onmessage = () => refresh();

function blobUrl(blob, list) {
  if (!(blob instanceof Blob)) return '';
  const url = URL.createObjectURL(blob);
  list.push(url);
  return url;
}
function revoke(list) { list.forEach(url => URL.revokeObjectURL(url));list.length = 0; }
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  const element = $('#toast');
  element.textContent = message;element.hidden = false;element.classList.toggle('error', error);
  toastTimer = setTimeout(() => { element.hidden = true; }, 4500);
}
function domain(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'Original page'; } }
function sourceLink(record, className, title) {
  const link = node('a', className, title || `${domain(record.pageUrl)} ↗`);
  const safe = safePageUrl(record.pageUrl);
  if (safe) { link.href = safe;link.target = '_blank';link.rel = 'noopener noreferrer'; }
  return link;
}

function imageCell(blob, label, urls, placeholder) {
  const cell = node('div', 'image-cell');
  if (blob) {
    const img = node('img');img.src = blobUrl(blob, urls);img.alt = label;
    img.loading = 'lazy';cell.append(img);
  } else { cell.append(node('div', 'placeholder', placeholder || 'Preparing preview…')); }
  return cell;
}

async function refresh() {
  if (refreshing) { queuedRefresh = true;return; }
  refreshing = true;
  try {
    [generations, references, ledger] = await Promise.all([getAll('generations'), getAll('references'), getAll('ledger')]);
    references.sort((a,b) => a.createdAt - b.createdAt);
    const stats = summarize(generations, ledger);
    $('#total-spend').textContent = `${dollars(stats.total)}${stats.unknown ? '+' : ''}`;
    $('#settings-total').textContent = `${dollars(stats.total, true)} USD${stats.unknown ? ' · known subtotal' : ''}`;
    $('#spend-note').textContent = stats.unknown ? `${stats.unknown} costs unknown · known subtotal` : 'Usage-based estimate';
    $('#ledger-count').textContent = ledger.length;
    $('#nav-count').textContent = generations.length;
    $('#history-count').textContent = generations.length;
    $('#failed-count').textContent = generations.filter(r => r.status === 'failed').length;
    $('#liked-count').textContent = generations.filter(r => r.liked).length;
    renderHistory();renderReferences();
    updateProvider();
    syncLikeButtons(generations);
    route();
    if ($('#detail-dialog').open) openDetail($('#detail-dialog').dataset.generationId,false);
  } catch (error) { toast(`Could not read local storage: ${error.message}`, true); }
  finally {
    refreshing = false;
    if (queuedRefresh) { queuedRefresh = false;refresh(); }
  }
}

function renderHistory() {
  const focusedLike = document.activeElement?.dataset.likeId;
  revoke(historyUrls);
  const query = $('#search').value.trim().toLowerCase();
  let records = generations.filter(record => {
    const text = `${record.pageTitle} ${record.pageUrl} ${record.imageAlt}`.toLowerCase();
    return (!query || text.includes(query)) && (filter === 'all' || (filter === 'liked' ? record.liked : record.status === 'failed'));
  });
  records.sort((a,b) => $('#sort').value === 'oldest' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
  const list = $('#history-list');list.replaceChildren();
  $('#empty-history').hidden = generations.length !== 0;
  $('#no-results').hidden = generations.length === 0 || records.length > 0;
  for (const record of records) {
    const article = node('article', 'generation');
    const open = node('button', 'generation-open');open.type = 'button';
    open.setAttribute('aria-label', `View try-on from ${domain(record.pageUrl)}`);
    const pair = node('div', 'image-pair');
    const original = imageCell(record.original, 'Original image', historyUrls, 'Image unavailable');
    const result = imageCell(record.result, isMock(record) ? 'Mock try-on: same as original' : 'Your try-on', historyUrls, record.status === 'failed' ? 'Preview unavailable' : progressText(record));
    if (record.status === 'pending') result.querySelector('.placeholder').dataset.progressId = record.id;
    original.append(node('span', '', 'Original'));result.append(node('span', '', record.status === 'pending' ? 'Preparing' : 'Your try-on'));
    pair.append(original, result);open.append(pair);open.addEventListener('click', () => openDetail(record.id));
    const meta = node('div', 'generation-meta');
    const info = node('div');const title = node('h2', 'generation-title');
    title.append(sourceLink(record, 'source-link'));title.title = record.pageTitle;
    info.append(title, node('p', 'generation-date', `${date(record.createdAt)} · ${record.referenceIds?.length || 0} references`));
    const cost = node('div', 'generation-cost', record.costUsd == null ? (record.status === 'pending' ? '—' : 'Unknown') : dollars(record.costUsd, true));
    cost.append(node('small', '', record.status === 'failed' ? 'Failed' : record.status === 'pending' ? 'Pending' : isMock(record) ? 'Mock · USD' : 'Est. USD'));
    const tools = node('div','generation-tools');
    if (record.status === 'completed') tools.append(likeButton(record,{onChange:refresh,onError:message => toast(message,true)}));
    tools.append(cost);meta.append(info,tools);article.append(open, meta);
    if (record.status === 'failed') article.append(node('p', 'generation-error', record.error));
    list.append(article);
  }
  if (focusedLike) (list.querySelector(`[data-like-id="${CSS.escape(focusedLike)}"]`) || $('#liked-filter')).focus({preventScroll:true});
}

function renderReferences() {
  revoke(referenceUrls);
  $('#reference-count').textContent = `${references.length} / 6`;
  const list = $('#reference-list');list.replaceChildren();
  const sidebar = $('#sidebar-photos');sidebar.replaceChildren();
  if (!references.length) sidebar.append(node('span', 'photo-placeholder', '+'));
  for (const ref of references) {
    const figure = node('figure', 'reference-photo');const frame = node('div', 'reference-frame');
    const img = node('img');img.src = blobUrl(ref.blob, referenceUrls);img.alt = ref.name;
    const deleteButton = node('button', 'reference-remove', '×');deleteButton.type = 'button';deleteButton.setAttribute('aria-label', `Remove ${ref.name}`);
    deleteButton.addEventListener('click', async () => {
      try { await remove('references', ref.id);await refresh();channel.postMessage('references');toast('Reference photo removed.'); }
      catch (error) { toast(error.message, true); }
    });
    frame.append(img, deleteButton);figure.append(frame, node('figcaption', '', ref.name));list.append(figure);
    const thumb = node('img');thumb.src = img.src;thumb.alt = '';sidebar.append(thumb);
  }
  const caption = $('#reference-caption');
  caption.replaceChildren(document.createTextNode(references.length ? `${references.length} photo${references.length === 1 ? '' : 's'} of you · Manage` : 'Add photos of you'));
}

async function normalizePhoto(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error(`${file.name}: choose a JPG, PNG, or WebP photo.`);
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name}: photos must be under 10 MB.`);
  let image;
  try { image = await createImageBitmap(file, { imageOrientation:'from-image' }); }
  catch { throw new Error(`${file.name}: this photo could not be read.`); }
  try {
    const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');context.fillStyle = '#ffffff';context.fillRect(0, 0, canvas.width, canvas.height);context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not save this photo.')), 'image/jpeg', .9));
  } finally { image.close(); }
}

let uploading = false;
async function upload(files) {
  if (uploading || !files.length) return;
  uploading = true;$('#dropzone').setAttribute('aria-busy', 'true');
  let added = 0;
  try {
    let count = (await getAll('references')).length;
    for (const file of files) {
      if (count >= 6) { toast('You can keep up to 6 reference photos. Remove one to add another.', true);break; }
      try {
        const blob = await normalizePhoto(file);
        await put('references', { id:crypto.randomUUID(), createdAt:Date.now(), name:file.name, blob });count++;added++;
      } catch (error) { toast(error.message, true); }
    }
    await refresh();channel.postMessage('references');
    if (added && $('#toast').hidden) toast(`${added} reference photo${added === 1 ? '' : 's'} saved.`);
  } finally { uploading = false;$('#dropzone').removeAttribute('aria-busy');$('#reference-input').value = ''; }
}

function openDetail(id, setHash = true) {
  const record = generations.find(item => item.id === id);
  if (!record) { if (setHash) toast('This try-on is no longer in your history.');return; }
  const version = JSON.stringify({...record,original:record.original?.size,result:record.result?.size});
  if (!setHash && $('#detail-dialog').open && detailVersion === version) return;
  detailVersion = version;
  $('#detail-dialog').dataset.generationId = id;
  if (setHash) history.replaceState(null, '', `#generation=${encodeURIComponent(id)}`);
  revoke(detailUrls);
  const content = $('#detail-content');content.replaceChildren();
  const header = node('div', 'detail-header');const h = node('h2', '', record.imageAlt || record.pageTitle || 'Your try-on');h.id = 'detail-title';
  const close = node('button', 'detail-close', '×');close.type = 'button';close.setAttribute('aria-label','Close comparison');close.addEventListener('click', () => $('#detail-dialog').close());header.append(h,close);
  const comparison = node('div','detail-comparison');
  for (const [label, blob] of [['Original',record.original],[isMock(record) ? 'Your try-on · mock' : 'Your try-on',record.result]]) {
    const figure = node('figure');figure.append(node('figcaption','',label),imageCell(blob,label,detailUrls,record.status === 'failed' ? 'Preview unavailable' : 'Preparing preview…'));comparison.append(figure);
  }
  const info = node('div','detail-info');const left = node('div');left.append(node('p','',date(record.createdAt)),node('p','',`${record.referenceIds?.length || 0} reference photos associated with this try-on`),node('p','', isMock(record) ? 'Mock mode · the result is the original image' : `${modelLabel(record.model)} · ${record.settings?.quality || 'low'} quality`));
  if (record.status === 'pending') {
    const progress = node('p','request-progress',progressText(record));progress.dataset.progressId = record.id;left.append(progress);
  }
  if (!isMock(record)) {
    const request = node('details','request-details');request.append(node('summary','','Request details'));
    request.append(node('p','',record.submittedAt ? `API request started: ${date(record.submittedAt)}` : 'API request not started yet.'));
    if (record.requestId) request.append(node('p','',`OpenAI request: ${record.requestId}`));
    request.append(node('p','',`Client request: ${record.id}`));left.append(request);
  }
  const right = node('div');right.append(node('strong','',record.costUsd == null ? (record.status === 'pending' ? '—' : 'Unknown') : dollars(record.costUsd,true)),node('p','',record.costUsd == null ? 'Usage unavailable · excluded from total' : isMock(record) ? 'USD · no API charge' : 'USD · estimated from API usage'));info.append(left,right);
  const actions = node('div','detail-actions');actions.append(sourceLink(record,'button primary','Visit original page ↗'));
  if (record.status === 'completed') actions.append(likeButton(record,{onChange:refresh,onError:message => toast(message,true)}));
  if (record.result) {
    const download = node('a','button','Download preview ↓');download.href = blobUrl(record.result,detailUrls);download.download = `clothes-but-me-${record.id.slice(0,8)}.${record.result.type.includes('png') ? 'png' : record.result.type.includes('webp') ? 'webp' : record.result.type.includes('avif') ? 'avif' : record.result.type.includes('gif') ? 'gif' : 'jpg'}`;actions.append(download);
  }
  const deleteButton = node('button','delete-link','Delete try-on');deleteButton.type = 'button';deleteButton.addEventListener('click', () => confirmDelete(record.id));actions.append(deleteButton);
  content.append(header,comparison,info);
  if (record.error) content.append(node('p','detail-warning',record.error));
  content.append(actions);
  const dialog = $('#detail-dialog');dialog.setAttribute('aria-labelledby','detail-title');
  if (!dialog.open) dialog.showModal();
}

function confirmDelete(id) {
  const dialog = $('#delete-dialog');dialog.returnValue = '';
  dialog.addEventListener('close', async function onClose() {
    dialog.removeEventListener('close',onClose);
    if (dialog.returnValue !== 'delete') return;
    try {
      await remove('generations',id);$('#detail-dialog').close();await refresh();channel.postMessage('generations');toast('Try-on deleted. Your cost history is kept.');
    } catch (error) { toast(error.message,true); }
  });
  dialog.showModal();
}

function route() {
  const hash = location.hash.slice(1);
  const view = ['references','settings'].includes(hash) ? hash : 'history';
  document.querySelectorAll('.view').forEach(section => { section.hidden = section.id !== `${view}-view`; });
  document.querySelectorAll('nav a').forEach(a => { a.classList.toggle('active',a.dataset.view === view);if(a.dataset.view === view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current'); });
  if (hash.startsWith('generation=') && !$('#detail-dialog').open) {
    try { openDetail(decodeURIComponent(hash.slice(11)),false); } catch { /* Invalid bookmark: show history. */ }
  }
}

$('#detail-dialog').addEventListener('close', () => { revoke(detailUrls);history.replaceState(null,'','#history');route(); });
$('#detail-dialog').addEventListener('click',e => { if(e.target === $('#detail-dialog')) { const box = e.target.getBoundingClientRect();if(e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom)e.target.close(); } });
$('#search').addEventListener('input',renderHistory);
$('#sort').addEventListener('change',renderHistory);
function setFilter(value) {
  filter = value;
  for (const name of ['all','liked','failed']) {
    $(`#${name}-filter`).classList.toggle('selected',value === name);
    $(`#${name}-filter`).setAttribute('aria-pressed',String(value === name));
  }
  renderHistory();
}
$('#all-filter').addEventListener('click',() => setFilter('all'));
$('#liked-filter').addEventListener('click',() => setFilter('liked'));
$('#failed-filter').addEventListener('click',() => setFilter('failed'));
$('#reset-search').addEventListener('click',() => { $('#search').value = '';setFilter('all'); });
$('#reference-input').addEventListener('change',e => upload([...e.target.files]));
$('#dropzone').addEventListener('keydown',e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault();$('#reference-input').click(); } });
for (const type of ['dragover','dragenter']) $('#dropzone').addEventListener(type,e => { e.preventDefault();$('#dropzone').classList.add('dragging'); });
for (const type of ['dragleave','drop']) $('#dropzone').addEventListener(type,e => { e.preventDefault();$('#dropzone').classList.remove('dragging');if(type === 'drop')upload([...e.dataTransfer.files]); });
$('#export-costs').addEventListener('click',() => {
  const rows = [['generation_id','created_at','model','cost_usd','cost_source','usage_json','pricing_json','request_id','status'],...ledger.map(row => [row.id,new Date(row.createdAt).toISOString(),row.model,row.costUsd ?? '',row.costSource,JSON.stringify(row.usage),JSON.stringify(row.pricing),row.requestId || '',row.status || 'completed'])];
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"','""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a = node('a');a.href = url;a.download = 'clothes-but-me-costs.csv';a.click();setTimeout(() => URL.revokeObjectURL(url),1000);
});
addEventListener('hashchange',route);
addEventListener('visibilitychange',() => { if (!document.hidden)refresh(); });
addEventListener('beforeunload',() => { revoke(historyUrls);revoke(referenceUrls);revoke(detailUrls);channel.close(); });
const progressTimer = setInterval(() => {
  for (const element of document.querySelectorAll('[data-progress-id]')) {
    const record = generations.find(item => item.id === element.dataset.progressId);
    if (record) element.textContent = progressText(record);
  }
},1000);
addEventListener('beforeunload',() => clearInterval(progressTimer));
function updateProvider() {
  const mock = settings.mode === 'mock';
  $('#provider-label').textContent = mock ? 'Mock mode' : hasApiKey ? modelLabel(settings.model) : 'Setup needed';
  $('#provider-note').textContent = mock ? 'Original image · 10-second delay' : hasApiKey ? `${settings.quality} quality · ${settings.complexity} complexity` : 'Add your API key in Settings & costs.';
}
async function loadSettings() {
  const config = await chrome.runtime.sendMessage({type:'CBM_PUBLIC_CONFIG'});
  settings = normalizeSettings(config.settings);hasApiKey = config.hasKey;
  for (const key of ['mode','model','quality','complexity','size']) $(`#generation-${key}`).value = settings[key];
  $('#api-key').placeholder = hasApiKey ? 'Key saved · enter a new key to replace it' : 'Paste your OpenAI API key';
  $('#key-status').textContent = hasApiKey ? 'API key saved locally.' : 'No API key saved.';
  $('#remove-key').hidden = !hasApiKey;
  updateProvider();
}
$('#generation-form').addEventListener('submit',async event => {
  event.preventDefault();$('#save-settings').disabled = true;
  try {
    const generationSettings = normalizeSettings(Object.fromEntries(['mode','model','quality','complexity','size'].map(key => [key,$(`#generation-${key}`).value])));
    const key = $('#api-key').value.trim();
    if (key && (/\s/.test(key) || key.length < 20)) throw new Error('Paste a complete OpenAI API key, without spaces.');
    await chrome.storage.local.set({generationSettings,...(key ? {openaiApiKey:key} : {})});
    $('#api-key').value = '';
    await loadSettings();toast('Generation settings saved.');
  } catch (error) { toast(error.message,true); }
  finally { $('#save-settings').disabled = false; }
});
$('#remove-key').addEventListener('click',async () => {
  try { await chrome.storage.local.remove('openaiApiKey');await loadSettings();toast('API key removed.'); }
  catch (error) { toast(error.message,true); }
});
loadSettings().catch(error => toast(`Could not load settings: ${error.message}`,true));
let defaultPrompt = '';
let promptMode = 'default';
let customPrompt = '';
function showPrompt() {
  const custom = promptMode === 'custom';
  for (const button of document.querySelectorAll('[data-prompt-mode]')) button.setAttribute('aria-checked',String(button.dataset.promptMode === promptMode));
  $('#prompt-text').readOnly = !custom;
  $('#prompt-text').value = custom ? customPrompt || defaultPrompt : defaultPrompt;
  $('#prompt-actions').hidden = !custom;
  $('#prompt-mode-note').textContent = custom ? 'New try-ons use your custom prompt.' : 'The default comes from prompts/try-on.txt. Switch to Custom to edit your own copy.';
}
async function loadPrompt() {
  const [response,stored] = await Promise.all([fetch(chrome.runtime.getURL('prompts/try-on.txt')),chrome.storage.local.get(['promptMode','customPrompt'])]);
  defaultPrompt = response.ok ? await response.text() : '';
  customPrompt = typeof stored.customPrompt === 'string' ? stored.customPrompt : '';
  promptMode = stored.promptMode === 'custom' && customPrompt.trim() ? 'custom' : 'default';
  showPrompt();
}
for (const button of document.querySelectorAll('[data-prompt-mode]')) button.addEventListener('click',async () => {
  if (button.dataset.promptMode === promptMode) return;
  promptMode = button.dataset.promptMode;
  try {
    // Switching to Custom with nothing saved yet starts from a copy of the default.
    if (promptMode === 'custom' && !customPrompt.trim()) customPrompt = defaultPrompt;
    await chrome.storage.local.set({promptMode,customPrompt});
    showPrompt();toast(promptMode === 'custom' ? 'Using your custom prompt.' : 'Using the default prompt.');
  } catch (error) { toast(error.message,true); }
});
$('#prompt-form').addEventListener('submit',async event => {
  event.preventDefault();
  const text = $('#prompt-text').value;
  if (!text.trim()) { toast('The prompt can’t be empty.',true);return; }
  $('#save-prompt').disabled = true;
  try { customPrompt = text;await chrome.storage.local.set({promptMode:'custom',customPrompt});toast('Custom prompt saved. New try-ons will use it.'); }
  catch (error) { toast(error.message,true); }
  finally { $('#save-prompt').disabled = false; }
});
$('#copy-default').addEventListener('click',() => { $('#prompt-text').value = defaultPrompt;$('#prompt-text').focus(); });
loadPrompt().catch(error => toast(`Could not load prompt: ${error.message}`,true));
async function renderSkippedSites() {
  const stored = await chrome.storage.local.get('skippedSites');
  const list = skippedSites(stored.skippedSites);
  const container = $('#skipped-sites-list');container.replaceChildren();
  if (!list.length) container.append(node('p','muted','No skipped websites.'));
  for (const hostname of list) {
    const row = node('div','skipped-site-row');
    const button = node('button','','Remove');button.type = 'button';
    button.setAttribute('aria-label',`Remove ${hostname} from skipped websites`);
    button.addEventListener('click',async () => {
      button.disabled = true;
      try {
        const result = await chrome.runtime.sendMessage({type:'CBM_SKIP_SITE',hostname,skip:false});
        if (!result?.ok) throw new Error(result?.error || 'Could not update skipped websites.');
        await renderSkippedSites();toast(`${hostname} enabled.`);
      } catch (error) { toast(error.message,true);button.disabled = false; }
    });
    row.append(node('span','',hostname),button);container.append(row);
  }
}
$('#skip-site-form').addEventListener('submit',async event => {
  event.preventDefault();
  const hostname = siteHostname($('#skip-hostname').value);
  if (!hostname) { toast('Enter a valid website, such as youtube.com.',true);return; }
  const button = $('#skip-site-form button');button.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({type:'CBM_SKIP_SITE',hostname,skip:true});
    if (!result?.ok) throw new Error(result?.error || 'Could not skip this website.');
    $('#skip-hostname').value = '';await renderSkippedSites();toast(`${hostname} skipped.`);
  } catch (error) { toast(error.message,true); }
  finally { button.disabled = false; }
});
chrome.storage.onChanged.addListener((changes,area) => {
  if (area === 'local' && changes.skippedSites) renderSkippedSites().catch(error => toast(error.message,true));
});
renderSkippedSites().catch(error => toast(`Could not load skipped websites: ${error.message}`,true));
refresh();
