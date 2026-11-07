import { normalizeSettings } from './settings.js';
import { PRICING, usageCost } from './pricing.js';

export async function editImage({original,references,prompt,apiKey,settings,id,onSubmit = async () => {},fetchImpl = fetch,signal}) {
  if (!apiKey) throw new Error('Add your OpenAI API key in Dashboard → Settings.');
  if (!references.length) throw new Error('Add at least one reference photo in your dashboard.');
  if (!prompt?.trim()) throw new Error('The try-on prompt file is empty.');
  const config = normalizeSettings(settings);
  const form = new FormData();
  for (const [key,value] of Object.entries({model:config.model,quality:config.quality,complexity:config.complexity,size:config.size,prompt,n:'1',output_format:'jpeg',output_compression:'85'})) form.append(key,value);
  const extension = blob => blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  form.append('image[]',original,`original.${extension(original)}`);
  references.forEach((blob,index) => form.append('image[]',blob,`reference-${index + 1}.${extension(blob)}`));
  await onSubmit();
  let response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/images/edits',{
      method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'X-Client-Request-Id':id},body:form,signal,
    });
  } catch (error) {
    throw new Error(error.name === 'TimeoutError' || signal?.aborted ? 'The request timed out. It may have been charged; check your API usage before trying again.' : 'The API connection was interrupted. The cost is unknown; check API usage before trying again.');
  }
  const requestId = response.headers.get('x-request-id');
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The API returned an unreadable response. Its cost is unknown.'); }
  const usage = data.usage || null;
  const billing = {usage,costUsd:usageCost(usage),costSource:'api-usage-estimate',pricing:{...PRICING,model:config.model},requestId};
  if (!response.ok) {
    const descriptions = {
      401:'OpenAI rejected the API key. Update it in Settings.',
      403:'This API project does not have access to the selected image model. Check its permissions or verification.',
      429:'OpenAI rate limit or insufficient API credit. Check your API billing and try again later.',
    };
    const detail = String(data.error?.message || `Image request failed (HTTP ${response.status}).`).replaceAll(apiKey,'[redacted]').replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').slice(0,600);
    throw Object.assign(new Error(descriptions[response.status] || detail),{billing});
  }
  const base64 = data.data?.[0]?.b64_json;
  if (typeof base64 !== 'string' || !base64) throw Object.assign(new Error('OpenAI returned no image. Review the cost log before trying again.'),{billing});
  try {
    const raw = atob(base64);
    const bytes = Uint8Array.from(raw,char => char.charCodeAt(0));
    const type = {png:'image/png',webp:'image/webp',jpeg:'image/jpeg'}[data.output_format] || 'image/jpeg';
    return {result:new Blob([bytes],{type}),...billing,model:config.model};
  } catch { throw Object.assign(new Error('Could not decode the generated image. Its usage has been recorded.'),{billing}); }
}
