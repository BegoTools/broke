import { WebSocket } from "ws";
const wsUrl = process.argv[2];
const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
function send(method, params) {
  return new Promise((res) => {
    const mid = ++id;
    pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });
}
ws.on("message", (d) => {
  const m = JSON.parse(d.toString());
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
ws.on("open", async () => {
  await send("Runtime.enable");
  const setRes = await send("Runtime.evaluate", {
    expression: "new Promise(r=>chrome.storage.local.set({ 'vsd.settings': { geminiApiKey: 'AIza-TESTKEY123', aiEnabled: true } }, ()=>r('set-ok')))",
    awaitPromise: true, returnByValue: true,
  });
  await new Promise(r=>setTimeout(r,500));
  const getRes = await send("Runtime.evaluate", {
    expression: "new Promise(r=>chrome.storage.local.get('vsd.settings', x=>r(JSON.stringify(x))))",
    awaitPromise: true, returnByValue: true,
  });
  console.log("SET:", JSON.stringify(setRes.result));
  console.log("GET:", getRes.result && getRes.result.value);
  ws.close();
  process.exit(0);
});
