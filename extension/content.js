(() => {
  let teardown = null;
  let revision = 0;
  async function syncSite() {
    const current = ++revision;
    try {
      const state = await chrome.runtime.sendMessage({type:'CBM_SITE_STATUS'});
      if (current !== revision) return;
      if (state?.enabled && !teardown) teardown = mount();
      else if (!state?.enabled && teardown) { teardown();teardown = null; }
    } catch {
      // Stay inactive if the extension was reloaded or policy could not be read.
      if (current === revision && teardown) { teardown();teardown = null; }
    }
  }
  chrome.runtime.onMessage.addListener((message,sender,reply) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'CBM_REFRESH_SITE_STATE') return;
    syncSite().then(() => reply({ok:true}));return true;
  });
  function mount() {
  if (document.getElementById('cbm-extension-root')) return () => {};
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
    .brand { display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;letter-spacing:-.5px; } .brand svg { width:28px;height:28px;color:#d74730; }
    .close { width:32px;height:32px;border:0;background:transparent;border-radius:50%;font-size:25px;color:#595b51; } .close:hover { background:#e9e8df; }
    .meta { display:flex;justify-content:space-between;align-items:center;padding:17px 24px 0;gap:12px; } .tag { color:#aa3b27;background:#f1e5da;border-radius:5px;padding:4px 8px;font-size:11px;font-weight:700;letter-spacing:.3px; }
    .comparison { display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px 24px; } figure { margin:0;min-width:0; }
    figcaption { font-size:11px;color:#707267;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px; }
    .photo { background:#eae9e2;border-radius:7px;aspect-ratio:1/1;width:100%;max-width:min(48vh,420px);margin:0 auto;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative; }
    img { width:100%;height:100%;object-fit:contain; } .working img { opacity:.18;filter:blur(4px); } .work-label { position:absolute;display:flex;flex-direction:column;align-items:center;gap:12px;font-size:12px; }
    .spinner { border:2px solid #cfcec5;border-top-color:#d74730;width:26px;height:26px;border-radius:50%;animation:spin .8s linear infinite; }
    .status { color:#707267;font-size:12px;padding:0 24px 18px;margin:0; } .status.error { color:#aa3b27; }
    footer { border-top:1px solid #dfdfd5;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 24px; }
    .like { display:flex;align-items:center;justify-content:center;width:36px;height:36px;padding:9px;border:0;border-radius:50%;background:transparent;color:#929982; } .like svg { display:block;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round; } .like:hover { background:#f1e6da;color:#d9513a; } .like[aria-pressed=true] { color:#d9513a; } .like[aria-pressed=true] svg { fill:currentColor; } .like:disabled { opacity:.6;cursor:wait; }
    .library { border:0;background:#272920;color:#faf9f4;border-radius:7px;font-size:12px;font-weight:600;padding:12px 17px; } .library:hover { background:#45473e; }
    @keyframes spin { to { transform:rotate(360deg); } } @keyframes appear { from { opacity:0;transform:translateY(8px); } to { opacity:1;transform:translateY(0); } }
    @media(max-width:500px) { .veil { padding:12px; } .dialog { max-height:calc(100dvh - 24px); } header { padding:16px; } .comparison { padding:16px;gap:8px; } .photo { max-width:38vh; } .meta { padding:16px 16px 0; } .status { padding:0 16px 16px; } footer { padding:16px; } }
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

  async function tryOn(img, button) {
    if (running.has(img)) {
      chrome.runtime.sendMessage({type:'CBM_PANEL_OPEN'}).then(response => {
        if (!response?.ok) showError(response?.error || 'Could not open the sidebar.');
      }).catch(error => showError(error.message));
      return;
    }
    running.add(img);button.classList.add('busy');button.setAttribute('aria-busy','true');
    button.querySelector('span').textContent = 'Trying on…';
    try {
      const response = await chrome.runtime.sendMessage({
        type:'CBM_TRY_ON', imageUrl:img.currentSrc || img.src, snapshot:capture(img),
        imageAlt:img.alt, pageUrl:location.href, pageTitle:document.title,
      });
      if (!response?.ok) throw new Error(response?.error || 'Unable to save this try-on. Please try again.');
    } catch (error) {
      showError(error.message.includes('Extension context invalidated') ? 'The extension was reloaded. Refresh this page to try again.' : error.message);
    } finally {
      running.delete(img);button.classList.remove('busy');button.removeAttribute('aria-busy');
      button.querySelector('span').textContent = 'Try on';
    }
  }

  function showComparison(message) {
    if (currentDialog) closeDialog();
    lastFocus = root.activeElement || document.activeElement;
    const veil = document.createElement('div');
    veil.className = 'veil';
    veil.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="cbm-title"><header><div class="brand" id="cbm-title">${hanger} clothes but me<span style="color:#d74730">.</span></div><button class="close" aria-label="Close comparison">×</button></header><div class="meta"><span class="tag">MOCK TRY-ON</span><span style="font-size:12px;color:#707267">Your fitting room</span></div><div class="comparison"><figure><figcaption>Original</figcaption><div class="photo"><img class="original" alt="Original clothing image"></div></figure><figure><figcaption>Your try-on</figcaption><div class="photo"><img class="result" alt="Mock result: same as original"></div></figure></div><p class="status">Mock mode uses the original image as your try-on.</p><footer><button class="like" type="button" aria-label="Like this try-on" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/></svg></button><button class="library">View in dashboard ↗</button></footer></section>`;
    const mock = !message.model || message.model === 'mock-original';
    veil.querySelector('.tag').textContent = mock ? 'MOCK TRY-ON' : 'YOUR TRY-ON';
    veil.querySelector('.status').textContent = mock ? 'Mock mode uses the original image as your try-on.' : 'Generated using your saved reference photos.';
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
        const result = await chrome.runtime.sendMessage({type:'CBM_TOGGLE_LIKE',id:message.id});
        if (!result?.ok) throw new Error(result?.error || 'Could not save your like.');
        updateLike(result.liked);
      } catch (error) { showError(error.message); }
      finally { like.disabled = false; }
    });
    veil.querySelector('.original').src = message.original;
    veil.querySelector('.result').src = message.result;
    veil.querySelector('.library').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'CBM_OPEN', id:message.id }).catch(() => {});
    });
    veil.querySelector('.close').addEventListener('click', closeDialog);
    veil.addEventListener('click', e => { if (e.target === veil) closeDialog(); });
    veil.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation();closeDialog(); }
      if (e.key === 'Tab') {
        const items = [...veil.querySelectorAll('button')];
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
  chrome.runtime.onMessage.addListener(onComparison);

  const visible = new Map();
  const tracked = new Set();
  let frame = null;
  function schedule() { if (disposed) return;if (frame === null) frame = requestAnimationFrame(position); }
  function position() {
    frame = null;
    for (const [img, button] of visible) {
      if (!img.isConnected) { button.remove();visible.delete(img);continue; }
      const rect = img.getBoundingClientRect();
      const css = getComputedStyle(img);
      const show = img.complete && img.naturalWidth > 0 && rect.width >= 64 && rect.height >= 64 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth && css.visibility !== 'hidden' && css.opacity !== '0';
      button.hidden = !show;
      button.style.display = show ? 'flex' : 'none';
      if (show) {
        button.style.top = `${Math.max(6, rect.top + 10)}px`;
        button.style.left = `${Math.max(52, Math.min(innerWidth - 6, rect.right - 10))}px`;
        button.style.transform = 'translateX(-100%)';
      }
    }
  }
  const intersection = new IntersectionObserver(entries => {
    if (disposed) return;
    for (const entry of entries) {
      const img = entry.target;
      if (entry.isIntersecting && !visible.has(img)) {
        const button = document.createElement('button');
        button.type = 'button';button.className = 'try';
        button.title = 'Try on with Clothes But Me';
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
