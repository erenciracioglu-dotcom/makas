#!/usr/bin/env bash
# tur.sh <port> <etiket> : orneк, 1080p dikey ve 4K testlerini K=1 ve K=4 ile calistirir; sonuc test/sonuc/<etiket>/
cd "$(dirname "$0")/.."
P="$1"; E="$2"; O="test/sonuc/$E"; mkdir -p "$O"; : > "$O/log.txt"
V="$(cygpath -w "$PWD/test/video" 2>/dev/null || echo "$PWD/test/video")"
kos() { timeout 600 node test/dogrula.mjs "$P" "$1" "$2" "$3" "$O/$4.mp4" >> "$O/log.txt" 2>&1 || echo "{\"HATA\":\"$4\"}" >> "$O/log.txt"; }
kos ornek - 1 ornek_k1
kos ornek - 4 ornek_k4
kos "$V\\dikey30.mp4" 1080p 1 dikey_k1
kos "$V\\dikey30.mp4" 1080p 4 dikey_k4
kos "$V\\yatay4k20.mp4" 4K 1 4k_k1
kos "$V\\yatay4k20.mp4" 4K 4 4k_k4
for t in ornek dikey 4k; do echo "== $t" >> "$O/log.txt"; bash test/analiz.sh "$O/${t}_k1.mp4" "$O/${t}_k4.mp4" >> "$O/log.txt" 2>&1; done
echo BITTI >> "$O/log.txt"
