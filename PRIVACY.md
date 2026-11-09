# On Me privacy policy

_Last updated: November 8, 2026_

On Me is a Chrome extension that makes virtual try-ons: it shows a clothing image from a web page on you, or on someone else, using reference photos you provide. On Me has no server, no account, and no analytics. We (the developer) never receive your data.

## What On Me stores, and where

Everything below is stored only in your Chrome profile on your device (extension storage and IndexedDB):

- **Reference photos** you add in the dashboard, grouped into photo sets, and the optional build and size notes you write for each set.
- **Your OpenAI API key**, if you save one.
- **Try-on history**: the clothing image you picked, the generated try-on, the page URL and title it came from (and the link the image led to, if it was a link), which photo set was used, the time, likes, and estimated cost.
- **Settings**: model and quality choices, your prompt, and which websites On Me is on or off for.

Removing the extension deletes all of it. You can also delete individual try-ons and reference photos in the dashboard.

## Your API key, and what leaves your device

On Me uses **your own OpenAI API key**. When you start a try-on, your browser sends the request **directly to OpenAI's API** (`api.openai.com`) with your key. The request contains the selected clothing image, the reference photos in the photo set you're using, and the prompt (including that set's build and size notes, if any).

- **No server in between.** On Me has no server. Your key, photos, and try-ons never pass through anything run by us, and we never see them.
- **No analytics or tracking.** No analytics, telemetry, crash reporting, ads, or tracking of any kind.
- **Your key stays in Chrome.** It's saved only in this Chrome profile, isn't synced, is never shown to the websites you visit, and is sent only to OpenAI.
- **The clothing image.** To prepare it, On Me may download the image again from the website that already shows it, without cookies or a referrer.
- **Nothing else.** On Me makes no other network requests. In mock mode, nothing is sent to OpenAI.

OpenAI's handling of the data you send it is covered by [OpenAI's policies](https://openai.com/policies) and your OpenAI account settings.

## Photos of other people

Only add photos of yourself or of people who have agreed to it.

## What On Me reads on web pages

On Me runs on web pages so it can put a try-on button on images. It looks only at image elements (and the link an image sits in), and the page URL and title. It does not read form fields, track browsing, or collect analytics.

## Sharing

On Me does not sell or share data, does not use it for advertising or credit decisions, and does not use it for anything except making and showing your try-ons.

## Changes to this policy

This policy describes On Me as it works today. If that changes, for example an optional paid version that makes try-ons through a service we run, we'll update this policy and the date at the top before the change ships, and describe what that option sends and where.

## Contact

Questions: vivek@minusx.ai
