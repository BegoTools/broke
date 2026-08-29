import type { QualityVariant, ManifestType } from "../shared/types.js";

// Safe streaming manifest analysis.
//  - Parses HLS (.m3u8) and DASH (.mpd) for VARIANT/REPRESENTATION metadata.
//  - Extracts quality/resolution/bitrate/codecs where present in the manifest.
//  - Detects encryption signaling (EXT-X-KEY / cenc) and REPORTS it; never decrypts.
//  - Returns null when parsing is not possible or would be unsafe.

export interface ManifestAnalysis {
  manifestType: ManifestType;
  qualities: QualityVariant[];
  isEncrypted: boolean;
  variantUrls?: string[]; // absolute variant/segment URLs when derivable
  warnings: string[];
}

const RES_HEIGHT_RE = /(\d{3,4})x(\d{3,4})/;

export function analyzeManifest(
  text: string,
  baseUrl: string,
  container: ManifestType
): ManifestAnalysis | null {
  if (!text) return null;
  const head = text.slice(0, 64).toUpperCase();
  if (container === "hls" || head.includes("#EXTM3U")) {
    return analyzeHls(text, baseUrl);
  }
  if (container === "dash" || head.includes("<MPD") || head.trim().startsWith("<?xml")) {
    return analyzeDash(text, baseUrl);
  }
  return null;
}

function joinUrl(base: string, rel: string): string | undefined {
  try {
    return new URL(rel, base).toString();
  } catch {
    return undefined;
  }
}

function analyzeHls(text: string, baseUrl: string): ManifestAnalysis {
  const warnings: string[] = [];
  let isEncrypted = false;
  const qualities: QualityVariant[] = [];
  const variantUrls: string[] = [];

  const lines = text.split(/\r?\n/);
  let lastBandwidth = 0;
  let lastCodecs = "";
  let lastResolution = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#EXT-X-KEY")) {
      // Any EXT-X-KEY (except METHOD=NONE) signals encryption/DRM-adjacent protection.
      if (!/METHOD=NONE/i.test(line)) {
        isEncrypted = true;
        warnings.push("Encrypted HLS variant detected (EXT-X-KEY). Source may require authenticated/protected session; not decrypted.");
      }
    }
    const m3u = line.match(/^#EXT-X-STREAM-INF:(.*)$/i);
    if (m3u) {
      const attrs = m3u[1];
      const bw = /BANDWIDTH=(\d+)/i.exec(attrs);
      const res = /RESOLUTION=(\d{3,4}x\d{3,4})/i.exec(attrs);
      const codec = /CODECS="([^"]*)"/i.exec(attrs);
      lastBandwidth = bw ? Number(bw[1]) : lastBandwidth;
      lastResolution = res ? res[1] : lastResolution;
      lastCodecs = codec ? codec[1] : lastCodecs;
      continue;
    }
    // A media playlist can also declare key after stream-inf; handle standalone.
    if (line.startsWith("#EXTINF") || line.startsWith("#EXT-X-BYTERANGE") || line.startsWith("#EXT-X-MEDIA")) {
      continue;
    }
    if (line && !line.startsWith("#")) {
      // This non-comment line is a URI following a STREAM-INF (variant playlist)
      // or a segment URI (media playlist). For variants we record the url.
      const abs = joinUrl(baseUrl, line);
      if (abs) variantUrls.push(abs);
      if (lastResolution || lastBandwidth) {
        qualities.push({
          label: resolutionToLabel(lastResolution) || (lastBandwidth ? `${Math.round(lastBandwidth / 1000)}k` : "variant"),
          height: heightFromRes(lastResolution),
          bandwidth: lastBandwidth || undefined,
          codecs: lastCodecs || undefined,
          url: abs,
        });
      }
      lastBandwidth = 0;
      lastResolution = "";
      lastCodecs = "";
    }
  }

  if (qualities.length === 0 && variantUrls.length > 0) {
    // Media playlist (segments), not variant; cannot infer quality reliably.
    warnings.push("HLS media playlist detected (no variant qualities exposed).");
  }

  return { manifestType: "hls", qualities, isEncrypted, variantUrls, warnings };
}

function analyzeDash(text: string, baseUrl: string): ManifestAnalysis {
  const warnings: string[] = [];
  let isEncrypted = false;
  const qualities: QualityVariant[] = [];
  const variantUrls: string[] = [];

  // Minimal, dependency-free XML parse via DOMParser (browser) or a tiny regex fallback.
  let doc: Document | null = null;
  if (typeof DOMParser !== "undefined") {
    try {
      doc = new DOMParser().parseFromString(text, "application/xml");
    } catch {
      doc = null;
    }
  }

  const reps: Array<{ h: number; bw: number; codecs: string; url?: string }> = [];

  if (doc) {
    const nodes = doc.querySelectorAll(
      "Representation, AdaptationSet > Representation"
    );
    nodes.forEach((n) => {
      const h = Number(n.getAttribute("height") || "0");
      const bw = Number(n.getAttribute("bandwidth") || "0");
      const codecs = n.getAttribute("codecs") || "";
      const r = n.querySelector("BaseURL");
      const url = r && r.textContent ? joinUrl(baseUrl, r.textContent.trim()) : undefined;
      if (url) variantUrls.push(url);
      reps.push({ h, bw, codecs, url });
    });
    if (doc.querySelector("ContentProtection")) {
      isEncrypted = true;
      warnings.push("DASH ContentProtection element detected. Source is protected (DRM/encryption); not decrypted.");
    }
  } else {
    // Regex fallback for environments without DOMParser.
    const repRe = /<Representation\b[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = repRe.exec(text))) {
      const tag = m[0];
      const h = /height="(\d+)"/i.exec(tag);
      const bw = /bandwidth="(\d+)"/i.exec(tag);
      const codecs = /codecs="([^"]*)"/i.exec(tag);
      reps.push({ h: h ? Number(h[1]) : 0, bw: bw ? Number(bw[1]) : 0, codecs: codecs ? codecs[1] : "" });
    }
    if (/<ContentProtection\b/i.test(text)) {
      isEncrypted = true;
      warnings.push("DASH ContentProtection detected (regex). Source is protected; not decrypted.");
    }
  }

  for (const r of reps) {
    qualities.push({
      label: r.h ? `${r.h}p` : r.bw ? `${Math.round(r.bw / 1000)}k` : "variant",
      height: r.h || undefined,
      bandwidth: r.bw || undefined,
      codecs: r.codecs || undefined,
      url: r.url,
    });
  }

  return { manifestType: "dash", qualities, isEncrypted, variantUrls, warnings };
}

function resolutionToLabel(res: string): string | null {
  const h = heightFromRes(res);
  return h ? `${h}p` : null;
}

function heightFromRes(res: string): number | undefined {
  const m = res ? RES_HEIGHT_RE.exec(res) : null;
  return m ? Number(m[2]) : undefined;
}
