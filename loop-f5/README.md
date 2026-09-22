# Where to Loop in Flow-Matching Text-to-Speech

A compact research demo for six shared-depth F5-TTS layouts. Live page: **https://jiabaoai67.github.io/loop-f5/**.

The page includes an architecture overview, six reproducibly selected Seed-TTS examples for all six layouts at 4 and 32 sampling steps, interactive sampling curves, complete quality tables, and inference/training resource measurements.

## Run locally

From this directory:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/`. No build step or external JavaScript, CSS, font, analytics or CDN dependency is required. Use an HTTP server: browsers generally block local JSON fetches from `file://` URLs.

## Files

- `index.html`, `site.css`, `site.js`: responsive page and interactions.
- `data/results.json`: aggregate quality, fixed-seed curves and measured resources.
- `data/samples.json`: texts, reference voices, output paths and per-clip objective metrics.
- `data/audio-sha256.json`: SHA-256 and audio-format metadata for the 78 WAV files.
- `assets/audio/`: six reference clips and 72 model outputs, unmodified PCM16 WAV.
- `scripts/`: deterministic export utilities; require the original experiment data/audit summaries, not needed to serve the site.

## Reading the results

Quality-table means average four inference seeds for Seed-TTS and three for LibriSpeech-PC. Sampling curves fix one inference seed throughout each curve (666 / 0); their endpoints therefore differ from table averages. Demo audio uses seed 0 for every model, with 500k EMA checkpoints, Euler sampling, CFG 2 and sway −1.

The six examples are chosen by fixed hash within natural-target-duration terciles, two per group with distinct prompts, before reading model quality metrics. They include failures and counterexamples; they are not a representative subjective evaluation or a claim about every individual sentence.

Memory and RTF in the main table always refer to the 32-step Seed-TTS H100 measurement, even when the quality controls change. Inference memory includes the vocoder, whereas sampling RTF excludes it. Training allocated and reserved memory are separately reported, along with training hardware and their rank-0 cumulative-peak scope. Sub-percent timing differences are not presented as an architecture speedup. UTMOS is an automatic predictor, not human MOS.

## Acknowledgments

Page organization is inspired by [TDJD-TTS Demo](https://github.com/JiabaoAi67/TDJD_TTS_Demo); the HTML/CSS/JavaScript here are a new implementation. The models follow [F5-TTS](https://github.com/SWivid/F5-TTS), and the English listening examples use the [Seed-TTS evaluation benchmark](https://github.com/BytedanceSpeech/seed-tts-eval). Audio and research artifacts retain their respective upstream provenance; this repository does not relicense third-party material.
