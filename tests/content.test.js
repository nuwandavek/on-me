// Runs the real content script in jsdom, driving it the way Chrome does: messages in via
// chrome.runtime.onMessage, messages out via chrome.runtime.sendMessage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const source = await readFile(new URL('../extension/content.js',import.meta.url),'utf8');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// Objects made inside the jsdom window have that realm's prototypes; compare plain copies.
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setTimeout(resolve,0));

function page({enabled = false,html = ''} = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><p>Shop</p>${html}</body></html>`,{runScripts:'outside-only',pretendToBeVisual:true});
  const {window} = dom;
  // The extension uses a closed shadow root; open it so the test can look inside.
  const attach = window.Element.prototype.attachShadow;
  window.Element.prototype.attachShadow = function () { return attach.call(this,{mode:'open'}); };
  // Report every observed image as on screen, so hangers get created.
  window.IntersectionObserver = class { constructor(callback) { this.callback = callback; } observe(target) { this.callback([{target,isIntersecting:true}]); } disconnect(){} };
  window.ResizeObserver = class { observe(){} disconnect(){} };
  const listeners = new Set();const sent = [];
  const replies = {CBM_SITE_STATUS:{ok:true,enabled},CBM_COMPARE_STEP:{ok:true},CBM_TOGGLE_LIKE:{ok:true,liked:true},CBM_OPEN:{ok:true}};
  window.chrome = {runtime:{id:'ext',
    sendMessage:async message => { sent.push(plain(message));return replies[message.type]; },
    onMessage:{addListener:fn => listeners.add(fn),removeListener:fn => listeners.delete(fn)},
  }};
  window.eval(source);
  const root = () => window.document.getElementById('cbm-extension-root')?.shadowRoot ?? null;
  // Deliver a message to every listener, like Chrome; collect the replies.
  function deliver(message) {
    const got = [];
    for (const fn of [...listeners]) fn(message,{id:'ext'},value => got.push(plain(value)));
    return got;
  }
  const show = (n = 2,total = 3,extra = {}) => deliver({type:'CBM_SHOW_COMPARISON',id:`id${n}`,original:PNG,result:PNG,liked:false,model:'gpt-image-2.6-flare',pageUrl:'https://www.shop.test/dress',...extra,
    position:n,total,hasPrev:n > 1,hasNext:n < total,...extra});
  return {window,root,listeners,sent,replies,deliver,show};
}

test('on a site where try-ons are off, the page shows nothing until a comparison is opened',async () => {
  const app = page({enabled:false});await tick();
  assert.equal(app.root(),null);
  assert.equal(app.listeners.size,2);
  assert.deepEqual(app.show(),[{ok:true}]);
  assert.ok(app.root().querySelector('.dialog'));
  assert.equal(app.root().querySelectorAll('.try').length,0,'no hangers in dialog-only mode');
});

test('stepping with the chevrons works on an off site, and closing unmounts everything',async () => {
  const app = page({enabled:false});await tick();
  app.show(2);
  app.root().querySelector('.next').click();await tick();
  assert.deepEqual(app.sent.at(-1),{type:'CBM_COMPARE_STEP',id:'id2',direction:1});
  // The background answers a step by sending the next comparison: it must be accepted.
  assert.deepEqual(app.show(3),[{ok:true}]);
  assert.equal(app.root().querySelectorAll('.dialog').length,1);
  assert.equal(app.root().querySelector('.position').textContent,'3 of 3');
  app.root().querySelector('.close').click();
  assert.equal(app.root(),null);
  assert.equal(app.listeners.size,2,'dialog listener removed');
  assert.deepEqual(app.show(1),[{ok:true}],'can open again after closing');
});

test('on an enabled site, exactly one listener answers each comparison',async () => {
  const app = page({enabled:true});await tick();
  assert.ok(app.root());
  assert.deepEqual(app.show(),[{ok:true}]);
  assert.deepEqual(app.show(3),[{ok:true}]);
  assert.equal(app.root().querySelectorAll('.dialog').length,1);
  app.root().querySelector('.close').click();
  assert.ok(app.root(),'hangers stay mounted after closing on an enabled site');
});

test('chevrons hide at the ends and arrow keys step',async () => {
  const app = page();await tick();
  app.show(1,3);
  assert.equal(app.root().querySelector('.prev').hidden,true);
  assert.equal(app.root().querySelector('.next').hidden,false);
  const veil = app.root().querySelector('.veil');
  veil.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await tick();
  assert.equal(app.sent.filter(m => m.type === 'CBM_COMPARE_STEP').length,0,'no step past the newest');
  veil.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await tick();
  assert.deepEqual(app.sent.at(-1),{type:'CBM_COMPARE_STEP',id:'id1',direction:1});
  app.show(3,3);
  assert.equal(app.root().querySelector('.next').hidden,true);
  app.show(1,1);
  assert.equal(app.root().querySelector('.position').textContent,'','no counter for a single try-on');
});

test('a failed step shows the error and leaves the dialog usable',async () => {
  const app = page();await tick();
  app.replies.CBM_COMPARE_STEP = {ok:false,error:'No more try-ons in that direction.'};
  app.show(2);
  app.root().querySelector('.next').click();await tick();
  assert.equal(app.root().querySelector('.notice').textContent,'No more try-ons in that direction.');
  assert.equal(app.root().querySelector('.next').disabled,false);
});

test('dialog layout: heart and chevrons sit on the images; no filler text',async () => {
  const app = page();await tick();
  app.show(2);
  const [original,result] = app.root().querySelectorAll('.photo');
  assert.ok(result.querySelector('.like'),'heart on the try-on image');
  assert.ok(original.querySelector('.prev'));assert.ok(result.querySelector('.next'));
  assert.equal(app.root().querySelector('footer .like'),null);
  assert.equal(app.root().querySelector('.status'),null);
  assert.equal(app.root().querySelector('.tag'),null);
  assert.equal(app.root().querySelector('.brand').textContent.trim(),'on me.');
});

test('after the extension is reloaded, clicks explain how to recover instead of throwing',async () => {
  const app = page();await tick();
  app.show(2);
  app.window.chrome.runtime = undefined; // What Chrome does to orphaned content scripts.
  for (const selector of ['.library','.next','.like']) {
    app.root().querySelector('.notice')?.remove();
    app.root().querySelector(selector).click();await tick();
    assert.match(app.root().querySelector('.notice')?.textContent ?? '',/extension was reloaded\. Refresh this page/,selector);
  }
});

test('rejects comparisons that are not image data URLs',async () => {
  const app = page();await tick();
  const got = app.deliver({type:'CBM_SHOW_COMPARISON',id:'x',original:'https://evil.test/a.png',result:PNG,position:1,total:1});
  assert.deepEqual(got,[{ok:false,error:'This comparison could not be displayed.'}]);
  assert.equal(app.root(),null,'nothing left mounted');
});

test('"All try-ons" opens that try-on in the dashboard and closes the dialog',async () => {
  const app = page({enabled:false});await tick();
  app.show(2);
  const button = app.root().querySelector('.library');
  assert.equal(button.textContent.trim(),'All try-ons');
  button.click();await tick();
  assert.deepEqual(app.sent.at(-1),{type:'CBM_OPEN',id:'id2'});
  assert.equal(app.root(),null,'dialog gone (and the off-site mount with it)');
});

test('"View product" links to the page the clothing came from, in a new tab, only for web pages',async () => {
  const app = page();await tick();
  app.show(2);
  const link = app.root().querySelector('.product');
  assert.equal(link.hidden,false);
  assert.equal(link.href,'https://www.shop.test/dress');
  assert.equal(link.target,'_blank');assert.match(link.rel,/noopener/);
  assert.equal(link.title,'shop.test');
  for (const pageUrl of [null,'javascript:alert(1)','not a url']) {
    app.show(2,3,{pageUrl});
    const hidden = app.root().querySelector('.product');
    assert.equal(hidden.hidden,true,String(pageUrl));assert.equal(hidden.hasAttribute('href'),false);
  }
});

test('a hanger click sends the link the image sits in, so the product can be reopened later',async () => {
  const app = page({enabled:true,html:'<a href="https://shop.test/p/hoodie-123"><img id="linked" alt="Hoodie"></a><img id="plain" alt="Tee">'});
  app.replies.CBM_TRY_ON = {ok:true};
  await tick();
  const buttons = [...app.root().querySelectorAll('.try')];
  assert.equal(buttons.length,2,'one hanger per image');
  for (const button of buttons) { button.click();await tick(); }
  const sent = app.sent.filter(m => m.type === 'CBM_TRY_ON');
  assert.deepEqual(sent.map(m => [m.imageAlt,m.linkUrl]),[['Hoodie','https://shop.test/p/hoodie-123'],['Tee',null]]);
});
