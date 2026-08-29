# Video Source Detector

Automatically detect legitimate, browser-accessible video sources and provide the best
available playback or download option. For **Google Chrome and Brave** on Windows,
**Manifest V3**.

> This extension does **not** bypass DRM, authentication, access controls, paywalls,
> anti-download mechanisms, or encryption. It only inspects resources that are already
> exposed to your authorized browser session, subject to browser security restrictions
> and the platform's terms. Where protected content cannot be legitimately extracted,
> it clearly reports that limitation.

## Features

- **Automatic mode**: open an authorized video page, open the extension, press
  *Start Detection*. The extension monitors the page and lists detected sources.
- **Manual / Advanced mode**: inspect raw URL, normalized/cleaned URL, type, quality,
  resolution, MIME, manifest type, status, detection method, confidence, source/frame
  context, and warnings.
- **Supported media**: MP4, WebM, HLS (`.m3u8`), MPEG-DASH (`.mpd`), and other standard
  browser-playable representations.
- **Quality detection**: extracts available variants (resolution / bitrate / codecs)
  from HLS/DASH manifests when readable; lets you pick a quality.
- **Continuous monitoring** until *Stop*, with robust deduplication.
- **Intelligent ranking** of candidates (validity, resolution, compatibility, activity,
  auth requirement, confidence).
- **Privacy-first**: local-first, no backend, no analytics, no uploads, no secret logging.

## Install (unpacked)

1. Build: `npm install` then `npm run build`. Output lands in `build/`.
2. Open Chrome/Brave → `chrome://extensions` (or `brave://extensions`).
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `build/` folder.
5. Pin the extension from the toolbar puzzle icon.

## Usage

1. Open your authorized educational platform and the video page; log in normally.
2. Click the extension icon → **Start Detection**.
3. Sources appear as cards. If none appear, **play the video** — some sources load only
   on playback.
4. Use **Copy Raw**, **Copy Clean**, **Open**, or **Download** per card.
5. **Advanced Mode** shows debug logs and settings (history limit, preferred quality, etc.).
6. Press **Stop** to end monitoring; results are preserved for copy/open.

## Keyboard shortcut

Default `Ctrl+Shift+V` (macOS `Cmd+Shift+V`) starts detection on the active tab.
Change it via the browser's extension shortcut settings.

## Right-click menu

- **Detect video on this page** — start detection on the current page.
- **Open detector** — open the popup.

## Permissions (and why)

- `activeTab` — act on the tab you click the extension in (least-privilege).
- `scripting` — inject the content-script detector into the active tab.
- `storage` — local settings, debug logs, optional history.
- `downloads` — let the browser save a detected, browser-accessible file.
- `contextMenus` — right-click integration.
- `tabs` — query the active tab to start detection.
- No host permissions and no remote servers are used.

## URL handling & safety

- The **raw URL** is always preserved.
- A **normalized/cleaned URL** is produced only when there is strong technical
  justification, and only by removing pure tracking params (`utm_*`, `fbclid`, `ref`, …).
- Parameters that look security-related (`token`, `sig`, `signature`, `auth`, `session`,
  `exp`, `hmac`, `access_key`, AWS/GCS signing params, …) are **never** removed.
- Sensitive metadata (auth headers, cookies, tokens, JWTs) is redacted before logging.

## Limitations

- Manifest V3 cannot read request **bodies**; detection uses media elements, DOM, player
  globals, and Resource Timing.
- Cross-origin `<iframe>` players may be unreadable due to browser isolation.
- Some HLS/DASH manifests cannot be fetched for quality extraction due to CORS; the
  extension reports this rather than guessing.
- Encrypted/DRM-protected streams (EXT-X-KEY, DASH ContentProtection) are detected and
  reported, never decrypted.

## Development

- `npm run typecheck` — type-check.
- `npm test` — run Vitest unit tests (classify, normalize, manifest, rank, dedup, sanitize).
- `npm run build` — compile TypeScript then assemble `build/`.

## Architecture

```
Extension
├── UI (popup, advanced/debug, options)
├── Background orchestrator (service worker): enrich, normalize, dedup, rank, stream
├── Content detector: html5 / resource-timing / player-global / DOM-config
├── Analysis: url-classifier, url-normalizer, manifest-analyzer, ranker, deduplicator
├── Security: sanitize / redact
└── Storage: local-first settings, debug logs, history
```

## Adding platform adapters

The generic detector runs first. Add optional adapter rules (detection rules, metadata
extraction, platform-specific normalization) inside the analysis layer; keep them within
the same security/authorization boundaries. Never hard-code a single platform into the
core.
# AI Features (Google AI Studio / Gemini)

The extension can optionally use Google's Gemini models to (1) label each detected link in
plain language, and (2) power a chat that runs detection commands and controls the browser
via extension-native actions. Everything stays local-first and opt-in.

## Enable
1. Open the extension **Options** page (right-click → Options, or Advanced → Settings).
2. Enter your **Gemini API key** (from https://aistudio.google.com/apikey). It is stored only
   in this browser's local storage.
3. Tick **Enable AI features**, choose a model (`gemini-2.5-flash` default), and optionally
   **Auto-label links with AI**.
4. The popup's **AI** tab becomes active: type a question or a command.

## What the AI sees (privacy)
- Only the links and metadata already shown in the UI are sent to Gemini.
- Before any URL leaves the extension, **secret-parameter values** (`token`, `sig`, `auth`,
  `session`, `hmac`, AWS/GCS signing, JWTs) are replaced with `***`. Parameter names and URL
  shape are preserved so the model can still reason about the link.
- Cookies, raw headers, and auth tokens are **never** included.

## Link labeling
- Each candidate gets an AI badge: one of `player`, `manifest`, `direct-download`, `audio`,
  `thumbnail`, `subtitle`, `analytics`, `ads`, `unknown`, plus a short summary.
- Auto-labeling runs when new results appear (if enabled). Use **Analyze links** in the AI tab
  to label on demand.

## Chat / commands
The chat routes natural-language requests:
- "خش افحص على 123" / "start detection on youtube" → starts detection on a matching tab
  (matched by URL/title; empty hint = active tab).
- "وقف الفحص" / "stop" → stops detection.
- "open <url>", "download <url>", "go to <url>", "select quality 1080p" → extension-native
  actions only (no page-script injection).
- Free-form questions about the detected results are answered by Gemini.

Tool calls are allowlisted to `start_detection`, `stop_detection`, `open_url`, `download_url`,
`navigate`, `select_quality`. The model cannot run arbitrary page JavaScript or escape
extension boundaries.

## Notes
- If no key is set or AI is disabled, the AI tab explains how to enable it.
- AI calls are best-effort; detection never stops if the model fails.
- Network access to `generativelanguage.googleapis.com` is required for AI features.
