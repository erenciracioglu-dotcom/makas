# Makas — Windows masaüstü sürümü

Electron kabuğu. Arayüz ve tüm düzenleme kodu, depo kökündeki `index.html` ile aynıdır (`npm run app-hazirla` onu `app/` altına kopyalar).

```
npm install
npm start        # geliştirme
npm run dist     # dist/Makas-Kurulum-<sürüm>.exe ve Makas-Tasinabilir-<sürüm>.exe
```

- `main.js` — `makas://` protokolü (kalıcı taslaklar), ekran kartı seçimi (Windows'un uygulama başına GPU tercihi, yalnız Makas.exe için), "Farklı kaydet", menü.
- `yama/paralel_r0.js` — paralel dışa aktarma. `node yama/uygula.js <girdi.html> <çıktı.html>` bunu derlenmiş dosyaya uygular: eski dışa aktarma `r0s` adıyla yedek olarak kalır.
- `test/` — ölçüm ve doğrulama araçları (Chrome DevTools protokolü üzerinden). `dogrula.mjs` dışa aktarıp MP4'ü kaydeder, `analiz.sh` ffprobe/ffmpeg ile kare sayısı, süre, ses ve kare kare PSNR karşılaştırır, `bench.js` ve `paralel.js` kodlayıcı hızını ölçer.

Paralel kodlayıcı sayısı: bilgisayarda 3, telefonda 2. Elle değiştirmek için tarayıcı konsolunda `localStorage.setItem('makas.paralel','4')` (1 = eski sıralı yol).
