# Depth Through Recurrence: Looped Transformers for Flow-Matching TTS

A research page for seven Transformer weight-sharing layouts in flow-matching text-to-speech. The title and abstract match the current manuscript. Live: **https://jiabaoai67.github.io/loop-f5/**.

The page follows the title / Abstract / method / findings / audio structure of [TDJD-TTS Demo](https://github.com/JiabaoAi67/TDJD_TTS_Demo), with a standalone HTML/CSS/JavaScript implementation. All seven systems are always shown: Baseline (18 × 1), CYCLE 9 × 2, SEQUENCE 9 × 2, Loop 6 × 3, Prefix, Middle, and Suffix. CYCLE repeats the full nine-block stack; SEQUENCE repeats each block immediately (1,1,2,2,…,9,9). Both use 83.6M parameters. Other full-loop notation means unique blocks × passes; all layouts execute 18 block calls per network evaluation.

## Run locally

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/` from this directory. No build step or external JavaScript, CSS, fonts, analytics, or CDN dependencies. Use HTTP rather than `file://` so the browser can fetch the JSON data.

## Page contents

- Abstract and a seven-row architecture overview. Within each model's hue, shared blocks darken on their first, second, and third uses; unshared blocks remain gray. CYCLE shows two nine-block shades, SEQUENCE alternates light/dark within each adjacent pair, and Loop 6 × 3 shows three six-block shades. Block numbers identify shared weights within each row; a compact legend explains the shading.
- Directly selectable WER, SIM-o, and UTMOS figures. Every metric shows all seven models on both datasets at 32 and 4 steps, with labeled means. SEQUENCE has complete WER, corrected SIM-o, and UTMOS at both budgets, with matched audio examples. Mobile uses a stacked figure. Baseline is gray. CYCLE is blue, SEQUENCE purple, and Loop 6 × 3 green; Prefix, Middle, and Suffix retain teal, ochre, and coral. Shared blocks in the architecture diagram use the same model colors as the quality figures.
- Six reproducibly selected Seed-TTS examples. Each displays all seven models at both 32 and 4 steps: adjacent columns on desktop, labeled players stacked within each model on mobile.
- A complete seven-model table whose quality metric switches together with the figure: WER, SIM-o, or UTMOS at both budgets. Parameters and allocated inference/training memory as percentages of Baseline remain visible. Baseline is 100%; these values are percentages used, not percentages saved. Absolute measurements and RTF remain available in the downloadable result data; measurement scope is summarized in the table footnotes.

## Files and protocols

`data/results.json` contains aggregate quality, fixed-seed curves, and resources. The page's three quality figures and table use the same multi-seed quality means: four inference seeds for Seed-TTS and three for LibriSpeech-PC. Null values denote unavailable metrics and are excluded from best-value highlighting. SEQUENCE does not yet have a complete four-budget curve in this export. Single-seed curves remain in the data for reference but are not mixed into the displayed comparison.

`data/samples.json` contains texts, reference voices, output paths, selection details, and per-clip objective metrics. Audio uses seed 0 for every model, 500k-update EMA checkpoints, Euler sampling, CFG 2, and sway −1. Six examples are selected by fixed hash within target-duration terciles, two per group with distinct prompts, before reading model quality metrics. The fixed sample order includes failures and counterexamples. These examples are not a human listening test.

`assets/audio/` contains six reference clips and 84 model outputs, unmodified PCM16 WAV. `data/audio-sha256.json` records the 90 file checksums. The `scripts/` exporters require the original experiment data/audit summaries and are not needed to serve the site.

Memory percentages are computed from the unrounded absolute measurements, separately for inference and training. Inference allocation and RTF refer to the 32-step Seed-TTS H100/FP32/batch-one measurement. Memory includes the vocoder; sampling RTF excludes vocoding. Training figures are late-training rank-0 cumulative process peaks in GiB, with mixed H100/H200 hardware. Absolute values, hardware, and measurement scope are reported separately; these values are not minimum GPU requirements. Small timing differences are not evidence of a speed advantage. UTMOS is an automatic predictor, not human MOS.

## Acknowledgments

Page structure follows [TDJD-TTS Demo](https://github.com/JiabaoAi67/TDJD_TTS_Demo). The models use the [F5-TTS](https://github.com/SWivid/F5-TTS) Small architecture with a modified training implementation, and the listening examples use the [Seed-TTS evaluation benchmark](https://github.com/BytedanceSpeech/seed-tts-eval). Audio and research artifacts retain their upstream provenance; this repository does not relicense third-party material.

## SEQUENCE result update

The SEQUENCE row and its twelve audio files were audited against raw 500k-update results. Reuse order was verified from the training share-pattern manifest and every inference protocol. Only complete corrected-SIM / WER / UTMOS seed sets are exported. The original six systems and sample selection are preserved. The results exporter supports the original six-model audit plus the SEQUENCE extension via `--sequence-audit`; the raw audit and audio-extension script is retained in the paper analysis directory. The original audio-selection script reproduces the six-model starting point.

## Memory display

The page shows allocated memory only. Original reserved-memory records remain in the downloadable result data for provenance. Training values are cumulative rank-0 process peaks, including earlier startup/resume history; they are not per-window peaks or minimum GPU requirements.
