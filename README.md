<p align="center"><img src="extension/icons/icon128.png" width="96" height="96" alt="On Me logo"></p>

<h1 align="center">On Me</h1>

<p align="center">A Chrome extension for virtual try-ons, with a sidebar, saved comparisons, likes, and cost tracking.</p>

<p align="center"><img src="docs/screenshots/shopping-with-panel.jpg" width="800" alt="A product page with the hanger button highlighted (click the hanger to try it on) and the On Me side panel listing finished try-ons"></p>

<p align="center">
  <img src="docs/screenshots/comparison.jpg" width="265" alt="Comparison dialog on the shopping page: the original product photo next to the try-on">
  <img src="docs/screenshots/dashboard.jpg" width="265" alt="Dashboard: try-ons grouped by date with likes and per-try-on cost">
  <img src="docs/screenshots/stats.png" width="265" alt="Dashboard stats: try-on counts, top websites, and try-ons per week">
</p>

## Setup

1. Open `chrome://extensions`, enable **Developer mode**, and **Load unpacked** → `extension/`.
2. Open the sidebar → **Go to dashboard**.
3. Add reference photos and save your OpenAI API key under **Settings**.
4. Refresh a shopping page and click the hanger on an image.

Defaults: **GPT Image 2.6 Flare**, low quality, low complexity. Mock mode is also available.

## Notes

- Click a finished sidebar preview for a larger comparison.
- **Skip this website** stops image buttons and scanning; manage the list in **Settings**. YouTube is skipped by default.
- Prompt: [`extension/prompts/try-on.txt`](extension/prompts/try-on.txt).
- History, references, and API key stay in your Chrome profile. Real try-ons send the selected image and references to OpenAI.
- Dashboard costs are usage-based estimates. Missing usage is marked unknown; requests are never automatically retried.
- Reload the extension and refresh shopping pages after code changes.
- This is a personal unpacked extension; use a backend for credentials before distributing it.

## Development

No build needed. `npm install && npm test` runs local tests. `npm run icons` regenerates the bundled icons.
