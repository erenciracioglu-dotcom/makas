// Disa aktarma profili: node test/prof.mjs <port> <video yolu> <cozunurluk etiketi, or. 1080p|4K|src> [etiket]
// Makas penceresine videoyu yukler, disa aktarir; ana is parcaciginin (JS) zamanini fonksiyon fonksiyon olcer.
import fs from 'fs';
const [port = 9340, video, res = '1080p', etiket = 'test'] = process.argv.slice(2);
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const t = list.find(x => x.url.startsWith('makas://'));
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const bek = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && bek.has(m.id)) { bek.get(m.id)(m); bek.delete(m.id); } });
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; bek.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500)); return r.result?.result?.value; };
const uyu = ms => new Promise(r => setTimeout(r, ms));

await cmd('Page.enable'); await cmd('Page.reload'); await uyu(3000);
await ev(`(()=>{const o=HTMLInputElement.prototype.click;HTMLInputElement.prototype.click=function(){if(this.type==='file'){window.__fi=this.id;return;}return o.call(this)};const b=[...document.querySelectorAll('button,a,div[role=button]')].find(x=>/^(New project|Yeni proje)/i.test(x.textContent.trim()));b&&b.click();return window.__fi})()`).then(v=>console.error('input:',v));
const doc = await cmd('DOM.getDocument', { depth: -1 });
const q = await cmd('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#'+(await ev('window.__fi')||'fileClips') });
await cmd('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [video] });
// editor acilip medya hazir olana kadar bekle
for (let i = 0; i < 120; i++) { await uyu(500); if (await ev(`!!document.getElementById('btnExport')?.offsetParent && !document.querySelector('.dialog')`)) break; }
await uyu(3000);

await cmd('Profiler.enable');
await cmd('Profiler.setSamplingInterval', { interval: 250 });
await cmd('Profiler.start');
const sonuc = await ev(`(async()=>{
  window.__lastExport=null; window.__P={};
  document.getElementById('btnExport').click(); await new Promise(r=>setTimeout(r,800));
  const d=document.querySelector('.dialog');
  const chip=[...d.querySelectorAll('button.chipb')].find(b=>b.textContent.trim()===${JSON.stringify(res)} || (${JSON.stringify(res)}==='src' && b._v==='src'));
  if(chip) chip.click(); await new Promise(r=>setTimeout(r,300));
  const info=d.querySelector('p.muted').textContent;
  [...d.querySelectorAll('button')].find(b=>b.classList.contains('primary')).click();
  const t0=performance.now(); const faz={}; let son=null, sonT=t0;
  while(!window.__lastExport){
    await new Promise(r=>setTimeout(r,100));
    const dl=document.querySelector('.dialog'); const tx=dl?dl.innerText:'';
    const f=/audio|ses/i.test(tx)&&!/remaining|kalan/i.test(tx)?'ses':/finaliz|tamamlan/i.test(tx)?'bitir':'video';
    const n=performance.now(); if(son) faz[son]=(faz[son]||0)+(n-sonT); son=f; sonT=n;
    if(n-t0>600000) break;
  }
  const e=window.__lastExport;
  return {info, W:e.W,H:e.H,codec:e.codec,video_sn:+e.dur.toFixed(1),islem_sn:+e.secs.toFixed(2), adim_sn:Object.fromEntries(Object.entries(window.__P||{}).map(([k,v])=>[k,+(v/1000).toFixed(2)])), fazlar_sn:Object.fromEntries(Object.entries(faz).map(([k,v])=>[k,+(v/1000).toFixed(2)]))};
})()`);
const prof = (await cmd('Profiler.stop')).result.profile;
await ev(`[...document.querySelectorAll('.dialog button')].pop()?.click()`);

// --- profil analizi: oz (self) sure fonksiyon basina
const dt = prof.timeDeltas; const toplam = (prof.endTime - prof.startTime) / 1000;
const self = new Map(); const byId = new Map(prof.nodes.map(n => [n.id, n]));
prof.samples.forEach((sid, i) => { const d = (dt[i + 1] ?? 0) / 1000; self.set(sid, (self.get(sid) || 0) + d); });
const agg = new Map();
for (const [sid, ms] of self) {
  const cf = byId.get(sid).callFrame;
  const k = `${cf.functionName || '(anon)'}@${cf.lineNumber + 1}:${cf.columnNumber + 1}`;
  agg.set(k, (agg.get(k) || 0) + ms);
}
const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8').split('\n');
const ozet = [...agg].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, ms]) => {
  const m = k.match(/@(\d+):(\d+)$/); let kod = '';
  if (m && +m[1] > 0) { const ln = html[+m[1] - 1] || ''; kod = ln.slice(+m[2] - 1, +m[2] + 70); }
  return { fn: k, ms: Math.round(ms), yuzde: +(100 * ms / toplam).toFixed(1), kod };
});
const sistem = {};
for (const [k, ms] of agg) { const n = k.split('@')[0]; if (n.startsWith('(')) sistem[n] = Math.round((sistem[n] || 0) + ms); }
const out = { etiket, ...sonuc, profil_ms: Math.round(toplam), sistem, ozet };
fs.writeFileSync(new URL(`./prof_${etiket}.json`, import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ etiket, ...sonuc, profil_ms: Math.round(toplam), sistem }, null, 1));
console.log(ozet.slice(0, 15).map(o => `${String(o.yuzde).padStart(5)}%  ${o.fn.padEnd(22)} ${o.kod.replace(/\s+/g, ' ')}`).join('\n'));
ws.close();
