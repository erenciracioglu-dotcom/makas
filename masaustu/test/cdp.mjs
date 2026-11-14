// Calisan Makas penceresinde JS calistirir: node test/cdp.mjs "<ifade>" [port]
const ifade = process.argv[2] || 'document.title';
const port = process.argv[3] || 9333;
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const t = list.find(x => x.url.startsWith('makas://')) || list[0];
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const bekleyen = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && bekleyen.has(m.id)) { bekleyen.get(m.id)(m); bekleyen.delete(m.id); } });
const gonder = (method, params = {}) => new Promise(r => { const i = ++id; bekleyen.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const r = await gonder('Runtime.evaluate', { expression: ifade, awaitPromise: true, returnByValue: true });
console.log(JSON.stringify(r.result?.result?.value ?? r.result ?? r, null, 1));
if (process.argv.includes('--shot')) {
  const s = await gonder('Page.captureScreenshot', { format: 'png' });
  (await import('fs')).writeFileSync(process.argv[process.argv.indexOf('--shot') + 1], Buffer.from(s.result.data, 'base64'));
}
ws.close();
