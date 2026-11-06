import test from 'node:test';
import assert from 'node:assert/strict';
import {apiImage} from '../extension/lib/images.js';
import {progressText} from '../extension/lib/progress.js';

test('small supported images pass through without a hidden DOM or canvas encoding',async () => {
  const blob = new Blob(['photo'],{type:'image/jpeg'});let closed = false;
  assert.equal(await apiImage(blob,{
    decode:async () => ({width:500,height:700,close:() => {closed = true;}}),
    canvas:() => {throw new Error('Canvas should not be needed');},
  }),blob);
  assert.equal(closed,true);
});

test('large images resize through OffscreenCanvas-compatible convertToBlob',async () => {
  const output = new Blob(['resized'],{type:'image/jpeg'});let closed = false;
  const result = await apiImage(new Blob(['photo']),{
    decode:async () => ({width:2000,height:1000,close:() => {closed = true;}}),
    canvas:(width,height) => {
      assert.equal(width,1536);assert.equal(height,768);
      return {width,height,getContext:() => ({fillRect(){},drawImage(){}}),convertToBlob:async config => {assert.equal(config.type,'image/jpeg');return output;}};
    },
  });
  assert.equal(result,output);assert.equal(closed,true);
});

test('hung photo decoding times out instead of holding a queue slot forever',async () => {
  await assert.rejects(apiImage(new Blob(['photo']),{decode:() => new Promise(() => {}),timeoutMs:10}),/No API request was sent/);
});

test('hung encoding times out and still releases its bitmap when encoding settles',async () => {
  let finish;let closed = false;
  const pending = apiImage(new Blob(['photo']),{
    decode:async () => ({width:2000,height:1000,close:() => {closed = true;}}),timeoutMs:10,
    canvas:() => ({width:1536,height:768,getContext:() => ({fillRect(){},drawImage(){}}),convertToBlob:() => new Promise(resolve => {finish = resolve;})}),
  });
  await assert.rejects(pending,/preparation took too long/);
  finish(new Blob(['result']));await new Promise(resolve => setImmediate(resolve));assert.equal(closed,true);
});

test('progress distinguishes local preparation from an in-flight API request',() => {
  const record = {status:'pending',model:'gpt-image-2.6-flare'};
  assert.equal(progressText({...record,stage:'queued'}),'Queued');
  assert.equal(progressText({...record,stage:'preparing'}),'Preparing photos…');
  assert.equal(progressText({...record,stage:'sending'}),'Sending to OpenAI…');
  assert.equal(progressText({...record,stage:'generating',generatingAt:1000},24000),'Waiting for OpenAI · 23s');
});
