import { Resvg } from '@resvg/resvg-js';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('extension/icons', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128"><rect width="128" height="128" rx="34" fill="#DD533B"/><path d="M50 40c0-17 28-17 28 0 0 11-14 10-14 22v3L27 86c-5 3-3 9 3 9h68c6 0 8-6 3-9L64 65" fill="none" stroke="#FFF5DF" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M99 29v14m-7-7h14" stroke="#FFF5DF" stroke-width="3" stroke-linecap="round"/></svg>`;
  await writeFile(`extension/icons/icon${size}.png`,new Resvg(svg).render().asPng());
}
console.log('Created all four extension icons.');
