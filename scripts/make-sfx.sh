#!/usr/bin/env bash
# Regenerates the built-in sound effects in public/sfx/ with ffmpeg.
# Each: mono 44.1 kHz 16-bit WAV, short fades (no clicks), peak ~ -6 dBFS.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/sfx
mkdir -p "$OUT"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# render <name> <duration> <filtergraph producing [out]>
render() {
  local name=$1 dur=$2 graph=$3
  ffmpeg -hide_banner -loglevel error -y -filter_complex "$graph" -map '[out]' -t "$dur" -ac 1 -ar 44100 -c:a pcm_f32le "$TMP/$name.wav"
  # Peak-normalize to -6 dBFS.
  local peak
  peak=$(ffmpeg -hide_banner -i "$TMP/$name.wav" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-\?[0-9.]*\) dB.*/\1/p')
  local gain
  gain=$(awk -v p="$peak" 'BEGIN{printf "%.2f", -6 - p}')
  ffmpeg -hide_banner -loglevel error -y -i "$TMP/$name.wav" -af "volume=${gain}dB" -ac 1 -ar 44100 -c:a pcm_s16le "$OUT/$name.wav"
  echo "$name.wav  peak ${peak} dB -> gain ${gain} dB"
}

# pop: pitched blip, quick downward pitch glide + fast exponential decay.
render pop 0.18 "aevalsrc='0.8*sin(2*PI*(480*t+500*0.03*(1-exp(-t/0.03))))*exp(-t/0.04)+0.15*sin(2*PI*(960*t+1000*0.03*(1-exp(-t/0.03))))*exp(-t/0.02)':s=44100:d=0.18,afade=t=in:d=0.003,afade=t=out:st=0.13:d=0.05[out]"

# swish: short bandpassed noise with a rising-then-falling envelope.
render swish 0.38 "anoisesrc=d=0.38:c=pink:r=44100:a=0.8,highpass=f=900,lowpass=f=6500,volume='sin(PI*t/0.38)^2':eval=frame,afade=t=in:d=0.02,afade=t=out:st=0.3:d=0.08[out]"

# whoosh: longer, lower noise sweep (lowpass opens up then closes).
render whoosh 0.75 "anoisesrc=d=0.75:c=brown:r=44100:a=0.9,highpass=f=120,lowpass=f=2400,volume='sin(PI*t/0.75)^3':eval=frame,afade=t=in:d=0.05,afade=t=out:st=0.6:d=0.15[out]"

# shimmer: a few high sine partials with tremolo and a decay (sparkle).
render shimmer 0.9 "aevalsrc='0.38*(sin(2*PI*2093*t)+0.7*sin(2*PI*2637*t+1)+0.5*sin(2*PI*3136*t+2)+0.35*sin(2*PI*4186*t+3))*exp(-t/0.28)*(0.65+0.35*sin(2*PI*14*t))':s=44100:d=0.9,afade=t=in:d=0.01,afade=t=out:st=0.7:d=0.2[out]"

# paper: crinkly bandpassed noise bursts.
render paper 0.42 "anoisesrc=d=0.42:c=white:r=44100:a=0.9,bandpass=f=3200:width_type=q:w=0.8,volume='(0.25+0.75*gt(sin(2*PI*23*t)+sin(2*PI*37*t+1)+sin(2*PI*61*t+2),1.2))*exp(-t/0.25)':eval=frame,afade=t=in:d=0.005,afade=t=out:st=0.36:d=0.06[out]"

# click: very short tick.
render click 0.06 "aevalsrc='0.6*(sin(2*PI*3200*t)+0.5*sin(2*PI*1600*t))*exp(-t/0.006)':s=44100:d=0.06,afade=t=in:d=0.0007,afade=t=out:st=0.04:d=0.02[out]"

ls -la "$OUT"
