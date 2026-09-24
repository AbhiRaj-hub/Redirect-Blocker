# Popup & Redirect Blocker

A lightweight Chromium extension (Manifest V3) that stops **click-hijack popups** and **forced cross-site redirects**, with a per-site on/off switch.

It is **not** an ad blocker. It doesn't hide banners or block ad networks; it only stops pages from misbehaving: opening windows you didn't ask for or sending you to another site.

## Features

- Blocks `window.open()` popups that aren't backed by a real user gesture
- Blocks click-hijacking: invisible overlays, and "click-under" popups that fire alongside a link click
- Blocks scripted `<a target="_blank">` clicks (`.click()` / synthetic click events)
- Cancels script-initiated cross-site redirects (`location.href`, `location.assign`, timers, etc.) using the Navigation API
- Removes cross-site `<meta http-equiv="refresh">` redirects
- Per-site toggle in the popup (reloads the page when switched)
- Badge counter and a log of what was blocked, per tab
- No filter lists, no remote code, no data collection

## Install (developer mode)

1. Clone or unzip this repository.
2. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the project folder.
5. Pin the extension and click its icon on any site to toggle protection.

Requires Chromium 111+ (needed for content scripts running in the page's main world).

## Usage

- Protection is **ON by default** on every site.
- Click the toolbar icon → **Protection ON/OFF for this site** to switch it for the current hostname (`www.` is ignored).
- The red badge shows how many popups/redirects were blocked on the current page. The popup lists the most recent ones.
- If a site breaks (e.g. a login popup or SSO redirect), switch protection off for that site.

## How it works

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest, content script registration |
| `main.js` | Runs in the **page world**. Wraps `window.open`, `HTMLElement.click`, `dispatchEvent`; listens to the Navigation API `navigate` event; watches for meta-refresh |
| `bridge.js` | Runs in the isolated world. Relays per-site state and blocked events between the page and the extension |
| `background.js` | Service worker. Stores disabled hosts, keeps per-tab counters, sets the badge |
| `popup.html/css/js` | Toolbar popup UI |
| `tests/test.html` | Local test page with BLOCK / ALLOW cases |

**Decision logic (simplified)**

- A popup is allowed only if a trusted user gesture happened within the last second, **and** the click was on an interactive element (link, button, input, etc.), **and** it doesn't open a different site than the link that was clicked.
- A script-initiated navigation to another site is cancelled unless it directly follows a click on an interactive element.
- User-initiated navigations (normal link clicks, address bar, back/forward, reload, hash changes, downloads) are never touched.
