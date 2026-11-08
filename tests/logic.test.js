import test from 'node:test';
import assert from 'node:assert/strict';
import {setupState} from '../extension/lib/setup.js';
import {comparisonOrder,comparisonPlace,stepTarget} from '../extension/lib/comparisons.js';
import {updateSiteList} from '../extension/lib/sites.js';
import {detailTitle} from '../extension/lib/model.js';

const real = {status:'completed',model:'gpt-image-2.6-flare'};
const openai = {settings:{mode:'openai'}};

test('setup checklist walks key → photos → where → first try-on',() => {
  assert.deepEqual(setupState({...openai}).current,'key');
  assert.equal(setupState({...openai,hasKey:true}).current,'photos');
  assert.equal(setupState({...openai,hasKey:true,references:1}).current,'photos','one photo is not enough');
  assert.equal(setupState({...openai,hasKey:true,references:2}).current,'where');
  assert.equal(setupState({...openai,hasKey:true,references:2,siteMode:'some'}).current,'try');
  const done = setupState({...openai,hasKey:true,references:2,siteMode:'all'},[real]);
  assert.equal(done.visible,false);assert.equal(done.current,null);
});

test('setup checklist ticks each step independently of order',() => {
  const {steps,current} = setupState({...openai,hasKey:false,references:3,siteMode:'all'});
  assert.deepEqual(steps,{key:false,photos:true,where:true,try:false});
  assert.equal(current,'key');
});

test('setup checklist stays until a real try-on finishes, and hides in mock mode or on Liked',() => {
  const config = {...openai,hasKey:true,references:2,siteMode:'all'};
  assert.equal(setupState(config,[{status:'completed',model:'mock-original'}]).visible,true);
  assert.equal(setupState(config,[{...real,status:'pending'},{...real,status:'failed'}]).visible,true);
  assert.equal(setupState({...config,settings:{mode:'mock'}}).visible,false);
  assert.equal(setupState(config,[],'liked').visible,false);
  assert.equal(setupState({...config,siteMode:'garbage'}).steps.where,false);
});

test('chevrons step newest → oldest through finished try-ons only',() => {
  const records = [
    {id:'old',status:'completed',createdAt:1},{id:'new',status:'completed',createdAt:3},
    {id:'busy',status:'pending',createdAt:4},{id:'mid',status:'completed',createdAt:2},{id:'bad',status:'failed',createdAt:5},
  ];
  const order = comparisonOrder(records);
  assert.deepEqual(order,['new','mid','old']);
  assert.equal(stepTarget(order,'new',1),'mid');
  assert.equal(stepTarget(order,'mid',-1),'new');
  assert.equal(stepTarget(order,'new',-1),null);
  assert.equal(stepTarget(order,'old',1),null);
  assert.equal(stepTarget(order,'missing',1),null);
  assert.equal(stepTarget(order,'new',2),null);
  assert.deepEqual(comparisonPlace(order,'new'),{position:1,total:3,hasPrev:false,hasNext:true});
  assert.deepEqual(comparisonPlace(order,'mid'),{position:2,total:3,hasPrev:true,hasNext:true});
  assert.deepEqual(comparisonPlace(order,'old'),{position:3,total:3,hasPrev:true,hasNext:false});
  assert.deepEqual(comparisonPlace(['solo'],'solo'),{position:1,total:1,hasPrev:false,hasNext:false});
});

test('"all websites" mode: disabling adds to the skip list, enabling removes it',() => {
  assert.deepEqual(updateSiteList({},'zara.com',{turnOff:true}),{key:'skippedSites',list:['youtube.com','zara.com']});
  assert.deepEqual(updateSiteList({skippedSites:['zara.com']},'zara.com',{turnOff:false}),{key:'skippedSites',list:[]});
  // From the open page, a parent entry is removed too so the click actually enables it.
  assert.deepEqual(updateSiteList({skippedSites:['zara.com']},'shop.zara.com',{turnOff:false,fromTab:true}).list,[]);
  assert.deepEqual(updateSiteList({skippedSites:['zara.com']},'shop.zara.com',{turnOff:false}).list,['zara.com']);
});

test('"only sites I pick" mode: enabling adds to the allow list, disabling removes it, skip list untouched',() => {
  const stored = {siteMode:'some',skippedSites:['youtube.com']};
  assert.deepEqual(updateSiteList(stored,'zara.com',{turnOff:false}),{key:'allowedSites',list:['zara.com']});
  assert.deepEqual(updateSiteList({...stored,allowedSites:['zara.com','cos.com']},'zara.com',{turnOff:true}),{key:'allowedSites',list:['cos.com']});
  assert.deepEqual(updateSiteList({...stored,allowedSites:['zara.com']},'shop.zara.com',{turnOff:true,fromTab:true}).list,[]);
});

test('comparison title is the page title or site, never the image alt text',() => {
  const alt = 'Image 1 of 8, For this easy jacket, we reached for a lightweight waxed cotton blend…';
  assert.equal(detailTitle({pageTitle:'  Quilted Jacket | Shop  ',imageAlt:alt,pageUrl:'https://www.shop.com/x'}),'Quilted Jacket | Shop');
  assert.equal(detailTitle({pageTitle:'',imageAlt:alt,pageUrl:'https://www.shop.com/x'}),'shop.com');
  assert.equal(detailTitle({imageAlt:alt,pageUrl:'not a url'}),'Your try-on');
});

test('the link around a clicked image is the product link; otherwise the page is',async () => {
  const {productUrlFor,productLink} = await import('../extension/lib/model.js');
  const page = 'https://www.hollisterco.com/shop/us';
  assert.equal(productUrlFor('https://www.hollisterco.com/shop/us/p/hoodie-123',page),'https://www.hollisterco.com/shop/us/p/hoodie-123');
  assert.equal(productUrlFor(page + '#top',page),null,'a link back to the same page adds nothing');
  for (const bad of [null,'','javascript:alert(1)','not a url','https://x.test/' + 'a'.repeat(5000)]) assert.equal(productUrlFor(bad,page),null,String(bad).slice(0,30));
  assert.equal(productLink({pageUrl:page,productUrl:'https://www.hollisterco.com/p/1'}),'https://www.hollisterco.com/p/1');
  assert.equal(productLink({pageUrl:page}),page,'older try-ons and unlinked images use the page');
  assert.equal(productLink({pageUrl:page,productUrl:'javascript:x'}),page);
});
