import type { RawHit } from "./html5-detector.js";

// Player-instance / DOM-config inspection (legitimate, read-only).
// Detects well-known in-page player globals and JSON media configs that
// the page exposes to its own JS. We never execute page code; we only
// READ already-present objects. DRM/encrypted players are reported, not used.

interface PlayerGlobal {
  name: string;
  expr: string; // descriptive only; we read via safe accessor below
  getter: () => unknown;
}

export function scanPlayerInstances(): RawHit[] {
  const hits: RawHit[] = [];
  const globals: PlayerGlobal[] = [
    { name: "hls.js", expr: "window.hls", getter: () => (window as any).hls },
    { name: "Hls", expr: "window.Hls", getter: () => (window as any).Hls },
    { name: "dashjs", expr: "window.dashjs", getter: () => (window as any).dashjs },
    { name: "Dash", expr: "window.Dash", getter: () => (window as any).Dash },
    { name: "videojs", expr: "window.videojs", getter: () => (window as any).videojs },
    { name: "jwplayer", expr: "window.jwplayer", getter: () => (window as any).jwplayer },
  ];

  for (const g of globals) {
    try {
      const obj = g.getter();
      if (!obj) continue;
      const url = extractUrlFromPlayer(g.name, obj);
      if (url) {
        hits.push({
          url,
          kind: "video",
          detectionMethod: "player-instance",
          sourceUrl: location.href,
          frameContext: "top",
          metadata: { player: g.name },
        });
      }
    } catch {
      // Reading a global may throw in some pages; ignore safely.
    }
  }

  // Look for JSON config blobs in window that mention media URLs.
  const cfg = readWindowConfig();
  if (cfg) {
    for (const url of extractUrlsFromText(cfg)) {
      hits.push({
        url,
        kind: "video",
        detectionMethod: "dom-config",
        sourceUrl: location.href,
        frameContext: "top",
        metadata: { source: "window-config" },
      });
    }
  }

  return hits;
}

function extractUrlFromPlayer(name: string, obj: unknown): string | null {
  try {
    if (name === "hls.js") {
      const o = obj as any;
      if (o && o.url) return String(o.url);
      if (o && o.levels && o.levels[0] && o.levels[0].url) return String(o.levels[0].url);
    }
    if (name === "videojs") {
      const players = obj as any;
      if (players && players.players) {
        const first = Object.values(players.players as object)[0] as any;
        if (first && first.currentSrc) return String(first.currentSrc());
      }
    }
  } catch {
    return null;
  }
  return null;
}

function readWindowConfig(): string | null {
  try {
    // Only read a small, bounded set of likely config globals.
    for (const key of ["__PLAYER_CONFIG__", "playerConfig", "mediaConfig", "__NEXT_DATA__"]) {
      const v = (window as any)[key];
      if (v) return JSON.stringify(v).slice(0, 20000);
    }
  } catch {
    return null;
  }
  return null;
}

function extractUrlsFromText(text: string): string[] {
  const re = /https?:\/\/[^\s"'<>]+/gi;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.add(m[0]);
  }
  // Filter to media-ish
  return Array.from(out).filter((u) =>
    /\.(mp4|webm|m4v|m4a|mov|ogv|oga|ogg|m3u8|mpd)(\?|$)|manifest|playlist/i.test(u)
  );
}
