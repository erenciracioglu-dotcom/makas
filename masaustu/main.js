// Makas masaustu kabugu (Electron).
// Arayuz ve tum duzenleme kodu app/index.html icinde (web surumuyle ayni dosya).
// Bu kabuk yalniz sunlari ekler: secilen ekran kartini kullanma, GPU ile cizim ve
// donanim video kodlama, diske "Farkli kaydet" penceresi, kalici taslaklar.
'use strict';
const { app, BrowserWindow, Menu, dialog, protocol, net, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');

// ---- Ayarlar -------------------------------------------------------------
const AYAR_DOSYASI = path.join(app.getPath('userData'), 'ayarlar.json');
const VARSAYILAN = { gpu: 'otomatik' }; // otomatik | yuksek | dusuk | kapali
function ayarOku() {
  try { return Object.assign({}, VARSAYILAN, JSON.parse(fs.readFileSync(AYAR_DOSYASI, 'utf8'))); }
  catch { return Object.assign({}, VARSAYILAN); }
}
function ayarYaz(a) {
  try { fs.mkdirSync(path.dirname(AYAR_DOSYASI), { recursive: true }); fs.writeFileSync(AYAR_DOSYASI, JSON.stringify(a, null, 2)); } catch {}
}
const ayar = ayarOku();

// ---- Ekran karti secimi --------------------------------------------------
// Windows'un uygulama basina GPU tercihi (Ayarlar > Ekran > Grafik ile ayni kayit,
// yonetici gerektirmez). 2 = yuksek performans (NVIDIA/AMD harici kart),
// 1 = guc tasarrufu (dahili Intel/AMD cip). Yalniz Makas'in exe'sini etkiler.
function windowsGpuTercihi(deger) {
  if (process.platform !== 'win32') return;
  const anahtar = 'HKCU\\Software\\Microsoft\\DirectX\\UserGpuPreferences';
  // Esitlemeli yaziyoruz: GPU sureci acilmadan once kayit hazir olmali, yoksa
  // secim ancak bir sonraki acilista gecerli olur (Chromium'un kendi
  // force_*_gpu bayraklari Windows'ta karti degistirmiyor; olculdu).
  try {
    require('child_process').execFileSync('reg', ['add', anahtar, '/v', process.execPath, '/t', 'REG_SZ', '/d', `GpuPreference=${deger};`, '/f'],
      { windowsHide: true, timeout: 4000, stdio: 'ignore' });
  } catch {}
}
// "Otomatik": NVIDIA kart varsa bos video belleğine bakar. Yerel LLM gibi bir is
// kartin bellegini doldurmussa (3 GB'tan az bos) Makas dahili cipe gecer, LLM'e
// dokunmaz; kart bossa NVIDIA'yi kullanir. NVIDIA yoksa (or. ProBook) Windows'un
// varsayilanini (genelde Intel Quick Sync) kullanir; AMD menuden secilebilir.
const ESIK_MB = 3000;
let otoAciklama = '';
function nvidiaBosBellekMB() {
  try {
    const out = require('child_process').execFileSync('nvidia-smi',
      ['--query-gpu=memory.free', '--format=csv,noheader,nounits'], { timeout: 4000, windowsHide: true }).toString();
    const v = parseInt(out.split(/\r?\n/)[0], 10);
    return isFinite(v) ? v : null;
  } catch { return null; }
}
let etkinGpu = ayar.gpu; // yuksek | dusuk | kapali | varsayilan
if (ayar.gpu === 'otomatik') {
  const bos = nvidiaBosBellekMB();
  if (bos === null) { etkinGpu = 'varsayilan'; otoAciklama = 'NVIDIA kart bulunamadı; Windows varsayılanı kullanılıyor.'; }
  else if (bos >= ESIK_MB) { etkinGpu = 'yuksek'; otoAciklama = `NVIDIA kartta ${(bos / 1024).toFixed(1)} GB boş bellek var; NVIDIA kullanılıyor.`; }
  else { etkinGpu = 'dusuk'; otoAciklama = `NVIDIA kartta yalnız ${(bos / 1024).toFixed(1)} GB boş bellek var (başka bir iş, örn. yerel LLM kullanıyor); ona dokunmamak için dahili çip kullanılıyor.`; }
}
if (etkinGpu === 'kapali') {
  app.disableHardwareAcceleration();
} else {
  if (etkinGpu === 'yuksek' || etkinGpu === 'dusuk') {
    windowsGpuTercihi(etkinGpu === 'dusuk' ? 1 : 2);
    app.commandLine.appendSwitch(etkinGpu === 'dusuk' ? 'force_low_power_gpu' : 'force_high_performance_gpu');
  } else {
    windowsGpuTercihi(0); // Windows karar versin
  }
  if (ayar.gpu === 'yuksek') app.commandLine.appendSwitch('ignore-gpu-blocklist'); // elle secildiyse eski surucude de dene
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('enable-features', 'PlatformHEVCEncoderSupport,CanvasOopRasterization');
}
// Disa aktarma uzun surer; arka planda yavaslamasin
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// ---- makas:// protokolu --------------------------------------------------
// file:// yerine sabit bir koken: taslaklar (IndexedDB/localStorage) kalici olur,
// ses kutuphanesi (Openverse) istekleri normal calisir.
protocol.registerSchemesAsPrivileged([{
  scheme: 'makas',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true }
}]);
const APP_DIR = path.join(__dirname, 'app');

