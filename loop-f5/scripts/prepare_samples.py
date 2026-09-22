#!/usr/bin/env python3
"""Copy a deterministic, metric-blind subset of completed Seed-TTS evaluations.

No inference, resampling, trimming, loudness normalization, or lossy conversion.
Requires Python 3.10+ and the private experiment repository / Seed-TTS metadata.
Example:
  python scripts/prepare_samples.py --project-root /path/to/experiments \
    --metadata /path/to/seedtts_testset/en/meta.lst --audit-dir /private/audit

The public output contains dataset identifiers but no local source paths.
"""
import argparse
import hashlib
import json
import shutil
import wave
from pathlib import Path


SALT = 'loop-f5-demo-20260922'
MODEL_DEFS = [
    ('baseline', 'Baseline', 'f5h200code', 157.965668, '18 × 1'),
    ('full2', 'Full ×2', 'elt9x2h200code', 83.557988, '9 × 2'),
    ('full3', 'Full ×3', 'elt6x3h200code', 58.755428, '6 × 3'),
    ('prefix', 'Prefix', 'prefixnosync', 108.360548, '6 × 2 + 6'),
    ('middle', 'Middle', 'midh200code', 108.360548, '3 + 6 × 2 + 3'),
    ('suffix', 'Suffix', 'suffixnosync', 108.360548, '6 + 6 × 2'),
]
STEPS = (4, 32)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2,
                               allow_nan=False) + '\n', encoding='utf-8')


def load_rows(path, key):
    # Evaluator logs may append a non-JSON aggregate score footer.
    rows = [json.loads(line) for line in path.read_text().splitlines()
            if line.lstrip().startswith('{')]
    output = {row[key]: row for row in rows}
    assert len(output) == len(rows), f'duplicate keys in {path}'
    return output


