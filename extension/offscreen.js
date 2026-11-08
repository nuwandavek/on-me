import {get,getAll,put,remove,finishGeneration,updateGeneration} from './lib/db.js';
import {generateTryOn} from './lib/model.js';
import {editImage} from './lib/openai.js';
import {snapshotSource,apiImage} from './lib/images.js';
import {withTimeout} from './lib/async.js';

const channel = new BroadcastChannel('cbm-data');
const active = new Set();
let pumping = false;
let pumpAgain = false;
function entry(record) {
  return {
    id:record.id,createdAt:Date.now(),model:record.model,costUsd:record.costUsd,
    costSource:record.costSource,usage:record.usage || null,pricing:record.pricing || null,
    requestId:record.requestId || null,clientRequestId:record.id,status:record.status,profileId:record.profileId || null,
  };
}

// An interrupted paid request is never replayed automatically.
async function recover() {
  const jobs = await getAll('jobs');
  for (const record of await getAll('generations')) {
    if (record.status !== 'pending') continue;
    const job = jobs.find(item => item.id === record.id);
    if (job?.state === 'queued') continue;
    record.status = 'failed';record.stage = 'interrupted';
    record.error = job?.submittedAt ? 'Generation was interrupted. It may have been charged; check API usage before trying again.' : 'This try-on was interrupted. Please try again.';
    record.costUsd = job?.submittedAt ? null : 0;
    record.costSource = job?.submittedAt ? 'unknown' : 'not-submitted';
    await finishGeneration(record,job?.submittedAt ? entry(record) : null);
  }
  channel.postMessage('generations');
}
const ready = recover();

async function run(job) {
  let record = await get('generations',job.id);
  if (!record) { await remove('jobs',job.id);return; }
  try {
    job.state = 'running';await put('jobs',job);
    record.stage = 'downloading';await updateGeneration(record);channel.postMessage('generations');
    record.original = await snapshotSource(job);
    await updateGeneration(record);channel.postMessage('generations');
    let output;
    if (job.settings.mode === 'mock') {
      record.generatingAt = Date.now();record.stage = 'generating';
      await updateGeneration(record);channel.postMessage('generations');
      output = await generateTryOn({original:record.original,references:job.references});
    } else {
      record.stage = 'authorizing';await updateGeneration(record);channel.postMessage('generations');
      const config = await withTimeout(() => chrome.runtime.sendMessage({type:'CBM_API_KEY'}),10000,'Could not connect to the extension. Reload it and try again; no API request was sent.');
      if (!config?.apiKey) throw new Error('Add your OpenAI API key in Dashboard → Settings.');
      record.stage = 'preparing';await updateGeneration(record);channel.postMessage('generations');
      const [original,...references] = await Promise.all([apiImage(record.original),...job.references.map(ref => apiImage(ref.blob))]);
      record.stage = 'sending';await updateGeneration(record);channel.postMessage('generations');
      output = await editImage({
        original,references,prompt:job.prompt,apiKey:config.apiKey,settings:job.settings,id:job.id,
        signal:AbortSignal.timeout(8 * 60 * 1000),
        onSubmit:async () => {
          if (!await get('generations',job.id)) throw new Error('This try-on was deleted before it was submitted.');
          job.submittedAt = Date.now();await put('jobs',job);
          record.submittedAt = job.submittedAt;record.generatingAt = job.submittedAt;record.stage = 'generating';
          await updateGeneration(record);channel.postMessage('generations');
        },
      });
    }
    Object.assign(record,output,{referenceIds:job.references.map(ref => ref.id),status:'completed',stage:'completed',completedAt:Date.now()});
    await finishGeneration(record,entry(record));
  } catch (error) {
    Object.assign(record,error.billing || {},{status:'failed',stage:'failed',error:error.message || 'The try-on failed.'});
    if (!error.billing) {
      record.costUsd = job.submittedAt ? null : 0;
      record.costSource = job.submittedAt ? 'unknown' : 'not-submitted';
    }
    await finishGeneration(record,job.submittedAt ? entry(record) : null);
  }
  channel.postMessage('generations');
}

async function pump() {
  await ready;
  if (pumping) { pumpAgain = true;return; }
  pumping = true;
  try {
    const jobs = (await getAll('jobs')).filter(job => job.state === 'queued').sort((a,b) => a.createdAt - b.createdAt);
    for (const job of jobs) {
      if (active.size >= 2) break;
      if (active.has(job.id)) continue;
      active.add(job.id);
      run(job).catch(() => channel.postMessage('generations')).finally(() => { active.delete(job.id);pump(); });
    }
  } finally { pumping = false;if (pumpAgain) { pumpAgain = false;pump(); } }
}

chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if (sender.id !== chrome.runtime.id || message?.type !== 'CBM_RUN_JOBS') return;
  reply({ok:true});pump().catch(console.error);
});
pump().catch(console.error);
