# Cinema Referer Fix

Fixes video playback for one specific embed provider (VideoTube / vidtube.\* /
cdn-video.xyz) by rewriting the `Referer`/`Origin` header on requests to those domains
so their server stops blocking the request. Everything else about your browsing is
unaffected — this extension only touches requests to those three domains.

This isn't published to the Chrome Web Store (it's purpose-built to work around one
site's anti-hotlink check, which store policy wouldn't allow), so it has to be loaded
manually. Each person who wants this provider's video to work installs it once, on
their own browser.

## Install (Chrome / Edge / any Chromium browser)

1. Copy this `extension/` folder onto the device (or just open the whole repo if it's
   already on that device).
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked**, and select this `extension/` folder.
5. Done — no further setup. It runs automatically in the background.

## What it actually does

Uses Chrome's `declarativeNetRequest` API (see `rules.json`) to rewrite outgoing
headers at the network level for requests to `down.vidtube.one`, `vidtube.cam`, and
`*.cdn-video.xyz` — no scripts, no background process, just two static rules. Only
those three domains are affected.

## Limitation

This only covers the one provider it's been tested against. Sites like this usually
offer several alternate "servers" for the same video, hosted by completely different
providers — this extension does nothing for those; they either already work or don't,
same as without it.
