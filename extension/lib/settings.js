export const DEFAULT_SETTINGS = Object.freeze({
  mode:'openai', model:'gpt-image-2.6-flare', quality:'low', complexity:'low', size:'1024x1024',
});

export function normalizeSettings(value = {}) {
  return {
    mode:value.mode === 'mock' ? 'mock' : 'openai',
    model:['gpt-image-2.6-flare','gpt-image-2.6-sunburst'].includes(value.model) ? value.model : DEFAULT_SETTINGS.model,
    quality:['low','medium','high'].includes(value.quality) ? value.quality : DEFAULT_SETTINGS.quality,
    complexity:['low','medium','high'].includes(value.complexity) ? value.complexity : DEFAULT_SETTINGS.complexity,
    size:['1024x1024','1024x1536','1536x1024'].includes(value.size) ? value.size : DEFAULT_SETTINGS.size,
  };
}

export const isMock = record => !record.model || record.model === 'mock-original';
export const modelLabel = model => model === 'gpt-image-2.6-sunburst' ? 'GPT Image 2.6 Sunburst' : 'GPT Image 2.6 Flare';
