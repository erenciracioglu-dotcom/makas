// Ayni anda K adet VideoEncoder: electron test/paralel.js yuksek|dusuk W H N K [codec]
'use strict';
const { app, BrowserWindow } = require('electron');
const mod = process.argv.find(a => ['yuksek', 'dusuk'].includes(a)) || 'yuksek';
const s = process.argv.filter(a => /^\d+$/.test(a)).map(Number);
const [W, H, N, K] = [s[0] || 3840, s[1] || 2160, s[2] || 300, s[3] || 2];
const codec = process.argv.includes('hevc') ? 'hev1.1.6.L153.B0' : 'avc1.640033';
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
const sayfa = `<!doctype html><body><script>
async function kos(W,H,N,K,codec){
  const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d',{alpha:false});
  const g=x.createLinearGradient(0,0,W,H); g.addColorStop(0,'#e63'); g.addColorStop(1,'#36e');
  const encs=[]; let paket=0, hata=null;
  for(let e=0;e<K;e++){ const en=new VideoEncoder({output:()=>paket++, error:er=>hata=String(er)});
    en.configure({codec,width:W,height:H,bitrate:30e6,framerate:30,latencyMode:'quality'}); encs.push(en); }
  const t0=performance.now();
  // her kodlayici kendi bolumunu alir; kareler sirayla cizilip ilgili kodlayiciya verilir
  const parca=Math.ceil(N/K);
  for(let k=0;k<parca;k++){
    for(let e=0;e<K;e++){
      const i=e*parca+k; if(i>=N) continue;
      x.fillStyle=g; x.fillRect(0,0,W,H); x.fillStyle='#fff'; x.font='bold 200px sans-serif'; x.fillText('#'+i,200,400);
      const f=new VideoFrame(c,{timestamp:Math.round(k*1e6/30),duration:33333});
      encs[e].encode(f,{keyFrame:k===0}); f.close();
    }
    for(const en of encs) if(en.encodeQueueSize>=4) await new Promise(r=>en.addEventListener('dequeue',r,{once:true}));
  }
  await Promise.all(encs.map(en=>en.flush()));
  const sn=(performance.now()-t0)/1000;
  return {K,codec,W,H,N,saniye:+sn.toFixed(2),fps:+(N/sn).toFixed(1),paket,hata};
}
</script></body>`;
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } });
  const p = require('path').join(app.getPath('temp'), 'makas_paralel.html'); require('fs').writeFileSync(p, sayfa); await w.loadFile(p);
  const r = await w.webContents.executeJavaScript(`kos(${W},${H},${N},${K},"${codec}")`).catch(e => ({ hata: String(e) }));
  const info = await app.getGPUInfo('basic').catch(() => null);
  console.log('SONUC ' + JSON.stringify({ gpu: (info?.gpuDevice || []).filter(d => d.active).map(d => d.deviceString || d.vendorId)[0], ...r }));
  app.exit(0);
});
