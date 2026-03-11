#!/usr/bin/env python3
"""
WeatherWise -- Master Evaluation Runner
===========================================================
Runs all evaluation components in sequence and generates a combined
summary report.

Components:
  1. ML Model Training (pre-event features)
  2. Historical Event Simulation
  3. Paper Design Figures
  4. GraphQL Benchmark (real + simulated fallback)
  5. Live Weather Integration Test

Usage:
    python run_all.py              # Run all components
    python run_all.py --skip-ml    # Skip ML training (use existing model)
    python run_all.py --quick      # Quick mode (fewer iterations)

Authors: WeatherWise Research Team
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
ML_DIR = os.path.join(PROJECT_ROOT, "ml")
EVAL_DIR = SCRIPT_DIR
RESULTS_DIR = os.path.join(EVAL_DIR, "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

PYTHON = sys.executable


# ---------------------------------------------------------------------------
# Runner helpers
# ---------------------------------------------------------------------------

def run_script(script_path: str, label: str, cwd: str = None) -> dict:
    """Run a Python script and capture output/timing."""
    print(f"\n{'='*72}")
    print(f"  RUNNING: {label}")
    print(f"  Script:  {script_path}")
    print(f"{'='*72}\n")

    if not os.path.exists(script_path):
        print(f"  ERROR: Script not found: {script_path}")
        return {"status": "error", "error": "script not found",
                "duration_s": 0}

    start = time.time()
    try:
        result = subprocess.run(
            [PYTHON, script_path],
            cwd=cwd or os.path.dirname(script_path),
            capture_output=False,
            timeout=600,
        )
        duration = time.time() - start
        status = "success" if result.returncode == 0 else "failed"
        return {"status": status, "returncode": result.returncode,
                "duration_s": round(duration, 1)}
    except subprocess.TimeoutExpired:
        duration = time.time() - start
        print(f"  TIMEOUT after {duration:.0f}s")
        return {"status": "timeout", "duration_s": round(duration, 1)}
    except Exception as e:
        duration = time.time() - start
        print(f"  ERROR: {e}")
        return {"status": "error", "error": str(e),
                "duration_s": round(duration, 1)}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = sys.argv[1:]
    skip_ml = "--skip-ml" in args
    quick_mode = "--quick" in args

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    print("\n" + "=" * 72)
    print("  WeatherWise -- Master Evaluation Runner")
    print("  WeatherWise: Complete Evaluation Suite")
    print(f"  Timestamp: {timestamp}")
    if skip_ml:
        print("  Mode: --skip-ml (using existing model)")
    if quick_mode:
        print("  Mode: --quick (fewer iterations)")
    print("=" * 72)

    results = {}
    total_start = time.time()

    # Step 1: ML Model Training
    if not skip_ml:
        results["ml_training"] = run_script(
            os.path.join(ML_DIR, "train_model.py"),
            "Step 1/5: ML Model Training (Pre-Event Features)",
            cwd=ML_DIR,
        )
    else:
        print("\n  Skipping ML training (--skip-ml)")
        results["ml_training"] = {"status": "skipped"}

    # Step 2: Historical Simulation
    results["historical_sim"] = run_script(
        os.path.join(EVAL_DIR, "historical_simulation.py"),
        "Step 2/5: Historical Event Simulation",
    )

    # Step 3: Paper Design Figures
    results["paper_figures"] = run_script(
        os.path.join(EVAL_DIR, "generate_paper_figures.py"),
        "Step 3/5: Paper Design Figures (7 figures)",
    )

    # Step 4: GraphQL Benchmark
    results["graphql_benchmark"] = run_script(
        os.path.join(EVAL_DIR, "real_benchmark.py"),
        "Step 4/5: GraphQL Benchmark (Real + Simulated Fallback)",
    )

    # Step 5: Live Weather Test
    results["live_weather"] = run_script(
        os.path.join(EVAL_DIR, "live_weather_test.py"),
        "Step 5/5: Live NWS Weather Integration Test",
    )

    total_duration = time.time() - total_start

    # Summary
    sep = "=" * 72
    print(f"\n{sep}")
    print("  EVALUATION COMPLETE - SUMMARY")
    print(sep)
    print(f"\n  Timestamp: {timestamp}")
    print(f"  Total duration: {total_duration:.0f}s ({total_duration/60:.1f} min)\n")

    print(f"  {'Component':<40s} {'Status':<10s} {'Duration':>10s}")
    print("  " + "-" * 62)
    for name, result in results.items():
        status = result.get("status", "unknown")
        duration = result.get("duration_s", 0)
        status_icon = {
            "success": "PASS",
            "failed": "FAIL",
            "timeout": "TIMEOUT",
            "error": "ERROR",
            "skipped": "SKIP",
        }.get(status, "???")
        dur_str = f"{duration:.1f}s" if duration else "-"
        print(f"  {name:<40s} {status_icon:<10s} {dur_str:>10s}")

    # Collect all generated files
    print(f"\n  Generated Artifacts:")
    artifact_dirs = [
        os.path.join(ML_DIR, "figures"),
        os.path.join(ML_DIR, "models"),
        os.path.join(ML_DIR, "results"),
        os.path.join(EVAL_DIR, "figures"),
        os.path.join(EVAL_DIR, "results"),
    ]
    for d in artifact_dirs:
        if os.path.isdir(d):
            files = os.listdir(d)
            if files:
                print(f"    {d}:")
                for f in sorted(files)[:15]:
                    fpath = os.path.join(d, f)
                    size_kb = os.path.getsize(fpath) / 1024
                    print(f"      {f:<45s} {size_kb:>8.1f} KB")
                if len(files) > 15:
                    print(f"      ... and {len(files) - 15} more")

    # Save combined results
    combined = {
        "timestamp": timestamp,
        "total_duration_s": round(total_duration, 1),
        "components": results,
    }

    # Load sub-results if available
    sub_results = {
        "ml_results": os.path.join(ML_DIR, "results", "paper_results.json"),
        "historical": os.path.join(RESULTS_DIR, "historical_simulation.json"),
        "benchmark": os.path.join(RESULTS_DIR, "real_benchmark.json"),
        "live_weather": os.path.join(RESULTS_DIR, "live_weather_results.json"),
    }
    for key, path in sub_results.items():
        if os.path.exists(path):
            try:
                with open(path) as f:
                    combined[key] = json.load(f)
            except Exception:
                pass

    combined_path = os.path.join(RESULTS_DIR, "evaluation_complete.json")
    with open(combined_path, "w") as f:
        json.dump(combined, f, indent=2)
    print(f"\n  Combined results -> {combined_path}")

    # Final status
    all_ok = all(r.get("status") in ("success", "skipped")
                 for r in results.values())
    if all_ok:
        print(f"\n  All evaluations PASSED.")
    else:
        failed = [n for n, r in results.items()
                  if r.get("status") not in ("success", "skipped")]
        print(f"\n  WARNING: Some components had issues: {', '.join(failed)}")

    print(f"\n{sep}")
    print("  Evaluation runner complete.")
    print(sep + "\n")


if __name__ == "__main__":
    main()
