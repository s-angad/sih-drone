import pytest
from app.services.benchmark_runner import benchmark_runner

def test_benchmark_runner_single_trial():
    scenario = {
        "simulation_seed": 777,
        "noise_factor": 0.05,
        "sensor_drift_rate": 0.01,
        "hidden_faults": [
            {
                "fault_id": "FAULT-TEST",
                "fault_type": "pipe_gas_leak",
                "gas_type": "methane",
                "x": 10.0,
                "y": 6.5,
                "z": 1.5,
                "radius_meters": 2.5,
                "peak_intensity": 750.0,
                "severity": "critical"
            }
        ],
        "environment_layout": {
            "wind": {"speed_mps": 0.4, "direction_deg": 45.0}
        }
    }

    res_adaptive = benchmark_runner.run_strategy("skilldrone_adaptive", scenario, duration_ticks=60)
    assert res_adaptive["strategy"] == "skilldrone_adaptive"
    assert "total_score" in res_adaptive
    assert "mean_location_error_meters" in res_adaptive
    assert "inspection_coverage_pct" in res_adaptive
    assert res_adaptive["total_score"] > 0

def test_benchmark_comparative_summary():
    results = benchmark_runner.run_full_comparative_benchmark(seeds=[101, 202])
    summary = results["summary"]
    assert "random_walk" in summary
    assert "fixed_route" in summary
    assert "skilldrone_adaptive" in summary
    for strat in ("random_walk", "fixed_route", "skilldrone_adaptive"):
        assert summary[strat]["trials_count"] == 2
        assert summary[strat]["avg_score"] >= 0.0
