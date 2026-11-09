# Chrome Web Store listing

Copy for each field of the developer dashboard. Images are in `docs/store/`.

## Store listing

- **Name:** On Me
- **Summary (≤132 chars):** Try on clothes from any shopping site. Click the hanger on a product photo to see it on you, using your own OpenAI key.
- **Category:** Shopping
- **Language:** English
- **Description:**

> See clothes on you before you buy. On Me adds a small hanger to product photos on any shopping site. Click it, and On Me makes a try-on of that item on you from 2 to 6 reference photos you add once.
>
> • Side panel with your recent try-ons, side by side with the original
> • Step through try-ons, like your favourites, and jump back to the product
> • Photo sets: keep separate sets (you, a partner), each with optional build and sizes for a better fit
> • A dashboard with your looks grouped by date, usage stats, and cost tracking
> • Turn it off on sites you don't shop on, or turn it on only on the sites you pick
>
> Bring your own OpenAI API key. Try-ons are made with OpenAI's image models and billed to your OpenAI account (usually a few cents each). The dashboard shows estimated costs.
>
> Private by design: each try-on goes straight from your browser to OpenAI with your key. There's no On Me server in between, no account, and no analytics or tracking. Your photos, key, and history stay in your browser, and photos are sent only when you start a try-on.
>
> Only use photos of yourself or of people who have agreed to it.

- **Screenshots (1280×800):** `screenshot-1.png` … `screenshot-5.png`
- **Small promo tile (440×280):** `promo-small-440x280.png`
- **Store icon:** `extension/icons/icon128.png`

## Privacy practices

- **Single purpose:** Make virtual try-ons of clothing images on web pages, using reference photos the user provides, and keep a local history of them.
- **Permission justifications:**
  - `storage`: saves settings, the user's OpenAI API key, and the site on/off lists.
  - `unlimitedStorage`: try-on history and reference photos are images stored locally in IndexedDB and exceed the default quota.
  - `sidePanel`: the side panel lists the user's try-ons and setup steps.
  - `offscreen`: an offscreen document runs the try-on queue: it prepares the product and reference images (Blob/canvas work a service worker can't do) and keeps a long-running OpenAI request alive after the service worker would be suspended.
  - **Host permissions (`http://*/*`, `https://*/*`) and content script on all sites:** the try-on button must appear on product images on whatever shopping site the user visits, and the extension must read the selected image, which can be hosted on any domain. Users can turn the extension off per site, or limit it to sites they pick.
- **Remote code:** No. All code is bundled, including the Vega chart libraries.
- **Data usage:** check
  - Personally identifiable information: **Yes** (reference photos of people and optional build and size notes; stored locally, sent to OpenAI only to make a try-on)
  - Health information: No
  - Financial and payment information: No
  - Authentication information: **Yes** (the user's OpenAI API key, stored locally, sent only to OpenAI)
  - Personal communications: No
  - Location: No
  - Web history: **Yes** (URL and title of pages where the user made a try-on, and the product link of the clicked image; stored locally)
  - User activity: No
  - Website content: **Yes** (the selected product image)
- Certify: not sold to third parties; not used for unrelated purposes; not used for creditworthiness.
- **Privacy policy URL:** https://github.com/nuwandavek/on-me/blob/master/PRIVACY.md (the repo must be public, or host the file elsewhere)

## Test instructions (for the reviewer)

> No account or API key needed. On Me normally uses the user's own OpenAI API key; to test without one, use Mock mode, which runs the full flow but returns the original image instead of calling OpenAI.
>
> 1. Click the toolbar icon to open the side panel, then Go to dashboard.
> 2. Settings → Provider: Mock → Save settings. No reference photos are needed in Mock mode.
> 3. Open a clothing product page on any shop and click the hanger on a product photo.
> 4. The try-on appears in the side panel after about 10 seconds; click it to open the comparison on the page, step through try-ons with the arrows, like one, and use View product / All try-ons.
