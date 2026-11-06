import test from 'node:test';
import assert from 'node:assert/strict';
import {editImage} from '../extension/lib/openai.js';
import {usageCost} from '../extension/lib/pricing.js';
import {normalizeSettings} from '../extension/lib/settings.js';

const usage = {input_tokens:1100,input_tokens_details:{text_tokens:100,image_tokens:1000},output_tokens:2000};
const args = {
  original:new Blob(['original'],{type:'image/jpeg'}),references:[new Blob(['me'],{type:'image/jpeg'})],
  prompt:'Use image 1 for clothing; image 2 is the user.',apiKey:'test-key-do-not-log',settings:normalizeSettings(),id:'test-request-id',
};
const reply = (data,status = 200) => new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','x-request-id':'req-test'}});

test('uses Flare low quality with ordered image uploads and the separate prompt',async () => {
  let submitted = false;
  const result = await editImage({...args,onSubmit:async () => {submitted = true;},fetchImpl:async (url,request) => {
    assert.equal(submitted,true);
    assert.equal(url,'https://api.openai.com/v1/images/edits');
    assert.equal(request.headers.Authorization,`Bearer ${args.apiKey}`);
    assert.equal(request.body.get('model'),'gpt-image-2.6-flare');
    assert.equal(request.body.get('quality'),'low');
    assert.equal(request.body.get('complexity'),'low');
    assert.equal(request.body.get('n'),'1');
    assert.equal(request.body.get('prompt'),args.prompt);
    assert.deepEqual(await Promise.all(request.body.getAll('image[]').map(blob => blob.text())),['original','me']);
    assert.equal(request.body.has('apiKey'),false);
    return reply({data:[{b64_json:btoa('result-image')}],usage});
  }});
  assert.equal(await result.result.text(),'result-image');
  assert.equal(result.costUsd,.0685);
  assert.equal(result.requestId,'req-test');
  assert.equal(result.pricing.imageOutput,30);
});

test('missing or incomplete usage stays unknown instead of zero',() => {
  assert.equal(usageCost(null),null);
  assert.equal(usageCost({input_tokens:5,output_tokens:7}),null);
  assert.equal(usageCost({...usage,input_tokens:1101}),null);
  assert.equal(usageCost({...usage,output_tokens_details:{image_tokens:1900,text_tokens:100}}),null);
});

test('successful image with absent usage has unknown cost',async () => {
  const result = await editImage({...args,fetchImpl:async () => reply({data:[{b64_json:btoa('result')} ]})});
  assert.equal(result.costUsd,null);
});

test('failed API requests are not retried and do not expose the key',async () => {
  let calls = 0;
  await assert.rejects(editImage({...args,fetchImpl:async () => {calls++;return reply({error:{message:`invalid ${args.apiKey}`}},429);}}),error => {
    assert.equal(error.message.includes(args.apiKey),false);
    assert.equal(error.billing.costUsd,null);
    return true;
  });
  assert.equal(calls,1);
});

test('validates references before any paid request is submitted',async () => {
  let called = false;
  await assert.rejects(editImage({...args,references:[],fetchImpl:async () => {called = true;}}),/reference photo/);
  assert.equal(called,false);
});

test('network failures have a clear unknown-cost error and no automatic retry',async () => {
  let calls = 0;
  await assert.rejects(editImage({...args,fetchImpl:async () => {calls++;throw new Error('network error');}}),/cost is unknown/);
  assert.equal(calls,1);
});
