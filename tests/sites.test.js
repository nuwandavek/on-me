import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {siteHostname,skippedSites,isSkippedSite,isSiteOff,policyListKey} from '../extension/lib/sites.js';

test('normalizes website addresses and rejects non-web URLs',() => {
  assert.equal(siteHostname(' https://WWW.YouTube.com/watch?v=abc '),'youtube.com');
  assert.equal(siteHostname('*.example.com'),'example.com');
  assert.equal(siteHostname('https://shop.example.com.:8443/item'),'shop.example.com');
  assert.equal(siteHostname('chrome://extensions'),null);
  assert.equal(siteHostname('file:///tmp/photo.jpg'),null);
  assert.equal(siteHostname('https://user:password@example.com'),null);
});

test('YouTube is initially skipped, and saving an empty list enables all sites',() => {
  assert.deepEqual(skippedSites(undefined),['youtube.com']);
  assert.equal(isSkippedSite('https://www.youtube.com/watch?v=abc'),true);
  assert.equal(isSkippedSite('https://tv.youtube.com/'),true);
  assert.equal(isSkippedSite('https://youtube.com/',[]),false);
});

test('skipping includes subdomains without blocking lookalike domains',() => {
  const list = ['example.com'];
  assert.equal(isSkippedSite('https://shop.example.com/',list),true);
  assert.equal(isSkippedSite('https://example.com.evil.test/',list),false);
  assert.equal(isSkippedSite('https://notexample.com/',list),false);
  assert.deepEqual(skippedSites(['www.EXAMPLE.com','example.com','shop.example.com']),['example.com','shop.example.com']);
});

test('site mode: on everywhere except skipped, or only on allowed sites',() => {
  assert.equal(isSiteOff('https://www.youtube.com/'),true);
  assert.equal(isSiteOff('https://zara.com/',{}),false);
  const pick = {siteMode:'some',allowedSites:['zara.com'],skippedSites:['zara.com']};
  assert.equal(isSiteOff('https://www.zara.com/item',pick),false);
  assert.equal(isSiteOff('https://shop.zara.com/',pick),false);
  assert.equal(isSiteOff('https://uniqlo.com/',pick),true);
  assert.equal(isSiteOff('https://zara.com/',{siteMode:'some'}),true);
  assert.equal(policyListKey('some'),'allowedSites');
  assert.equal(policyListKey(undefined),'skippedSites');
});

const source = await readFile(new URL('../extension/content.js',import.meta.url),'utf8');
function contentHarness(enabled) {
  const listeners = new Set();const metrics = {scans:0,created:0,removed:0,disconnected:0,removedEvents:[]};
  let connected = false;
  const root = {append(){}};
  const host = {style:{},attachShadow:() => root,remove:() => {connected = false;metrics.removed++;}};
  const document = {
    getElementById:() => connected ? host : null,
    createElement:tag => {metrics.created++;return tag === 'div' ? host : {};},
    documentElement:{append:() => {connected = true;}},
    querySelectorAll:() => {metrics.scans++;return [];},
  };
  class Observer {observe(){}disconnect(){metrics.disconnected++;}}
  const chrome = {runtime:{id:'test',
    sendMessage:async () => ({ok:true,enabled}),
    onMessage:{addListener:callback => listeners.add(callback),removeListener:callback => listeners.delete(callback)},
  }};
  vm.runInNewContext(source,{chrome,document,IntersectionObserver:Observer,ResizeObserver:Observer,MutationObserver:Observer,
    setTimeout,clearTimeout,addEventListener(){},removeEventListener:name => metrics.removedEvents.push(name),requestAnimationFrame:() => 1,cancelAnimationFrame(){},
  });
  return {metrics,listeners,setEnabled:value => {enabled = value;},
    refresh:async () => {
      for (const callback of [...listeners]) {
        await new Promise(resolve => {
          const pending = callback({type:'CBM_REFRESH_SITE_STATE'},{id:'test'},resolve);
          if (!pending) resolve();
        });
      }
    },
  };
}

test('a skipped page performs no DOM scans and creates no extension UI',async () => {
  const app = contentHarness(false);await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.metrics.created,0);assert.equal(app.metrics.scans,0);
  assert.equal(app.listeners.size,2); // Only listens for policy changes and sidebar comparison requests.
});

test('skipping an open page disconnects watchers, and re-enabling resumes scanning',async () => {
  const app = contentHarness(true);await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.metrics.scans,1);
  app.setEnabled(false);await app.refresh();
  assert.equal(app.metrics.removed,1);assert.equal(app.metrics.disconnected,3);
  assert.deepEqual(app.metrics.removedEvents,['scroll','resize']);
  assert.equal(app.listeners.size,2);
  await app.refresh();assert.equal(app.metrics.scans,1);
  app.setEnabled(true);await app.refresh();assert.equal(app.metrics.scans,2);
});
