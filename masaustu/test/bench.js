// Hiz testi: Makas'in disa aktarma yolunun ozu (canvas 2D cizim + filtre + VideoEncoder H.264).
// Kullanim: electron test/bench.js yuksek|dusuk|kapali [genislik] [yukseklik] [kare]
'use strict';
const { app, BrowserWindow } = require('electron');
const mod = process.argv.find(a => ['yuksek', 'dusuk', 'kapali'].includes(a)) || 'dusuk';
const sayilar = process.argv.filter(a => /^\d+$/.test(a)).map(Number);
const [W, H, N] = [sayilar[0] || 1920, sayilar[1] || 1080, sayilar[2] || 300]; const KUYRUK = sayilar[3] || 4; const KAYNAK = process.argv.find(a=>['canvas','offscreen','bitmap','ciz-yok','klon','realtime','hevc','av1'].includes(a)) || 'canvas';

if (mod === 'kapali') app.disableHardwareAcceleration();
else {
  app.commandLine.appendSwitch(mod === 'dusuk' ? 'force_low_power_gpu' : 'force_high_performance_gpu');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

const sayfa = `<!doctype html><body><script>
async function bench(W,H,N,KUYRUK,KAYNAK){
  const src = document.createElement('canvas'); src.width=W; src.height=H;
  const s = src.getContext('2d');
  // kaynak "video karesi" yerine desenli bir goruntu
  const g = s.createLinearGradient(0,0,W,H); g.addColorStop(0,'#e63'); g.addColorStop(1,'#36e');
  s.fillStyle=g; s.fillRect(0,0,W,H);
  for(let i=0;i<400;i++){s.fillStyle='hsl('+(i*37%360)+',70%,50%)';s.beginPath();s.arc((i*97)%W,(i*53)%H,20+i%60,0,7);s.fill();}
  const bmp = await createImageBitmap(src);
  const c = KAYNAK==='offscreen' ? new OffscreenCanvas(W,H) : document.createElement('canvas'); c.width=W; c.height=H;
  const x = c.getContext('2d',{alpha:false});
  let paket=0, bayt=0, hata=null;
  const enc = new VideoEncoder({output:(ch)=>{paket++;bayt+=ch.byteLength;}, error:(e)=>{hata=String(e)}});
  const cfg = {codec: KAYNAK==='hevc'?'hev1.1.6.L153.B0':KAYNAK==='av1'?'av01.0.12M.08':'avc1.640033', width:W, height:H, bitrate:12e6, framerate:30, latencyMode: KAYNAK==='realtime'?'realtime':'quality'}; let ilk=null;
  const hw = await VideoEncoder.isConfigSupported({...cfg, hardwareAcceleration:'prefer-hardware'}).then(r=>r.supported).catch(()=>false);
  enc.configure(cfg);
  const t0 = performance.now();
  for(let k=0;k<N;k++){
    const t=k/30;
    if(KAYNAK!=='ciz-yok'||k===0){ x.save();
    x.filter='saturate(1.3) contrast(1.1) brightness(1.05)';             // filtre
    x.translate(W/2,H/2); x.scale(1+0.1*Math.sin(t),1+0.1*Math.sin(t)); x.rotate(0.05*Math.sin(t*2)); // zoom/efekt
    x.drawImage(bmp,-W/2,-H/2,W,H);
    x.restore();
    x.globalAlpha=0.5+0.5*Math.sin(t); x.drawImage(bmp,W*0.6,H*0.6,W*0.35,H*0.35); x.globalAlpha=1; // katman/gecis
    x.font='bold 96px sans-serif'; x.fillStyle='#fff'; x.strokeStyle='#000'; x.lineWidth=6;
    x.strokeText('Makas '+k, 80, 160); x.fillText('Makas '+k, 80, 160); }               // metin
    const kaynak = KAYNAK==='bitmap' ? (c.transferToImageBitmap ? c.transferToImageBitmap() : await createImageBitmap(c)) : c; if(KAYNAK==='klon'&&!ilk) ilk=new VideoFrame(c,{timestamp:0}); const f = KAYNAK==='klon' ? new VideoFrame(ilk,{timestamp:Math.round(k*1e6/30), duration:Math.round(1e6/30)}) : new VideoFrame(kaynak,{timestamp:Math.round(k*1e6/30), duration:Math.round(1e6/30)});
    enc.encode(f,{keyFrame:k%60===0}); f.close(); if(kaynak!==c&&kaynak.close) kaynak.close();
    if(enc.encodeQueueSize>=KUYRUK) await new Promise(r=>enc.addEventListener('dequeue',r,{once:true}));
  }
  await enc.flush(); enc.close();
  const sn=(performance.now()-t0)/1000;
  return {KUYRUK,KAYNAK,W,H,N, saniye:+sn.toFixed(2), fps:+(N/sn).toFixed(1), paket, MB:+(bayt/1e6).toFixed(1), donanimKodlayiciVar:hw, hata};
}
</script></body>`;

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { backgroundThrottling: false } });
  const p=require('path').join(app.getPath('temp'),'makas_bench.html');require('fs').writeFileSync(p,sayfa);await w.loadFile(p);
  let sonuc;
  try { sonuc = await w.webContents.executeJavaScript(`bench(${W},${H},${N},${KUYRUK},"${KAYNAK}")`); }
  catch (e) { sonuc = { hata: String(e) }; }
  const info = await app.getGPUInfo('complete').catch(() => null);
  const aktif = info && (info.gpuDevice || []).filter(d => d.active).map(d => d.deviceString || d.vendorId);
  const st = app.getGPUFeatureStatus();
  console.log('SONUC ' + JSON.stringify({ mod, aktifGPU: aktif, canvas: st['2d_canvas'], video_encode: st.video_encode, ...sonuc }));
  app.exit(0);
});
