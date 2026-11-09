(() => {
  // After the extension is reloaded, this old copy of the script stays on open pages but
  // loses chrome.runtime. Turn that into one clear instruction instead of a TypeError.
  const RELOADED = 'The extension was reloaded. Refresh this page to try again.';
  async function send(message) {
    if (!globalThis.chrome?.runtime?.id) throw new Error(RELOADED);
    try { return await chrome.runtime.sendMessage(message); }
    catch (error) { throw String(error?.message).includes('Extension context invalidated') ? new Error(RELOADED) : error; }
  }
  let teardown = null;
  // True while mounted only to show a comparison on a site where try-ons are off.
  let dialogOnly = false;
  let revision = 0;
  async function syncSite() {
    const current = ++revision;
    try {
      const state = await send({type:'CBM_SITE_STATUS'});
      if (current !== revision) return;
      if (state?.enabled && (!teardown || dialogOnly)) { teardown?.();dialogOnly = false;teardown = mount(); }
      else if (!state?.enabled && teardown && !dialogOnly) { teardown();teardown = null; }
    } catch {
      // Stay inactive if the extension was reloaded or policy could not be read.
      if (current === revision && teardown) { teardown();teardown = null;dialogOnly = false; }
    }
  }
  chrome.runtime.onMessage.addListener((message,sender,reply) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'CBM_REFRESH_SITE_STATE') return;
    syncSite().then(() => reply({ok:true}));return true;
  });
  // Comparisons the user opens from the sidebar show on any website. Where try-ons are
  // off, mount just the dialog (no hangers, no image scanning) and unmount when it closes.
  chrome.runtime.onMessage.addListener((message,sender,reply) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'CBM_SHOW_COMPARISON' || teardown) return;
    dialogOnly = true;
    const unmount = () => { if (dialogOnly) { teardown?.();teardown = null;dialogOnly = false; } };
    teardown = mount({scan:false,onClose:unmount});
    // A rejected comparison opens no dialog, so nothing would ever close this mount.
    teardown.show(message,sender,response => { if (!response?.ok) unmount();reply(response); });
  });
  function mount({scan = true,onClose} = {}) {
  if (document.getElementById('cbm-extension-root')) return Object.assign(() => {},{show:(m,s,reply) => reply({ok:false,error:'This comparison could not be displayed.'})});
  let disposed = false;
  const host = document.createElement('div');
  host.id = 'cbm-extension-root';
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;pointer-events:none!important;z-index:2147483647!important;';
  const root = host.attachShadow({ mode: 'closed' });
  const hanger = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 7a3 3 0 0 1 6 0c0 2-3 2-3 4v1m0 0L3 17a1 1 0 0 0 .5 2h17a1 1 0 0 0 .5-2l-9-5Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const style = document.createElement('style');
  style.textContent = `
    :host { all:initial; font-family:Arial,sans-serif; color:#24251f; }
    * { box-sizing:border-box; } button,a { -webkit-tap-highlight-color:transparent; }
    button { font:inherit; cursor:pointer; } button:focus-visible,a:focus-visible { outline:3px solid #ea5037;outline-offset:4px; }
    .try { pointer-events:auto;position:absolute;display:flex;align-items:center;justify-content:center;gap:0;min-width:36px;height:36px;padding:0 7px;border:1px solid #fff9;border-radius:30px;background:#faf8f1;color:#24251f;box-shadow:0 2px 12px #0002;font:600 12px Arial,sans-serif;transition:background .18s,box-shadow .18s; }
    .try:hover { background:#fff;box-shadow:0 3px 16px #0003; } .try svg { display:block;flex:0 0 20px;width:20px;height:20px;color:#dc4a32; }
    .try span { max-width:0;margin-left:0;opacity:0;overflow:hidden;white-space:nowrap;transition:max-width .2s,margin-left .2s,opacity .2s; }
    .try:hover span,.try:focus-visible span { max-width:70px;margin-left:7px;opacity:1; }
    .try.busy { cursor:wait; } .try.busy svg { display:none; }
    .try.busy::before { content:'';width:16px;height:16px;border:1.5px solid #ddcbb7;border-top-color:#d74730;border-radius:50%;animation:spin 1s linear infinite; }
    .notice { position:fixed;bottom:24px;right:24px;max-width:360px;pointer-events:auto;background:#f8f7f2;color:#a5442d;box-shadow:0 4px 25px #0002;padding:14px 18px;border-radius:8px;font:13px/1.6 Arial,sans-serif; }
    .veil { pointer-events:auto;position:fixed;inset:0;background:#181a176b;display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(5px);animation:appear .2s ease; }
    .dialog { width:min(820px,100%);max-height:calc(100dvh - 48px);overflow:auto;background:#f8f7f2;border-radius:16px;box-shadow:0 22px 100px #0003;font:14px/1.5 Arial,sans-serif; }
    header { display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #dfdfd5; }
    .brand { display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;letter-spacing:-.5px; } .brand svg { width:28px;height:28px;color:#d74730; } .brand>span { font-family:OnMeWordmark,Georgia,serif;font-style:italic;font-weight:700;font-size:23px;letter-spacing:0;line-height:1; }
    .frame { position:relative;width:min(820px,100%);max-height:100%;display:flex; } .frame>.dialog { width:100%; } .step { position:absolute;top:50%;transform:translateY(-50%);z-index:1;width:36px;height:36px;border:0;border-radius:50%;background:#faf9f1d9;color:#30382a;display:grid;place-items:center;padding:0;cursor:pointer; } .step:hover { background:#fffaf2; } .step:disabled { opacity:.6;cursor:wait; } .step[hidden] { display:none; } .step svg { width:24px;height:24px;fill:currentColor; } .step.prev { left:10px; } .step.prev svg { transform:rotate(180deg); } .step.next { right:10px; } .header-end { display:flex;align-items:center;gap:10px; } .position { font-size:12px;color:#707267;font-variant-numeric:tabular-nums; } .close { width:32px;height:32px;border:0;background:transparent;border-radius:50%;color:#595b51;display:grid;place-items:center;padding:0; } .close svg { width:22px;height:22px;fill:currentColor; } .close:hover { background:#e9e8df; }
     
    .comparison { display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px 24px; } figure { margin:0;min-width:0; }
    figcaption { font-size:11px;color:#707267;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px; }
    .photo { background:#eae9e2;border-radius:7px;aspect-ratio:1/1;width:100%;max-width:min(48vh,420px);margin:0 auto;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative; }
    img { width:100%;height:100%;object-fit:contain; } .working img { opacity:.18;filter:blur(4px); } .work-label { position:absolute;display:flex;flex-direction:column;align-items:center;gap:12px;font-size:12px; }
    .spinner { border:2px solid #cfcec5;border-top-color:#d74730;width:26px;height:26px;border-radius:50%;animation:spin .8s linear infinite; }
     .status.error { color:#aa3b27; }
    footer { border-top:1px solid #dfdfd5;display:flex;justify-content:flex-end;align-items:center;gap:12px;padding:12px 24px;margin-top:8px; }
    .like { position:absolute;top:10px;right:10px;z-index:1;display:flex;align-items:center;justify-content:center;width:36px;height:36px;padding:9px;border:0;border-radius:50%;background:#faf9f1d9;color:#818b73;cursor:pointer; } .like svg { display:block;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round; } .like:hover { background:#fffaf2;color:#d9513a; } .like[aria-pressed=true] { color:#d9513a; } .like[aria-pressed=true] svg { fill:currentColor; } .like:disabled { opacity:.6;cursor:wait; }
    .library { border:0;background:#272920;color:#faf9f4;border-radius:7px;font-size:12px;font-weight:600;padding:12px 17px;display:inline-flex;align-items:center;gap:7px; } .library svg { width:16px;height:16px;fill:currentColor; } .library:hover { background:#45473e; } .product { border:1px solid #d6d6cb;color:#33352c;border-radius:7px;font-size:12px;font-weight:600;padding:11px 16px;display:inline-flex;align-items:center;gap:7px;text-decoration:none; } .product svg { width:16px;height:16px;fill:currentColor; } .product:hover { background:#efeee6; } .product[hidden] { display:none; }
    @keyframes spin { to { transform:rotate(360deg); } } @keyframes appear { from { opacity:0;transform:translateY(8px); } to { opacity:1;transform:translateY(0); } }
    @media(max-width:500px) { .veil { padding:12px; } .step { width:32px;height:32px; } .step.prev { left:6px; } .step.next { right:6px; } .dialog { max-height:calc(100dvh - 24px); } header { padding:16px; } .comparison { padding:16px;gap:8px; } .photo { max-width:38vh; }   footer { padding:10px 16px; } }
    @media(prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none!important;transition:none!important; } }
  `;
  root.append(style);
  document.documentElement.append(host);

  let currentDialog = null;
  let lastFocus = null;
  function closeDialog() {
    currentDialog?.remove();
    currentDialog = null;
    lastFocus?.focus();
    onClose?.();
  }

  function capture(img) {
    try {
      const scale = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } catch { return undefined; }
  }

  const running = new Set();
  let noticeTimer;
  function showError(message) {
    clearTimeout(noticeTimer);
    root.querySelector('.notice')?.remove();
    const notice = document.createElement('div');notice.className = 'notice';
    notice.setAttribute('role','alert');notice.textContent = message;root.append(notice);
    noticeTimer = setTimeout(() => notice.remove(),7000);
  }

  // The "on me." wordmark font (a 2.6 KB subset of Cormorant Garamond Bold Italic, OFL), embedded so a
  // page's font rules can't block it. Registered on the page once, the first time a comparison opens.
  const WORDMARK_FONT = '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';
  function loadWordmark() {
    try {
      if ([...document.fonts].some(face => face.family === 'OnMeWordmark')) return;
      const bytes = Uint8Array.from(atob(WORDMARK_FONT), c => c.charCodeAt(0));
      document.fonts.add(new FontFace('OnMeWordmark', bytes.buffer, {style:'italic', weight:'700'}));
    } catch {} // Falls back to an italic serif.
  }

  async function tryOn(img, button) {
    if (running.has(img)) {
      send({type:'CBM_PANEL_OPEN'}).then(response => {
        if (!response?.ok) showError(response?.error || 'Could not open the sidebar.');
      }).catch(error => showError(error.message));
      return;
    }
    running.add(img);button.classList.add('busy');button.setAttribute('aria-busy','true');
    button.querySelector('span').textContent = 'Trying on…';
    try {
      const response = await send({
        type:'CBM_TRY_ON', imageUrl:img.currentSrc || img.src, snapshot:capture(img),
        imageAlt:img.alt, pageUrl:location.href, pageTitle:document.title, linkUrl:img.closest('a[href]')?.href || null,
      });
      if (!response?.ok) throw new Error(response?.error || 'Unable to save this try-on. Please try again.');
    } catch (error) {
      showError(error.message);
    } finally {
      running.delete(img);button.classList.remove('busy');button.removeAttribute('aria-busy');
      button.querySelector('span').textContent = 'Try on';
    }
  }

  function showComparison(message) {
    // Stepping to another try-on swaps the dialog in place: no re-animation, and focus
    // still returns to whatever the user had focused before the first one opened.
    const stepping = Boolean(currentDialog);
    if (stepping) { currentDialog.remove();currentDialog = null; }
    else lastFocus = root.activeElement || document.activeElement;
    loadWordmark();
    const veil = document.createElement('div');
    veil.className = 'veil';
    if (stepping) veil.style.animation = 'none';
    veil.innerHTML = `<div class="frame"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="cbm-title"><header><div class="brand" id="cbm-title">${hanger}<span>on me<span style="color:#d74730">.</span></span></div><div class="header-end"><span class="position"></span><button class="close" aria-label="Close comparison"><svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z"/></svg></button></div></header><div class="comparison"><figure><figcaption>Original</figcaption><div class="photo"><img class="original" alt="Original clothing image"></div></figure><figure><figcaption>Your try-on</figcaption><div class="photo"><img class="result" alt="Mock result: same as original"><button class="like" type="button" aria-label="Like this try-on" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/></svg></button></div></figure></div><footer><a class="product" target="_blank" rel="noopener noreferrer" hidden><svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h240q17 0 28.5 11.5T480-800q0 17-11.5 28.5T440-760H200v560h560v-240q0-17 11.5-28.5T800-480q17 0 28.5 11.5T840-440v240q0 33-23.5 56.5T760-120H200Zm560-584L416-360q-11 11-28 11t-28-11q-11-11-11-28t11-28l344-344H600q-17 0-28.5-11.5T560-800q0-17 11.5-28.5T600-840h200q17 0 28.5 11.5T840-800v200q0 17-11.5 28.5T800-560q-17 0-28.5-11.5T760-600v-104Z"/></svg><span>View product</span></a><button class="library"><svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M200-520q-33 0-56.5-23.5T120-600v-160q0-33 23.5-56.5T200-840h160q33 0 56.5 23.5T440-760v160q0 33-23.5 56.5T360-520H200Zm0 400q-33 0-56.5-23.5T120-200v-160q0-33 23.5-56.5T200-440h160q33 0 56.5 23.5T440-360v160q0 33-23.5 56.5T360-120H200Zm400-400q-33 0-56.5-23.5T520-600v-160q0-33 23.5-56.5T600-840h160q33 0 56.5 23.5T840-760v160q0 33-23.5 56.5T760-520H600Zm0 400q-33 0-56.5-23.5T520-200v-160q0-33 23.5-56.5T600-440h160q33 0 56.5 23.5T840-360v160q0 33-23.5 56.5T760-120H600ZM200-600h160v-160H200v160Zm400 0h160v-160H600v160Zm0 400h160v-160H600v160Zm-400 0h160v-160H200v160Z"/></svg><span>All try-ons</span></button></footer></section></div>`;
    const chevron = `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z"/></svg>`;
    const photos = veil.querySelectorAll('.photo');
    photos[0].insertAdjacentHTML('beforeend',`<button class="step prev" type="button" aria-label="Previous try-on">${chevron}</button>`);
    photos[1].insertAdjacentHTML('beforeend',`<button class="step next" type="button" aria-label="Next try-on">${chevron}</button>`);
    veil.querySelector('.prev').hidden = !message.hasPrev;veil.querySelector('.next').hidden = !message.hasNext;
    if (message.total > 1) veil.querySelector('.position').textContent = `${message.position} of ${message.total}`;
    async function step(direction) {
      const button = veil.querySelector(direction < 0 ? '.prev' : '.next');
      if (button.hidden || button.disabled) return;
      button.disabled = true;
      try {
        const result = await send({type:'CBM_COMPARE_STEP',id:message.id,direction});
        if (!result?.ok) throw new Error(result?.error || 'Could not open that try-on.');
        const next = currentDialog?.querySelector(direction < 0 ? '.prev' : '.next');
        (next && !next.hidden ? next : currentDialog?.querySelector('.close'))?.focus();
      } catch (error) { button.disabled = false;showError(error.message); }
    }
    veil.querySelector('.prev').addEventListener('click',() => step(-1));
    veil.querySelector('.next').addEventListener('click',() => step(1));
    const mock = !message.model || message.model === 'mock-original';
    veil.querySelectorAll('figcaption')[1].textContent = mock ? 'Mock try-on' : 'Your try-on';
    veil.querySelector('.result').alt = mock ? 'Mock result: same as original' : 'Your generated try-on';
    const like = veil.querySelector('.like');
    function updateLike(liked) {
      like.setAttribute('aria-pressed',String(Boolean(liked)));
      like.setAttribute('aria-label',liked ? 'Unlike this try-on' : 'Like this try-on');
    }
    updateLike(message.liked);
    like.addEventListener('click',async () => {
      like.disabled = true;
      try {
        const result = await send({type:'CBM_TOGGLE_LIKE',id:message.id});
        if (!result?.ok) throw new Error(result?.error || 'Could not save your like.');
        updateLike(result.liked);
      } catch (error) { showError(error.message); }
      finally { like.disabled = false; }
    });
    veil.querySelector('.original').src = message.original;
    veil.querySelector('.result').src = message.result;
    // The page the original image came from, so it's easy to go back and buy it.
    const product = veil.querySelector('.product');
    try {
      const url = new URL(message.pageUrl);
      if (url.protocol === 'https:' || url.protocol === 'http:') { product.href = url.href;product.title = url.hostname.replace(/^www\./,'');product.hidden = false; }
    } catch {}
    veil.querySelector('.library').addEventListener('click', () => {
      send({ type: 'CBM_OPEN', id:message.id }).then(closeDialog,error => showError(error.message));
    });
    veil.querySelector('.close').addEventListener('click', closeDialog);
    veil.addEventListener('click', e => { if (e.target === veil) closeDialog(); });
    veil.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation();closeDialog(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault();e.stopPropagation();step(e.key === 'ArrowLeft' ? -1 : 1); }
      if (e.key === 'Tab') {
        const items = [...veil.querySelectorAll('button:not([hidden]),a[href]:not([hidden])')];
        const index = items.indexOf(root.activeElement);
        if (e.shiftKey && index === 0) { e.preventDefault();items.at(-1).focus(); }
        else if (!e.shiftKey && index === items.length - 1) { e.preventDefault();items[0].focus(); }
      }
    });
    root.append(veil);
    currentDialog = veil;
    veil.querySelector('.close').focus();
  }

  const onComparison = (message,sender,reply) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'CBM_SHOW_COMPARISON') return;
    if (![message.original,message.result].every(value => typeof value === 'string' && /^data:image\/(png|jpeg|webp|gif|avif|bmp);base64,/i.test(value))) {
      reply({ok:false,error:'This comparison could not be displayed.'});return;
    }
    showComparison(message);reply({ok:true});
  };
  // Stepping with the chevrons delivers each next comparison as a new message, so the
  // dialog-only mount listens too.
  chrome.runtime.onMessage.addListener(onComparison);
  if (!scan) {
    return Object.assign(() => {
      disposed = true;clearTimeout(noticeTimer);chrome.runtime.onMessage.removeListener(onComparison);host.remove();
    },{show:onComparison});
  }

  const visible = new Map();
  const tracked = new Set();
  let frame = null;
  function schedule() { if (disposed) return;if (frame === null) frame = requestAnimationFrame(position); }
  // The part of an image you can see: its box cut by the window and by every ancestor that clips overflow.
  // Null when an ancestor hides it (a carousel slide or hover image faded to opacity 0).
  function visibleBox(img) {
    const rect = img.getBoundingClientRect();
    const box = {top:Math.max(rect.top, 0), left:Math.max(rect.left, 0), bottom:Math.min(rect.bottom, innerHeight), right:Math.min(rect.right, innerWidth)};
    for (let node = img.parentElement;node && node !== document.body && node !== document.documentElement;node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.opacity === '0' || style.visibility === 'hidden') return null;
      const clipY = style.overflowY !== 'visible', clipX = style.overflowX !== 'visible';
      if (clipX || clipY) {
        const clip = node.getBoundingClientRect();
        if (clipY) { box.top = Math.max(box.top, clip.top);box.bottom = Math.min(box.bottom, clip.bottom); }
        if (clipX) { box.left = Math.max(box.left, clip.left);box.right = Math.min(box.right, clip.right); }
      }
      if (style.position === 'fixed') break;
    }
    return box;
  }
  // What's painted over this point of the image: another picture (a zoom view over thumbnails) hides it,
  // a fixed or sticky bar (site header, cookie banner) returns its box. See-through layers in the page,
  // like a link over a product card, don't count.
  const HIDDEN = {bottom:Infinity};
  function coverAt(x, y, img) {
    for (const element of document.elementsFromPoint(x, y)) {
      if (element === host) continue;
      if (element === img || element.contains(img)) return null;
      if (element instanceof HTMLImageElement || element instanceof HTMLVideoElement || element instanceof HTMLCanvasElement) return HIDDEN;
      for (let node = element;node && node !== document.body;node = node.parentElement) {
        const place = getComputedStyle(node).position;
        if (place === 'fixed' || place === 'sticky') { if (!node.contains(img)) return node.getBoundingClientRect();break; }
      }
    }
    return null;
  }
  function position() {
    frame = null;
    const placed = [];
    for (const [img, button] of visible) {
      if (!img.isConnected) { button.remove();visible.delete(img);continue; }
      const rect = img.getBoundingClientRect();
      const css = getComputedStyle(img);
      let show = img.complete && img.naturalWidth > 0 && rect.width >= 64 && rect.height >= 64 && css.visibility !== 'hidden' && css.opacity !== '0';
      let box = show ? visibleBox(img) : null;
      if (box) {
        // Slide below a sticky header covering the corner instead of floating on top of it.
        const cover = box.bottom > box.top && coverAt(Math.max(box.left, box.right - 28), box.top + 28, img);
        if (cover) box.top = Math.max(box.top, cover.bottom);
      }
      show = Boolean(box) && box.bottom - box.top >= 56 && box.right - box.left >= 56;
      if (show) placed.push({img, button, x:Math.max(52, Math.min(innerWidth - 6, box.right - 10)), y:box.top + 10});
      else { button.hidden = true;button.style.display = 'none'; }
    }
    // Images stacked in one spot (carousel slides, hover swaps) would share a corner: keep the one on top.
    const kept = [];
    for (const spot of placed) {
      const clash = kept.findIndex(other => Math.abs(other.x - spot.x) < 30 && Math.abs(other.y - spot.y) < 30);
      if (clash < 0) { kept.push(spot);continue; }
      const other = kept[clash];
      const [winner, loser] = onTop(spot.img, other.img, spot.x - 18, spot.y + 18) ? [spot, other] : [other, spot];
      kept[clash] = winner;loser.button.hidden = true;loser.button.style.display = 'none';
    }
    for (const {button, x, y} of kept) {
      button.hidden = false;button.style.display = 'flex';
      button.style.top = `${y}px`;button.style.left = `${x}px`;button.style.transform = 'translateX(-100%)';
    }
  }
  function onTop(a, b, x, y) {
    const hits = document.elementsFromPoint(x, y);
    const ia = hits.indexOf(a), ib = hits.indexOf(b);
    if (ia >= 0 || ib >= 0) return ib < 0 || (ia >= 0 && ia < ib);
    return Boolean(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING); // Later in the page paints on top.
  }
  const intersection = new IntersectionObserver(entries => {
    if (disposed) return;
    for (const entry of entries) {
      const img = entry.target;
      if (entry.isIntersecting && !visible.has(img)) {
        const button = document.createElement('button');
        button.type = 'button';button.className = 'try';
        button.title = 'Try on with On Me';
        button.setAttribute('aria-label', `Try on: ${img.alt || 'this image'}`);
        button.innerHTML = `${hanger}<span>Try on</span>`;
        button.addEventListener('click', e => { e.preventDefault();e.stopPropagation();tryOn(img,button); });
        root.append(button);visible.set(img, button);
      } else if (!entry.isIntersecting && visible.has(img)) {
        visible.get(img).remove();visible.delete(img);
      }
    }
    schedule();
  });
  const resize = new ResizeObserver(schedule);
  function track(img) {
    if (tracked.has(img)) return;
    tracked.add(img);intersection.observe(img);resize.observe(img);
    img.addEventListener('load', schedule);
  }
  document.querySelectorAll('img').forEach(track);
  const mutation = new MutationObserver(mutations => {
    if (disposed) return;
    for (const mutation of mutations) for (const node of mutation.addedNodes) {
      if (node.nodeType !== 1 || node === host) continue;
      if (node.matches('img')) track(node);
      node.querySelectorAll('img').forEach(track);
    }
    schedule();
  });
  mutation.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['src','srcset','style','class','hidden'] });
  addEventListener('scroll', schedule, { capture:true, passive:true });
  addEventListener('resize', schedule, { passive:true });
  return () => {
    disposed = true;
    intersection.disconnect();resize.disconnect();mutation.disconnect();
    removeEventListener('scroll',schedule,true);removeEventListener('resize',schedule);
    if (frame !== null) cancelAnimationFrame(frame);
    clearTimeout(noticeTimer);
    for (const image of tracked) image.removeEventListener('load',schedule);
    tracked.clear();visible.clear();
    chrome.runtime.onMessage.removeListener(onComparison);
    host.remove();
  };
  }
  syncSite();
})();
