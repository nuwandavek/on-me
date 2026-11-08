import {isMock} from './settings.js';
import {MIN_REFERENCES} from './profiles.js';

// The side panel's first-run checklist. It stays until a real (non-mock) try-on has finished.
export const SETUP_STEPS = Object.freeze(['key','photos','where','try']);

export function setupState({settings = {},hasKey = false,references = 0,siteMode = null} = {},records = [],filter = 'all') {
  const steps = {
    key:Boolean(hasKey),
    photos:references >= MIN_REFERENCES,
    where:siteMode === 'all' || siteMode === 'some',
    try:records.some(record => record.status === 'completed' && !isMock(record)),
  };
  return {steps,visible:filter === 'all' && settings.mode !== 'mock' && !steps.try,current:SETUP_STEPS.find(key => !steps[key]) ?? null};
}
