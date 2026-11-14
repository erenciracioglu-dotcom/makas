// node test/dogrula.mjs <port> <ornek|video yolu> <res etiketi: 1080p|4K|-> <K> <cikti.mp4>
// Makas'ta disa aktarir (K=1 sirali, K>1 paralel), MP4'u diske yazar, sonucu JSON basar.
import fs from 'fs';
const [port, kaynak, res, K, cikti] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const t = list.find(x => x.url.startsWith('makas://') || /index.html/.test(x.url));
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const bek = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && bek.has(m.id)) { bek.get(m.id)(m); bek.delete(m.id); } });
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; bek.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result?.result?.value; };
const uyu = ms => new Promise(r => setTimeout(r, ms));
const uyari = [];
await cmd('Runtime.enable');
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(m.params.type)) uyari.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300)); });

await cmd('Page.enable'); await cmd('Page.reload'); await uyu(3000);
if (kaynak === 'ornek') {
  await ev(`(async()=>{const b=[...document.querySelectorAll('button,a')].find(x=>/sample project|örnek proje/i.test(x.textContent)&&/→|Try|Dene/i.test(x.textContent)); b.click(); await new Promise(r=>setTimeout(r,3000));})()`);
} else {
  await ev(`(()=>{const o=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(){if(this.type==='file'){window.__fi=this.id;return;}return o.call(this)};const b=[...document.querySelectorAll('button,a,div[role=button]')].find(x=>/^(New project|Yeni proje)/i.test(x.textContent.trim()));b&&b.click();})()`);
  const doc = await cmd('DOM.getDocument', { depth: -1 });
  const q = await cmd('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#' + ((await ev('window.__fi')) || 'fileClips') });
  await cmd('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [kaynak] });
}
for (let i = 0; i < 120; i++) { await uyu(500); if (await ev(`!!document.getElementById('btnExport')?.offsetParent && !document.querySelector('.dialog')`)) break; }
await uyu(2500);
const sonuc = await ev(`(async()=>{
  window.__makasK=${Number(K)}; window.__lastExport=null;
  document.getElementById('btnExport').click(); await new Promise(r=>setTimeout(r,800));
  const d=document.querySelector('.dialog');
  const chip=[...d.querySelectorAll('button.chipb')].find(b=>b.textContent.trim()===${JSON.stringify(res)});
  if(chip) chip.click(); await new Promise(r=>setTimeout(r,300));
  const info=d.querySelector('p.muted').textContent;
  [...d.querySelectorAll('button')].find(b=>b.classList.contains('primary')).click();
  let hata=null;
  for(let i=0;i<2400&&!window.__lastExport;i++){await new Promise(r=>setTimeout(r,250)); const dl=document.querySelector('.dialog'); if(dl&&/failed|başarısız|hata/i.test(dl.innerText)){hata=dl.innerText.slice(0,300);break}}
  const e=window.__lastExport; delete window.__makasK;
  if(!e) return {info,hata:hata||'zaman asimi'};
  window.__buf=new Uint8Array(await e.blob.arrayBuffer());
  return {info,W:e.W,H:e.H,codec:e.codec,acodec:e.acodec,dur:+e.dur.toFixed(3),islem_sn:+e.secs.toFixed(2),par:e.par,parErr:e.parErr||null,bayt:window.__buf.length};
})()`);
if (sonuc.bayt) {
  const parcalar = []; const P = 6 * 1024 * 1024;
  for (let o = 0; o < sonuc.bayt; o += P) {
    const b64 = await ev(`(()=>{const a=window.__buf.subarray(${o},${o + P});let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));return btoa(s)})()`);
    parcalar.push(Buffer.from(b64, 'base64'));
  }
  fs.writeFileSync(cikti, Buffer.concat(parcalar));
  await ev(`delete window.__buf`);
}
await ev(`[...document.querySelectorAll('.dialog button')].pop()?.click()`).catch(() => {});
console.log(JSON.stringify({ K: Number(K), kaynak: kaynak.split(/[\\/]/).pop(), ...sonuc, uyari: uyari.slice(0, 5) }));
ws.close();