def wav_info(path, decode=False):
    with wave.open(str(path), 'rb') as wav:
        channels, width, rate, frames = (wav.getnchannels(), wav.getsampwidth(),
                                        wav.getframerate(), wav.getnframes())
        assert wav.getcomptype() == 'NONE', f'compressed WAV: {path}'
        assert channels == 1 and width == 2 and rate == 24000, str(path)
        assert frames > 0, f'empty audio: {path}'
        if decode:
            # Fully read the PCM payload, detecting truncated files.
            raw = wav.readframes(frames)
            assert len(raw) == frames * width * channels, f'truncated WAV: {path}'
    return dict(sample_rate=rate, channels=channels, frames=frames,
                duration_seconds=round(frames / rate, 6), format='PCM16 WAV')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project-root', type=Path, required=True)
    parser.add_argument('--metadata', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--audit-dir', type=Path, required=True,
                        help='Private directory outside the published demo.')
    args = parser.parse_args()
    root, meta, out, audit = (args.project_root.resolve(), args.metadata.resolve(),
                              args.output.resolve(), args.audit_dir.resolve())
    assert not audit.is_relative_to(out), 'private audit must be outside public output'

    candidates = []
    for line in meta.read_text().splitlines():
        source_id, prompt_text, prompt_path, text = line.split('|')
        assert source_id and text.strip() and prompt_text.strip()
        target = meta.parent / 'wavs' / f'{source_id}.wav'
        info = wav_info(target)
        candidates.append(dict(source_id=source_id, text=text.strip(),
                               prompt_text=prompt_text.strip(),
                               prompt_path=meta.parent / prompt_path,
                               target_path=target, target_duration=info['duration_seconds']))
    assert len(candidates) == 1088, f'unexpected metadata size: {len(candidates)}'
    # Define duration groups using NATURAL TARGET recordings, before opening metrics.
    # Ties are ordered by dataset ID. Two distinct prompt groups per tercile.
    candidates.sort(key=lambda row: (row['target_duration'], row['source_id']))
    groups, selected, used_prompts = [], [], set()
    for index, name in enumerate(('short', 'medium', 'long')):
        group = candidates[index * len(candidates) // 3:(index + 1) * len(candidates) // 3]
        ordered = sorted(group, key=lambda row: hashlib.sha256(
            f'{SALT}|{row["source_id"]}'.encode()).hexdigest())
        choices = []
        for row in ordered:
            if row['prompt_path'] in used_prompts:
                continue
            chosen = dict(row, length_group=name)
            choices.append(chosen)
            used_prompts.add(row['prompt_path'])
            if len(choices) == 2:
                break
        assert len(choices) == 2
        selected.extend(choices)
        groups.append(dict(name=name, population=len(group),
                           min_seconds=group[0]['target_duration'],
                           max_seconds=group[-1]['target_duration'], selected=2))

    # Freeze the six IDs before opening any model metric / output file.
    selected_ids = [row['source_id'] for row in selected]
    cells, source_files, vocoder_hashes = {}, [], set()
    for model, label, arch, params, layout in MODEL_DEFS:
        for steps in STEPS:
            directory = root / f'results/seeds_500k_20260916/seedtts/{arch}/u500000/s0/nfe{steps}'
            files = {name: directory / name for name in (
                'generated_manifest.jsonl', '_wer_results.jsonl',
                '_sim_fixed_results.jsonl', '_utmos_results.jsonl',
                'inference_protocol.json', 'checkpoint_load.json')}
            for name, path in files.items():
                assert path.is_file(), str(path)
                source_files.append(dict(path=str(path), sha256=digest(path)))
            protocol = json.loads(files['inference_protocol.json'].read_text())
            assert protocol['checkpoint_update'] == 500000
            assert protocol['weights'] == 'ema' and protocol['seed'] == 0
            assert protocol['sampler']['solver'] == 'euler'
            assert protocol['sampler']['steps'] == steps
            assert protocol['sampler']['cfg_strength'] == 2
            assert protocol['sampler']['sway_sampling_coef'] == -1
            assert protocol['metadata_sha256'] == digest(meta)
            assert protocol['inference_dtype'] == 'torch.float32'
            assert protocol['infer_batch_size'] == 1
            vocoder_hashes.add(protocol['vocoder_sha256'])
            cell = dict(
                manifest=load_rows(files['generated_manifest.jsonl'], 'utt'),
                wer=load_rows(files['_wer_results.jsonl'], 'wav'),
                sim=load_rows(files['_sim_fixed_results.jsonl'], 'wav'),
                utmos=load_rows(files['_utmos_results.jsonl'], 'wav'))
            for rows in cell.values():
                assert len(rows) == 1088
                assert all(source_id in rows for source_id in selected_ids)
            cells[(model, steps)] = cell
    assert len(vocoder_hashes) == 1, 'vocoder differs between conditions'

    assets, samples = [], []

    def copy_asset(source, relative):
        info = wav_info(source, decode=True)
        target = out / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        sha = digest(source)
        assert sha == digest(target)
        assets.append(dict(source_path=str(source), public_path=relative,
                           sha256=sha, bytes=target.stat().st_size, **info))
        return dict(src=relative, duration_seconds=info['duration_seconds'])

    for index, row in enumerate(selected, 1):
        sample_id = f'sample-{index:02d}'
        reference = copy_asset(row['prompt_path'], f'assets/audio/{sample_id}/reference.wav')
        reference['text'] = row['prompt_text']
        sample = dict(id=sample_id, source_id=row['source_id'], text=row['text'],
                      length_group=row['length_group'], reference=reference, outputs={})
        for steps in STEPS:
            outputs = {}
            for model, label, arch, params, layout in MODEL_DEFS:
                cell = cells[(model, steps)]
                source_id = row['source_id']
                assert cell['wer'][source_id]['truth'].strip() == row['text']
                manifest = cell['manifest'][source_id]
                assert manifest['seed'] == 0
                output = copy_asset(Path(manifest['wav']),
                                    f'assets/audio/{sample_id}/{model}-{steps}.wav')
                assert abs(output['duration_seconds'] - manifest['audio_seconds']) < 0.000001
                output.update(wer=100 * cell['wer'][source_id]['wer'],
                              sim=cell['sim'][source_id]['sim'],
                              utmos=cell['utmos'][source_id]['utmos'])
                outputs[model] = output
            sample['outputs'][str(steps)] = outputs
        samples.append(sample)

    selection = dict(
        method='Two utterances from each natural-target-duration tercile, ranked by '
               'SHA256(salt + "|" + dataset ID), with six distinct prompt recordings. '
               'Selected before reading model metrics; no output-quality filtering.',
        salt=SALT, count=6, population=1088, bins=groups)
    payload = dict(
        version=1, dataset='Seed-TTS test-en', selection=selection,
        protocol=dict(checkpoint_updates=500000, weights='EMA', seed=0,
                      solver='Euler', cfg=2, sway=-1, steps=list(STEPS),
                      sample_rate=24000, audio_processing='Unmodified evaluation WAVs.'),
        metric_units=dict(wer='percent; per-utterance automatic ASR WER',
                          sim='WavLM speaker-embedding cosine similarity',
                          utmos='Automatic quality prediction; not human MOS'),
        models=[dict(id=model, label=label, params_m=params, layout=layout)
                for model, label, arch, params, layout in MODEL_DEFS],
        samples=samples)
    write_json(out / 'data/samples.json', payload)
    write_json(out / 'data/audio-sha256.json', {
        item['public_path']: item['sha256'] for item in assets})
    write_json(audit / 'audio_provenance_private.json', dict(
        metadata=dict(path=str(meta), sha256=digest(meta)),
        selected=[{**row, 'prompt_path': str(row['prompt_path']),
                   'target_path': str(row['target_path'])} for row in selected],
        selection=selection, source_files=source_files, assets=assets))
    total = sum(row['bytes'] for row in assets)
    assert len(assets) == 78 and total < 35_000_000
    print(json.dumps(dict(samples=selected_ids, files=len(assets), bytes=total,
                          mebibytes=round(total / 1024**2, 2), selection=selection), indent=2))


if __name__ == '__main__':
    main()
