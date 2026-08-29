// Browser-safe Gemini REST client (Google AI Studio).
// Uses fetch only (no Node-only SDK). Secret URL param VALUES are masked
// before any payload leaves the extension.
const SECRET_PARAMS = new Set([
    "token", "tokens", "auth", "auth_token", "authorization", "access_token",
    "signature", "sig", "sign", "s", "exp", "expires", "expiry", "session",
    "sessionid", "sid", "key", "hmac", "hmacsha256", "nonce", "st", "policy",
    "accesskey", "ak", "sk", "hash", "verify", "cdntoken", "x-amz-security-token",
    "x-amz-signature", "x-goog-signature", "client_secret",
]);
// Mask the VALUE of any secret-like query param so the key/secret itself
// is never transmitted, while preserving the param name and URL shape.
export function maskSecretParams(rawUrl) {
    let url;
    try {
        url = new URL(rawUrl);
    }
    catch {
        return rawUrl;
    }
    let changed = false;
    for (const key of Array.from(url.searchParams.keys())) {
        const k = key.toLowerCase();
        const isSecret = SECRET_PARAMS.has(k) ||
            k.includes("token") || k.includes("signature") || k.includes("sign") ||
            k.includes("auth") || k.includes("session") || k.includes("secret") ||
            k.includes("hmac") || k.includes("credential");
        if (isSecret && url.searchParams.get(key)) {
            url.searchParams.set(key, "***");
            changed = true;
        }
    }
    if (!changed)
        return rawUrl;
    if (url.search === "?")
        url.search = "";
    return url.toString();
}
export async function geminiGenerateText(apiKey, model, prompt, systemInstruction) {
    if (!apiKey)
        return { text: "", error: "No Gemini API key configured." };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const contents = [
        {
            role: "user",
            parts: [{ text: prompt }],
        },
    ];
    const body = {
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    };
    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    try {
        const resp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const txt = await resp.text().catch(() => "");
            return { text: "", error: `Gemini HTTP ${resp.status}: ${txt.slice(0, 200)}` };
        }
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        if (data?.promptFeedback?.blockReason) {
            return { text, error: `Blocked: ${data.promptFeedback.blockReason}` };
        }
        return { text };
    }
    catch (e) {
        return { text: "", error: `Network error: ${String(e).slice(0, 200)}` };
    }
}
//# sourceMappingURL=gemini-client.js.map