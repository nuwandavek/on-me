import {isMock} from './settings.js';

export function progressText(record,now = Date.now()) {
  if (record.status === 'completed') return 'Ready';
  if (record.status === 'failed') return 'Failed';
  if (record.stage === 'queued') return 'Queued';
  if (record.stage === 'downloading') return 'Downloading image…';
  if (record.stage === 'authorizing') return 'Connecting…';
  if (record.stage === 'preparing') return 'Preparing photos…';
  if (record.stage === 'sending') return 'Sending to OpenAI…';
  if (!record.generatingAt) return 'Preparing…';
  const seconds = Math.max(0,Math.floor((now - record.generatingAt) / 1000));
  if (isMock(record)) return seconds < 10 ? `Mock preview · ${10 - seconds}s` : 'Finishing preview…';
  const elapsed = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `Waiting for OpenAI · ${elapsed}`;
}
