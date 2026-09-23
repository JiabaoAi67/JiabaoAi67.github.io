#!/usr/bin/env python3
"""Export the demo's public results from the paper's audited summaries.

This script requires the three audit JSON files in a local paper checkout;
the website itself only needs the generated data/results.json. Private source
paths and raw audit manifests are never included in the public export.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path


MODELS = [
    ("baseline", "f5h200code", "Baseline", "#59636f"),
    ("full2", "elt9x2h200code", "Full ×2", "#4878a8"),
    ("full3", "elt6x3h200code", "Full ×3", "#65864f"),
    ("prefix", "prefixnosync", "Prefix", "#15877f"),
    ("middle", "midh200code", "Middle", "#b98223"),
    ("suffix", "suffixnosync", "Suffix", "#d56655"),
]
DATASETS = ("seedtts", "lspc")
STEPS = (4, 8, 16, 32)
QUALITY_SEEDS = {"seedtts": [0, 1, 2, 666], "lspc": [0, 1, 2]}
CURVE_SEEDS = {"seedtts": 666, "lspc": 0}
AUDIT_FILES = {
    "main": "analysis/revision_20260922/data/main_data.json",
    "resources": "analysis/resources_20260922/resource_audit.json",
    "curves": "analysis/position_revision_20260922/curves/figure_data.json",
}


def finite(value: float) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("Non-finite audited value")
    return number


def build(inputs: dict) -> dict:
    main, resource, curve = (inputs[key] for key in ("main", "resources", "curves"))
    models = []
    quality = {dataset: {str(step): {} for step in (4, 32)} for dataset in DATASETS}
    curves = {"steps": list(STEPS), **{dataset: {} for dataset in DATASETS}}
    resources = {}

    assert curve["figure_steps"] == list(STEPS)
    for model_id, arch, label, color in MODELS:
        layout = main["layouts"][arch]
        inference = resource["inference"][arch]
        training = resource["training"][arch]
        assert layout["params"] == inference["parameter_count"] == training["parameter_count"]
        assert inference["block_calls_per_forward"] == 18
        infer_protocol = inference["protocol"]
        assert infer_protocol["checkpoint_update"] == 500000
        assert infer_protocol["weights"] == "ema"
        assert infer_protocol["sampler"]["steps"] == 32
        assert "H100" in infer_protocol["gpu"]
        models.append({
            "id": model_id,
            "label": label,
            "params_m": layout["params"] / 1_000_000,
            "unique_blocks": layout["unique"],
            "color": color,
        })

        for dataset in DATASETS:
            for step in (4, 32):
                cell = main["cells"][f"{arch}/{dataset}/nfe{step}"]
                assert sorted(cell["seeds"]) == QUALITY_SEEDS[dataset]
                assert cell["n_seeds"] == len(QUALITY_SEEDS[dataset])
                quality[dataset][str(step)][model_id] = {
                    metric: finite(cell["means"][metric]) for metric in ("wer", "sim", "utmos")
                }
            values = []
            for step in STEPS:
                cell = curve["cells"][f"{dataset}/{arch}/{step}"]
                assert cell["seed"] == CURVE_SEEDS[dataset]
                assert cell["steps"] == step
                assert cell["plotted"]
                values.append(finite(cell["quality"]["wer"]))
                if step in (4, 32):
                    main_seed = main["cells"][f"{arch}/{dataset}/nfe{step}"]["per_seed"][str(CURVE_SEEDS[dataset])]
                    for metric in ("wer", "sim", "utmos"):
                        assert math.isclose(cell["quality"][metric], main_seed["means"][metric], abs_tol=1e-10)
            curves[dataset][model_id] = values

        gpu_names = set(training["gpu"])
        assert len(gpu_names) == 1
        gpu = next(iter(gpu_names))
        short_gpu = "H100" if "H100" in gpu else "H200" if "H200" in gpu else gpu
        resources[model_id] = {
            "inference_mb": finite(inference["peak_allocated_MB"]),
            "rtf": finite(inference["all_utterances"]["aggregate_rtf"]),
            "training_allocated_gib": finite(training["peak_allocated_GiB_late"]),
            "training_reserved_gib": finite(training["peak_reserved_GiB_late"]),
            "training_gpu": short_gpu,
            "seconds_per_update": finite(training["median_seconds_per_update_late"]),
        }

    protocol = {
        "checkpoint_update": 500000,
        "weights": "EMA",
        "block_calls_per_network_evaluation": 18,
        "solver": "Euler",
        "cfg": 2,
        "sway": -1,
        "quality_seeds": {dataset: len(seeds) for dataset, seeds in QUALITY_SEEDS.items()},
        "quality_seed_values": QUALITY_SEEDS,
        "curve_seeds": CURVE_SEEDS,
        "utterances_per_seed": {"seedtts": 1088, "lspc": 1127},
        "wer": "Mean per-utterance word error rate, in percent; lower is better.",
        "sim": "SIM-o: WavLM-Large/ECAPA-TDNN speaker similarity; higher is better.",
        "utmos": "Predicted naturalness score; higher is better. This is not a human MOS.",
        "curves": "WER at a fixed inference seed across all steps. Curve endpoints therefore differ from the multi-seed quality table.",
        "inference": {
            "gpu": "H100",
            "precision": "FP32",
            "batch_size": 1,
            "steps": 32,
            "dataset": "Seed-TTS test-en",
            "seed": 666,
            "memory": "Peak allocated GPU memory in decimal MB; includes the resident vocoder and its allocations.",
            "rtf": "Total sampling time divided by total generated audio duration. Timing includes sampling and finite/prompt checks, and excludes vocoding, preprocessing, loading, and file I/O.",
            "timing_scope": "One recorded run per model; small timing differences are not a controlled speed ranking.",
        },
        "training": {
            "world_size": 8,
            "precision": "BF16 mixed precision; FP32 parameters, EMA, and Adam states",
            "updates": [400000, 500000],
            "memory": "Late-training records of rank-0 process cumulative peaks, in GiB; not the maximum over all ranks or a minimum GPU-capacity requirement.",
            "seconds_per_update": "Median over 1,000 logged windows, each covering 100 updates.",
            "hardware": "Baseline, Full ×2, Full ×3, and Middle used H100; Prefix and Suffix used H200.",
        },
        "scope": "One training run per layout. Equal 500k-update checkpoints are compared; the baseline's best earlier four-step checkpoint is not substituted. No current-stack human MOS has been completed.",
    }
    return {"models": models, "quality": quality, "curves": curves, "resources": resources, "protocol": protocol}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--paper-dir", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data/results.json")
    parser.add_argument("--audit-output", type=Path, help="Private manifest location; defaults to the paper analysis directory")
    parser.add_argument("--sequence-audit", type=Path, help="Optional raw SEQUENCE audit; defaults to the current paper audit if available")
    args = parser.parse_args()
    paths = {name: args.paper_dir / relative for name, relative in AUDIT_FILES.items()}
    inputs = {name: json.loads(path.read_text()) for name, path in paths.items()}
    result = build(inputs)
    sequence_path = args.sequence_audit or args.paper_dir / "analysis/demo_sequence_20260923/audit.json"
    if sequence_path.exists():
        sequence = json.loads(sequence_path.read_text())
        result["models"].insert(2, {"id": "sequence", "label": "SEQUENCE 9 × 2", "params_m": 83.557988, "unique_blocks": 9, "color": "#8064aa"})
        for model in result["models"]:
            if model["id"] == "full2": model["label"] = "CYCLE 9 × 2"
        for dataset, seeds in QUALITY_SEEDS.items():
            for step in (4, 32):
                cells = [sequence["cells"][f"{dataset}/{step}/{seed}"]["means"] for seed in seeds]
                result["quality"][dataset][str(step)]["sequence"] = {
                    metric: sum(cell[metric] for cell in cells) / len(cells) if all(cell[metric] is not None for cell in cells) else None
                    for metric in ("wer", "sim", "utmos")
                }
        resource_keys = ("inference_mb", "rtf", "training_allocated_gib", "training_reserved_gib", "training_gpu", "seconds_per_update")
        result["resources"]["sequence"] = {key: sequence["training"][key] for key in resource_keys}
        for resource in result["resources"].values(): resource["inference_reserved_mb"] = None
        result["protocol"]["training"]["hardware"] = "Baseline, CYCLE 9 × 2, SEQUENCE 9 × 2, Loop 6 × 3, and Middle used H100; Prefix and Suffix used H200."
        result["protocol"]["inference"]["reserved_memory"] = "Not recorded by the inference logger; no value is imputed."
        result["protocol"]["sequence"] = "SEQUENCE repeats adjacent blocks (1,1,2,2,...,9,9). It uses the same 83,557,988 parameters and 18 block calls as CYCLE (1,...,9,1,...,9). Null quality values mean the full multi-seed metric is not yet available. Its 4-step audio has been generated."
    serialized = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    for forbidden in ("/mnt/", "/home/", "/opt/", "source_manifest", "source_sha256"):
        assert forbidden not in serialized, f"Private audit detail in public export: {forbidden}"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(serialized)
    audit_path = args.audit_output or args.paper_dir / "analysis/demo_20260922/results_export_audit.json"
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    audit_path.write_text(json.dumps({
        "sources": {AUDIT_FILES[name]: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in paths.items()},
        "output_sha256": hashlib.sha256(serialized.encode()).hexdigest(),
        "quality_values": sum(value is not None for dataset in result["quality"].values() for cell in dataset.values() for model in cell.values() for value in model.values()),
        "curve_values": 48,
        "resource_values": 5 * len(result["models"]),
        "sequence_audit_sha256": hashlib.sha256(sequence_path.read_bytes()).hexdigest() if sequence_path.exists() else None,
        "checks": ["All source parameter counts agree", "Quality seed counts agree", "Fixed-seed curve endpoints agree with per-seed quality", "No private paths or source manifests in public export"],
    }, ensure_ascii=False, indent=2) + "\n")
    print(f"Exported {len(result['models'])} models; missing quality values remain null.")


if __name__ == "__main__":
    main()
