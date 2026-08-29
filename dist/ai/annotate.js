import { maskSecretParams, geminiGenerateText } from "./gemini-client.js";
const SYSTEM = `You are a video-source analyzer for a browser extension.
You receive a JSON list of detected media links. For EACH link, output:
- "label": one of [player, manifest, direct-download, audio, thumbnail, subtitle, analytics, ads, unknown]
- "summary": one short sentence (max 18 words) in the SAME language as the user's question, describing what the link is and how it is used.
Reply ONLY with a JSON array, one object per link, preserving each link's "id".
Example: [{"id":"m:1","label":"player","summary":"Main HLS playlist that drives the video player."}]`;
export function buildAnnotationPrompt(candidates) {
    const items = candidates.map((c) => ({
        id: c.id,
        container: c.container,
        manifestType: c.manifestType,
        method: c.detectionMethod,
        status: c.status,
        url: maskSecretParams(c.rawUrl),
        qualities: c.qualities.map((q) => q.label),
    }));
    return ("Classify these detected links:\n" + JSON.stringify(items, null, 2));
}
// Parse Gemini's JSON array response. Tolerant of surrounding prose.
export function parseAnnotations(text) {
    let json = text.trim();
    // Strip code fences if present.
    const fence = json.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence)
        json = fence[1].trim();
    // Find first '[' and last ']'.
    const start = json.indexOf("[");
    const end = json.lastIndexOf("]");
    if (start === -1 || end === -1)
        return [];
    try {
        const arr = JSON.parse(json.slice(start, end + 1));
        if (!Array.isArray(arr))
            return [];
        return arr
            .filter((o) => o && typeof o.id === "string")
            .map((o) => ({
            id: String(o.id),
            label: typeof o.label === "string" ? o.label : "unknown",
            summary: typeof o.summary === "string" ? o.summary : "",
        }));
    }
    catch {
        return [];
    }
}
export async function annotateCandidates(apiKey, model, candidates) {
    if (candidates.length === 0)
        return [];
    const prompt = buildAnnotationPrompt(candidates);
    const res = await geminiGenerateText(apiKey, model, prompt, SYSTEM);
    if (res.error)
        return [];
    return parseAnnotations(res.text);
}
// Attach annotations back onto candidates.
export function applyAnnotations(candidates, annotations) {
    const byId = new Map(annotations.map((a) => [a.id, a]));
    return candidates.map((c) => {
        const a = byId.get(c.id);
        if (!a)
            return c;
        return { ...c, aiLabel: a.label, aiSummary: a.summary };
    });
}
//# sourceMappingURL=annotate.js.map