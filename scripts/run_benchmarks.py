#!/usr/bin/env python3
"""
SkillDrone V2 — Automated Comparative Benchmark Suite
Runs 15 comparative trials (5 seeds x 3 strategies):
- Random Walk Exploration
- Fixed-Route Non-Adaptive Patrol
- SkillDrone Adaptive Reinspection
Outputs performance metrics to console and exports JSON benchmark report.
"""

import sys
import os
import json
from pathlib import Path

# Set up module path
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
sys.path.insert(0, str(backend_dir))

from app.services.benchmark_runner import benchmark_runner

def main():
    print("=" * 80)
    print("SKILLDRONE V2 — SCIENTIFIC BENCHMARK & STRATEGY COMPARISON")
    print("=" * 80)
    print("Running comparative trials across 5 deterministic seeds...")

    results = benchmark_runner.run_full_comparative_benchmark(seeds=[101, 202, 303, 404, 505])
    summary = results["summary"]

    print("\n" + "-" * 80)
    print(f"{'STRATEGY':<25} | {'AVG SCORE':<10} | {'LOC ERROR':<12} | {'COVERAGE':<10} | {'PASS RATE':<10}")
    print("-" * 80)
    for strat, data in summary.items():
        print(f"{strat:<25} | {data['avg_score']:<10.1f} | {data['avg_location_error_m']:<10.2f}m | {data['avg_coverage_pct']:<9.1f}% | {data['pass_rate_pct']:<9.1f}%")
    print("-" * 80)

    # Export results to JSON
    output_path = root_dir / "benchmark_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\n[OK] Benchmark report exported successfully to: {output_path}")

if __name__ == "__main__":
    main()
