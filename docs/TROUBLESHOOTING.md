# Troubleshooting

## The extension didn't load
- Use **Developer mode** in `chrome://extensions`.
- Click **Load unpacked** and select the `build/` folder (must contain `manifest.json`).
- Check the card at the bottom of `chrome://extensions` for an error; reload after fixes.

## Nothing is detected
- Make sure you pressed **Start Detection** while on the video page.
- **Play the video.** Some sources are created only after playback begins.
- The page may use a cross-origin `<iframe>` player that browser isolation prevents reading.
- The platform may deliver media only via protected/DRM streams (reported, not extracted).

## No qualities shown for HLS/DASH
- The manifest could not be fetched (CORS or session restriction). The raw/manifest URL is
  still listed; quality extraction is skipped and a warning is shown instead of guessing.

## Download doesn't start
- The file may require your authenticated session. The download uses the browser's own
  network stack (cookies/headers included). If the server rejects it, the extension reports
  the limitation — it does not bypass auth.
- Some Chrome versions require the download to be user-initiated; the action is triggered by
  your click.

## "Protected playback detected"
- The source uses encryption/DRM (EXT-X-KEY, DASH ContentProtection). By design the extension
  never decrypts these. No workaround is provided.

## Debug logging
- Open **Advanced Mode → Debug** to see monitoring events. Use **Clear logs** / **Export**.
- Logs never contain passwords, cookies, auth headers, or tokens (redacted automatically).

## Permissions look too broad
- The only broad-capability permission is `activeTab`, scoped to the tab you invoke the
  extension on. There are no host permissions and no network egress.

## Reset
- Settings: open the extension **Options** page (or Advanced → Settings) and adjust.
- Clear history/logs via the same UI. Uninstall to remove all local data.
