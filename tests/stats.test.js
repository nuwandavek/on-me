import test from 'node:test';
import assert from 'node:assert/strict';
import {topSites,weeklyCounts,usageStats,siteOf} from '../extension/lib/stats.js';

const at = (y,m,d,h = 12) => new Date(y,m,d,h).getTime();

test('folds sites beyond the top five into Other',() => {
  const urls = ['a','a','a','b','b','c','d','e','f','g'].map(s => ({pageUrl:`https://www.${s}.com/x`}));
  const rows = topSites(urls);
  assert.deepEqual(rows.map(r => [r.site,r.count]),[['a.com',3],['b.com',2],['c.com',1],['d.com',1],['e.com',1],['Other (2 sites)',2]]);
  assert.equal(rows.at(-1).other,true);
  assert.equal(topSites(urls.slice(0,3)).some(r => r.other),false);
  assert.equal(siteOf('not a url'),'Unknown');
});

test('counts try-ons per Monday-start week, zero-filled',() => {
  const now = new Date(2026,10,7,12); // Saturday
  const rows = weeklyCounts([{createdAt:at(2026,10,2,9)},{createdAt:at(2026,10,7)},{createdAt:at(2026,10,1)}],3,now);
  assert.deepEqual(rows.map(r => r.count),[0,1,2]);
  assert.equal(new Date(rows.at(-1).start).getDay(),1);
});

test('summarizes usage without counting mock costs or pending try-ons',() => {
  const now = at(2026,10,7);
  const records = [
    {status:'completed',createdAt:at(2026,10,7),pageUrl:'https://a.com',model:'gpt-image-2.6-flare',generatingAt:1000,completedAt:41000,liked:true},
    {status:'completed',createdAt:at(2026,10,6),pageUrl:'https://b.com',model:'gpt-image-2.6-flare',generatingAt:1000,completedAt:61000},
    {status:'failed',createdAt:at(2026,8,1),pageUrl:'https://a.com',model:'gpt-image-2.6-flare'},
    {status:'pending',createdAt:at(2026,10,7),pageUrl:'https://c.com',model:'gpt-image-2.6-flare'},
  ];
  const ledger = [{costUsd:.05,costSource:'usage'},{costUsd:.07,costSource:'usage'},{costUsd:0,costSource:'mock'},{costUsd:null}];
  const s = usageStats(records,ledger,now);
  assert.equal(s.total,4);assert.equal(s.failed,1);assert.equal(s.liked,1);assert.equal(s.sites,3);
  assert.equal(s.successRate,2 / 3);assert.equal(s.last30,3);assert.equal(s.medianSeconds,60);
  assert.ok(Math.abs(s.averageCost - .06) < 1e-9);
  assert.equal(usageStats([],[]).successRate,null);
});
