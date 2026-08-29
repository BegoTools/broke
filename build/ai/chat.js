import { geminiGenerateText } from "./gemini-client.js";
const TOOLS = [
    {
        name: "start_detection",
        description: "Start video-source detection on a matching tab. Use when the user says start/scan/check/افحص/ابدأ.",
        parameters: {
            type: "object",
            properties: {
                tabQuery: {
                    type: "string",
                    description: "Free-text hint to match a tab by URL or title (e.g. '123', 'youtube'). Empty for active tab.",
                },
            },
        },
    },
    {
        name: "stop_detection",
        description: "Stop detection.",
        parameters: { type: "object", properties: {} },
    },
    {
        name: "open_url",
        description: "Open a URL in a new tab. url is required.",
        parameters: { type: "object", properties: { url: { type: "string" } } },
    },
    {
        name: "download_url",
        description: "Download a detected media URL.", parameters: { type: "object", properties: { url: { type: "string" } } },
    },
    {
        name: "navigate",
        description: "Navigate the active tab to a URL.", parameters: { type: "object", properties: { url: { type: "string" } } },
    },
    {
        name: "select_quality",
        description: "Select a quality label for the top candidate.", parameters: { type: "object", properties: { quality: { type: "string" } } },
    },
];
const SYSTEM = `You control a browser extension that detects video sources.
Available tools (ONLY these, no page-script execution):
${TOOLS.map((t) => `- ${t.name}: ${t.description}`).join("\n")}
If the user asks to start/scan/check/افحص a tab, call start_detection with a tabQuery hint.
If the user asks a question about the detected results, answer it plainly AND prefer calling a tool only when an action is requested.
Never invent URLs. If unsure which tab, use an empty tabQuery (active tab).`;
// Lightweight local pre-router for common command phrases (works even if the
// model is unavailable), then falls back to Gemini function-calling.
export function localRoute(prompt) {
    const p = prompt.trim();
    if (/(وقف|توق[ّف]؟|stop|halt)/i.test(p)) {
        return { kind: "tool", tool: "stop_detection", args: {} };
    }
    const wantsStart = /(افحص|ابد[أا]؟|scan|start|check|detect|راقب|شغ[ّل]؟|فحص)/i.test(p);
    if (wantsStart) {
        const q = p.replace(/.*?(افحص|ابد[أا]؟|scan|start|check|detect|راقب|شغ[ّل]؟|فحص)/i, "").trim();
        return { kind: "tool", tool: "start_detection", args: { tabQuery: q } };
    }
    return null;
}
export async function chatRoute(apiKey, model, prompt) {
    const local = localRoute(prompt);
    if (local)
        return { intent: local, reply: "" };
    const res = await geminiGenerateText(apiKey, model, prompt, SYSTEM);
    if (res.error || !res.text) {
        return { intent: { kind: "chat", prompt }, reply: res.error || "No response from AI." };
    }
    // Parse a tool call from the model response (best-effort JSON in text).
    const tool = extractToolCall(res.text);
    if (tool)
        return { intent: tool, reply: stripToolJson(res.text) };
    return { intent: { kind: "chat", prompt }, reply: res.text };
}
function extractToolCall(text) {
    const m = text.match(/\{[^{}]*"name"\s*:\s*"([a-z_]+)"[^{}]*\}/i);
    if (m && TOOLS.some((t) => t.name === m[1])) {
        try {
            const obj = JSON.parse(m[0]);
            return { kind: "tool", tool: obj.name, args: obj.args || {} };
        }
        catch {
            return { kind: "tool", tool: m[1], args: {} };
        }
    }
    return null;
}
function stripToolJson(text) {
    return text.replace(/\{[^{}]*"name"\s*:\s*"[^"]+"[^{}]*\}/g, "").trim();
}
export { TOOLS };
//# sourceMappingURL=chat.js.map