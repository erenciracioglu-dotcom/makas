// Paralel disa aktarma yamasini uygular: node yama/uygula.js <girdi.html> <cikti.html>
// Eski r0 -> r0s (sirali yedek yol), yeni r0 = yama/paralel_r0.js
const fs = require('fs'), path = require('path');
const [girdi, cikti] = process.argv.slice(2);
let s = fs.readFileSync(girdi, 'utf8');
if (s.includes('async function r0s(')) { console.error('Zaten yamali'); process.exit(1); }
const ISARET = 'async function r0(i,e,t,r){';
if (s.split(ISARET).length !== 2) { console.error('r0 bulunamadi / birden fazla'); process.exit(1); }
const yeni = fs.readFileSync(path.join(__dirname, 'paralel_r0.js'), 'utf8').trim();
// yorum satirlarini koru ama </script> gibi tehlikeli dizi olmasin
if (/<\/script/i.test(yeni)) { console.error('yamada </script> var'); process.exit(1); }
s = s.replace(ISARET, () => yeni + ISARET.replace('r0(', 'r0s('));
fs.writeFileSync(cikti, s);
console.log('yama uygulandi:', cikti, (s.length / 1e6).toFixed(2) + ' MB');
