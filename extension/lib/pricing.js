// Standard Image API rates, USD per million tokens. No account discounts assumed.
// https://developers.openai.com/api/docs/models/gpt-image-2.6-flare
export const PRICING = Object.freeze({
  checkedAt:'2026-11-05', currency:'USD', perTokens:1000000,
  textInput:5, imageInput:8, imageOutput:30,
  source:'https://developers.openai.com/api/docs/models/gpt-image-2.6-flare',
});

const count = value => Number.isSafeInteger(value) && value >= 0;
export function usageCost(usage, pricing = PRICING) {
  const text = usage?.input_tokens_details?.text_tokens;
  const image = usage?.input_tokens_details?.image_tokens;
  const output = usage?.output_tokens_details?.image_tokens ?? usage?.output_tokens;
  if (![text,image,output].every(count)) return null;
  if (usage.input_tokens != null && usage.input_tokens !== text + image) return null;
  if (usage.output_tokens_details?.text_tokens > 0) return null;
  if (usage.output_tokens != null && usage.output_tokens !== output) return null;
  return (text * pricing.textInput + image * pricing.imageInput + output * pricing.imageOutput) / pricing.perTokens;
}