// Tek kopya
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
function pencereAc() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 800, minHeight: 560,
    backgroundColor: '#111111',
    title: 'Makas',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadURL('makas://app/index.html');
  // Dis baglantilar varsayilan tarayicida acilsin
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('makas://')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); }
  });
}

function gpuBilgisiGoster() {
  Promise.all([app.getGPUInfo('complete').catch(() => null)]).then(([bilgi]) => {
    const st = app.getGPUFeatureStatus();
    const cihazlar = (bilgi && bilgi.gpuDevice || []).map(d =>
      `${d.active ? '► ' : '   '}${d.deviceString || ('vendor 0x' + d.vendorId.toString(16))}`).join('\n') || '(bilgi yok)';
    const secim = { otomatik: 'Otomatik', yuksek: 'Yüksek performans (harici kart)', dusuk: 'Güç tasarrufu (dahili çip)', kapali: 'Kapalı (yalnız işlemci)' }[ayar.gpu];
    dialog.showMessageBox(win, {
      type: 'info', title: 'Ekran kartı durumu',
      message: `Seçim: ${secim}`,
      detail: (otoAciklama ? otoAciklama + '\n\n' : '') + `Ekran kartları (► kullanılan):\n${cihazlar}\n\n` +
        `Çizim (canvas): ${st['2d_canvas']}\nVideo çözme: ${st.video_decode}\nVideo kodlama: ${st.video_encode}\nGPU işleme: ${st.gpu_compositing}\n\n` +
        `"enabled" / "enabled_on" = ekran kartı kullanılıyor.`,
    });
  });
}

function gpuSec(deger) {
  if (ayar.gpu === deger) return;
  ayar.gpu = deger; ayarYaz(ayar);
  dialog.showMessageBox(win, {
    type: 'question', buttons: ['Şimdi yeniden başlat', 'Sonra'], defaultId: 0, cancelId: 1,
    title: 'Ekran kartı', message: 'Değişiklik Makas yeniden başlayınca geçerli olur.',
    detail: 'Açık proje taslak olarak kayıtlı; yeniden başlayınca kaldığın yerden devam edersin.',
  }).then(r => { if (r.response === 0) { app.relaunch(); app.exit(0); } });
}

function menuKur() {
  const sablon = [
    { label: 'Dosya', submenu: [
      { label: 'Videolar klasörünü aç', click: () => shell.openPath(app.getPath('videos')) },
      { type: 'separator' },
      { label: 'Çıkış', role: 'quit' },
    ] },
    { label: 'Görünüm', submenu: [
      { label: 'Yeniden yükle', role: 'reload' },
      { label: 'Tam ekran', role: 'togglefullscreen' },
      { type: 'separator' },
      { label: 'Yakınlaştır', role: 'zoomIn' }, { label: 'Uzaklaştır', role: 'zoomOut' }, { label: 'Gerçek boyut', role: 'resetZoom' },
      { type: 'separator' },
      { label: 'Geliştirici araçları', role: 'toggleDevTools' },
    ] },
    { label: 'Ekran kartı', submenu: [
      { label: 'Otomatik (NVIDIA meşgulse dahili çip)', type: 'radio', checked: ayar.gpu === 'otomatik', click: () => gpuSec('otomatik') },
      { label: 'Yüksek performans (NVIDIA / AMD harici kart)', type: 'radio', checked: ayar.gpu === 'yuksek', click: () => gpuSec('yuksek') },
      { label: 'Güç tasarrufu (dahili Intel / AMD çip)', type: 'radio', checked: ayar.gpu === 'dusuk', click: () => gpuSec('dusuk') },
      { label: 'Kapalı (yalnız işlemci)', type: 'radio', checked: ayar.gpu === 'kapali', click: () => gpuSec('kapali') },
      { type: 'separator' },
      { label: 'Durumu göster…', click: gpuBilgisiGoster },
      { label: 'Ayrıntılı rapor (chrome://gpu)', click: () => {
        const w = new BrowserWindow({ width: 1000, height: 800, title: 'GPU raporu', autoHideMenuBar: true });
        w.loadURL('chrome://gpu');
      } },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(sablon));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  protocol.handle('makas', (req) => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const tam = path.normalize(path.join(APP_DIR, rel));
    if (!tam.startsWith(APP_DIR)) return new Response('yasak', { status: 403 });
    return net.fetch(pathToFileURL(tam).toString());
  });

  // Disa aktarilan videoyu kaydet: "Farkli kaydet" penceresi, varsayilan Videolar klasoru
  session.defaultSession.on('will-download', (_e, item) => {
    item.setSaveDialogOptions({
      title: 'Videoyu kaydet',
      defaultPath: path.join(app.getPath('videos'), item.getFilename() || 'video.mp4'),
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }, { name: 'Tüm dosyalar', extensions: ['*'] }],
    });
    item.once('done', (_ev, durum) => {
      if (durum === 'completed' && win) {
        dialog.showMessageBox(win, { type: 'info', buttons: ['Klasörde göster', 'Tamam'], defaultId: 0, cancelId: 1,
          title: 'Kaydedildi', message: path.basename(item.getSavePath()), detail: item.getSavePath() })
          .then(r => { if (r.response === 0) shell.showItemInFolder(item.getSavePath()); });
      }
    });
  });

  // Mikrofon/kamera vb. izin istekleri: yalniz pano ve tam ekran
  session.defaultSession.setPermissionRequestHandler((_wc, izin, cb) => {
    cb(['clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'media', 'screen-wake-lock', 'notifications'].includes(izin));
  });

  menuKur();
  pencereAc();
});

app.on('window-all-closed', () => app.quit());
