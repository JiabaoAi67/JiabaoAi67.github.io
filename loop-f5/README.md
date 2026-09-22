# Where to Loop in Flow-Matching Text-to-Speech

A paper-style research page for six shared-depth F5-TTS layouts. Live: **https://jiabaoai67.github.io/loop-f5/**.

The page follows the title / Abstract / method / findings / audio structure of [TDJD-TTS Demo](https://github.com/JiabaoAi67/TDJD_TTS_Demo), with a standalone HTML/CSS/JavaScript implementation. All six systems are always shown: Baseline (18 × 1), Loop 9 × 2, Loop 6 × 3, Prefix, Middle, and Suffix. Here, full-loop notation means unique blocks × passes; all layouts execute 18 block calls per network evaluation.

## Run locally

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/` from this directory. No build step or external JavaScript, CSS, fonts, analytics, or CDN dependencies. Use HTTP rather than `file://` so the browser can fetch the JSON data.

## Page contents

- Abstract and a six-row architecture overview.
- Separate 32-step and four-step WER panels for the three equal-size partial loops, with both datasets and directly labeled means. Mobile uses a stacked figure.
- Six reproducibly selected Seed-TTS examples. Each displays all six models at both 32 and 4 steps: adjacent columns on desktop, labeled players stacked within each model on mobile.
- A complete six-model table of WER at both budgets, parameters, inference allocation, recorded training allocation, and sampling RTF. Speaker similarity, UTMOS, and measurement details are available below it.

## Files and protocols

`data/results.json` contains aggregate quality, fixed-seed curves, and resources. Both the page's WER figure and tables use the same multi-seed quality means: four inference seeds for Seed-TTS and three for LibriSpeech-PC. Single-seed curves remain in the data for reference but are not mixed into the displayed comparison.

`data/samples.json` contains texts, reference voices, output paths, selection details, and per-clip objective metrics. Audio uses seed 0 for every model, 500k-update EMA checkpoints, Euler sampling, CFG 2, and sway −1. Six examples are selected by fixed hash within target-duration terciles, two per group with distinct prompts, before reading model quality metrics. The fixed sample order includes failures and counterexamples. These examples are not a human listening test.

`assets/audio/` contains six reference clips and 72 model outputs, unmodified PCM16 WAV. `data/audio-sha256.json` records the 78 checksums and format metadata. The `scripts/` exporters require the original experiment data/audit summaries and are not needed to serve the site.

Inference allocation and RTF refer to the 32-step Seed-TTS H100/FP32/batch-one measurement. Memory includes the vocoder; sampling RTF excludes vocoding. Training figures are late-training rank-0 cumulative process peaks in GiB, with mixed H100/H200 hardware. Reserved memory, hardware, and measurement scope are reported separately; these values are not minimum GPU requirements. Small timing differences are not evidence of a speed advantage. UTMOS is an automatic predictor, not human MOS.

## Acknowledgments

Page structure follows [TDJD-TTS Demo](https://github.com/JiabaoAi67/TDJD_TTS_Demo). The models follow [F5-TTS](https://github.com/SWivid/F5-TTS), and the listening examples use the [Seed-TTS evaluation benchmark](https://github.com/BytedanceSpeech/seed-tts-eval). Audio and research artifacts retain their upstream provenance; this repository does not relicense third-party material.
