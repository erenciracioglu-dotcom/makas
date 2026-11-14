#!/usr/bin/env bash
# analiz.sh <referans.mp4> <test.mp4> : kare sayisi, sureler, ses, kare kare PSNR (en dusuk ve ortalama)
ref="$1"; tst="$2"
bilgi() {
  local f="$1"
  local vk=$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$f")
  local vd=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$f")
  local ad=$(ffprobe -v error -select_streams a:0 -show_entries stream=duration -of csv=p=0 "$f")
  local kk=$(ffprobe -v error -select_streams v:0 -skip_frame nokey -show_entries frame=pts_time -of csv=p=0 "$f" | wc -l)
  local hata=$(ffmpeg -v error -i "$f" -f null - 2>&1 | wc -l)
  echo "kare=$vk video_sn=$vd ses_sn=${ad:-yok} anahtar_kare=$kk cozme_hatasi=$hata"
}
echo "REF  $(bilgi "$ref")"
echo "TEST $(bilgi "$tst")"
ffmpeg -v error -i "$tst" -i "$ref" -lavfi "[0:v][1:v]psnr=stats_file=psnr.log" -f null - 2>/dev/null
awk '{for(i=1;i<=NF;i++) if($i ~ /^psnr_avg:/){split($i,a,":"); v=a[2]; if(v=="inf")v=99; n++; s+=v; if(min==""||v<min){min=v;mk=$1}}} END{printf "PSNR ort=%.1f dB  en_dusuk=%.1f dB (%s)  kare=%d\n", s/n, min, mk, n}' psnr.log
