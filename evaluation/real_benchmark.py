#!/usr/bin/env python3
"""
WeatherWise Evaluation Suite -- Real GraphQL Benchmark
========================================================
Performs HTTP benchmarking against the WeatherWise backend GraphQL endpoint.
Uses ONLY the requests library (no aiohttp). Concurrency via ThreadPoolExecutor.

Requires the backend to be running at localhost:8080.

Endpoints tested:
    http://localhost:8080/graphql

Generates:
    evaluation/figures/real_latency_boxplot.png
    evaluation/figures/real_percentiles.png
    evaluation/figures/real_payload.png
    evaluation/figures/real_summary.png
    evaluation/results/real_benchmark.json

Authors: WeatherWise Research Team
"""

from __future__ import annotations

import json
import os
import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import List

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIG_DIR = os.path.join(SCRIPT_DIR, "figures")
RESULTS_DIR = os.path.join(SCRIPT_DIR, "results")
os.makedirs(FIG_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

DPI = 300
BACKEND_URL = "http://localhost:8080/graphql"

# ---------------------------------------------------------------------------
# GraphQL queries  (matching schema.graphqls exactly)
# ---------------------------------------------------------------------------
COMBINED_QUERY = """
query BenchmarkCombined($lat: Float!, $lon: Float!, $radiusMiles: Float!) {
  stormCells(lat: $lat, lon: $lon, radiusMiles: $radiusMiles) {
    id hazardType lat lon vil rotation
  }
  activeAlerts(lat: $lat, lon: $lon, radiusMiles: $radiusMiles) {
    id type severity polygon { lat lon } effectiveTime expirationTime
  }
  safeLocations(lat: $lat, lon: $lon, radiusMiles: $radiusMiles) {
    name locationType lat lon distanceMiles hasIndoorShelter exitNumber
  }
}
"""

STORM_QUERY = """
query StormCells($lat: Float!, $lon: Float!, $radiusMiles: Float!) {
  stormCells(lat: $lat, lon: $lon, radiusMiles: $radiusMiles) {
    id hazardType lat lon vil rotation velocityX velocityY
    predictedPath { time vertices { lat lon } }
  }
}
"""

ALERT_QUERY = """
query Alerts($lat: Float!, $lon: Float!, $radiusMiles: Float!) {
  activeAlerts(lat: $lat, lon: $lon, radiusMiles: $radiusMiles) {
    id type severity polygon { lat lon } effectiveTime expirationTime
  }
}
"""

SAFE_LOC_QUERY = """
query SafeLocations($lat: Float!, $lon: Float!, $radiusMiles: Float!) {
  safeLocations(lat: $lat, lon: $lon, radiusMiles: $radiusMiles) {
    name locationType lat lon distanceMiles hasIndoorShelter exitNumber
  }
}
"""

ROUTE_QUERY = """
query Route($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!) {
  alternateRoutes(fromLat: $fromLat, fromLon: $fromLon, toLat: $toLat, toLon: $toLon, avoidHazards: true) {
    waypoints { lat lon } distanceMiles estimatedMinutes safetyScore
  }
}
"""

RISK_QUERY = """
query Risk($lat: Float!, $lon: Float!, $heading: Float!, $speedMph: Float!) {
  travelerSafety(lat: $lat, lon: $lon, heading: $heading, speedMph: $speedMph) {
    overallScore tier timeToIntersectionMinutes recommendedAction
    hazardType alertMessage hazardSpecificGuidance
  }
}
"""

# Trip lifecycle mutations
START_TRIP_MUTATION = """
mutation StartTrip($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!) {
  startTrip(fromLat: $fromLat, fromLon: $fromLon, toLat: $toLat, toLon: $toLon) {
    sessionId route { lat lon } estimatedDistanceMiles estimatedTimeMinutes
  }
}
"""

UPDATE_POSITION_MUTATION = """
mutation UpdatePosition($sessionId: ID!, $lat: Float!, $lon: Float!, $heading: Float!, $speedMph: Float!) {
  updatePosition(sessionId: $sessionId, lat: $lat, lon: $lon, heading: $heading, speedMph: $speedMph) {
    overallScore tier recommendedAction alertMessage hazardType
  }
}
"""

END_TRIP_MUTATION = """
mutation EndTrip($sessionId: ID!) {
  endTrip(sessionId: $sessionId) {
    totalDistanceMiles totalTimeMinutes maxRiskScore alertsReceived actionsRecommended
  }
}
"""

VARIABLES_FULL = {"lat": 37.0708, "lon": -84.0858, "radiusMiles": 50.0}
VARIABLES_ROUTE = {
    "fromLat": 37.0708, "fromLon": -84.0858,
    "toLat": 37.20, "toLon": -84.20,
}
VARIABLES_RISK = {"lat": 37.0708, "lon": -84.0858, "heading": 180.0, "speedMph": 65.0}

SEPARATE_QUERIES = [
    (STORM_QUERY, VARIABLES_FULL),
    (ALERT_QUERY, VARIABLES_FULL),
    (SAFE_LOC_QUERY, VARIABLES_FULL),
    (ROUTE_QUERY, VARIABLES_ROUTE),
    (RISK_QUERY, VARIABLES_RISK),
]

# ---------------------------------------------------------------------------
# clean plot style
# ---------------------------------------------------------------------------
plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
    "font.size": 10,
    "axes.titlesize": 12,
    "axes.labelsize": 10,
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "axes.grid": False,
    "axes.spines.top": False,
    "axes.spines.right": False,
})

COLOR_COMBINED = "#1565C0"
COLOR_SEPARATE = "#90A4AE"


# ---------------------------------------------------------------------------
# Benchmark result data
# ---------------------------------------------------------------------------

@dataclass
class BenchmarkResult:
    label: str
    latencies_ms: List[float] = field(default_factory=list)
    errors: int = 0
    total_bytes: int = 0

    @property
    def count(self) -> int:
        return len(self.latencies_ms)

    @property
    def mean(self) -> float:
        return statistics.mean(self.latencies_ms) if self.latencies_ms else 0

    @property
    def median(self) -> float:
        return statistics.median(self.latencies_ms) if self.latencies_ms else 0

    @property
    def p95(self) -> float:
        return float(np.percentile(self.latencies_ms, 95)) if self.latencies_ms else 0

    @property
    def p99(self) -> float:
        return float(np.percentile(self.latencies_ms, 99)) if self.latencies_ms else 0

    @property
    def stdev(self) -> float:
        return statistics.stdev(self.latencies_ms) if len(self.latencies_ms) > 1 else 0

    @property
    def avg_payload_kb(self) -> float:
        return self.total_bytes / max(self.count, 1) / 1024


# ---------------------------------------------------------------------------
# HTTP helpers (requests only, no aiohttp)
# ---------------------------------------------------------------------------

def check_backend() -> bool:
    """Check if the backend is reachable at localhost:8080."""
    try:
        r = requests.post(BACKEND_URL,
                          json={"query": "{ __typename }"},
                          timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def discover_schema() -> dict | None:
    """Introspect the GraphQL schema."""
    introspection = """
    {
      __schema {
        queryType { name }
        types { name kind }
      }
    }
    """
    try:
        r = requests.post(BACKEND_URL,
                          json={"query": introspection},
                          timeout=10)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def run_single_combined(session: requests.Session) -> tuple:
    """Execute the combined query once. Returns (latency_ms, bytes, error)."""
    payload = {"query": COMBINED_QUERY, "variables": VARIABLES_FULL}
    start = time.perf_counter()
    try:
        resp = session.post(BACKEND_URL, json=payload, timeout=30)
        body = resp.content
        elapsed = (time.perf_counter() - start) * 1000
        return elapsed, len(body), resp.status_code != 200
    except Exception:
        elapsed = (time.perf_counter() - start) * 1000
        return elapsed, 0, True


def run_five_separate(session: requests.Session) -> tuple:
    """Execute 5 separate queries sequentially. Returns (total_ms, total_bytes, error)."""
    total_start = time.perf_counter()
    total_bytes = 0
    had_error = False
    for query, variables in SEPARATE_QUERIES:
        payload = {"query": query, "variables": variables}
        try:
            resp = session.post(BACKEND_URL, json=payload, timeout=30)
            total_bytes += len(resp.content)
            if resp.status_code != 200:
                had_error = True
        except Exception:
            had_error = True
    elapsed = (time.perf_counter() - total_start) * 1000
    return elapsed, total_bytes, had_error


def run_trip_lifecycle(session: requests.Session) -> tuple:
    """Benchmark startTrip -> 5x updatePosition -> endTrip. Returns (total_ms, bytes, error)."""
    total_start = time.perf_counter()
    total_bytes = 0
    had_error = False

    # startTrip
    payload = {"query": START_TRIP_MUTATION, "variables": VARIABLES_ROUTE}
    try:
        resp = session.post(BACKEND_URL, json=payload, timeout=30)
        total_bytes += len(resp.content)
        if resp.status_code != 200:
            had_error = True
            elapsed = (time.perf_counter() - total_start) * 1000
            return elapsed, total_bytes, True

        data = resp.json().get("data", {}).get("startTrip", {})
        session_id = data.get("sessionId")
        if not session_id:
            elapsed = (time.perf_counter() - total_start) * 1000
            return elapsed, total_bytes, True
    except Exception:
        elapsed = (time.perf_counter() - total_start) * 1000
        return elapsed, total_bytes, True

    # 5x updatePosition (simulate traveler moving south)
    for i in range(5):
        lat = 37.0708 + i * 0.02
        lon = -84.0858 - i * 0.01
        update_vars = {
            "sessionId": session_id,
            "lat": lat, "lon": lon,
            "heading": 180.0, "speedMph": 65.0,
        }
        payload = {"query": UPDATE_POSITION_MUTATION, "variables": update_vars}
        try:
            resp = session.post(BACKEND_URL, json=payload, timeout=30)
            total_bytes += len(resp.content)
            if resp.status_code != 200:
                had_error = True
        except Exception:
            had_error = True

    # endTrip
    payload = {"query": END_TRIP_MUTATION, "variables": {"sessionId": session_id}}
    try:
        resp = session.post(BACKEND_URL, json=payload, timeout=30)
        total_bytes += len(resp.content)
        if resp.status_code != 200:
            had_error = True
    except Exception:
        had_error = True

    elapsed = (time.perf_counter() - total_start) * 1000
    return elapsed, total_bytes, had_error


# ---------------------------------------------------------------------------
# Benchmark runners
# ---------------------------------------------------------------------------

def benchmark_sequential(n_iterations: int) -> tuple:
    """Run combined and separate benchmarks sequentially."""
    combined = BenchmarkResult(label="GraphQL Combined")
    separate = BenchmarkResult(label="5 Separate Queries")

    session = requests.Session()

    print(f"    Combined query x {n_iterations} ...")
    for _ in range(n_iterations):
        ms, nbytes, err = run_single_combined(session)
        combined.latencies_ms.append(ms)
        combined.total_bytes += nbytes
        if err:
            combined.errors += 1

    print(f"    5 separate queries x {n_iterations} ...")
    for _ in range(n_iterations):
        ms, nbytes, err = run_five_separate(session)
        separate.latencies_ms.append(ms)
        separate.total_bytes += nbytes
        if err:
            separate.errors += 1

    session.close()
    return combined, separate


def benchmark_concurrent(n_iterations: int, concurrency: int) -> tuple:
    """Run benchmark with ThreadPoolExecutor at given concurrency."""
    combined = BenchmarkResult(label=f"Combined (c={concurrency})")
    separate = BenchmarkResult(label=f"Separate (c={concurrency})")

    session = requests.Session()

    # Combined query concurrency test
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(run_single_combined, session)
                   for _ in range(n_iterations)]
        for f in as_completed(futures):
            ms, nbytes, err = f.result()
            combined.latencies_ms.append(ms)
            combined.total_bytes += nbytes
            if err:
                combined.errors += 1

    # Separate queries concurrency test
    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        futures = [pool.submit(run_five_separate, session)
                   for _ in range(n_iterations)]
        for f in as_completed(futures):
            ms, nbytes, err = f.result()
            separate.latencies_ms.append(ms)
            separate.total_bytes += nbytes
            if err:
                separate.errors += 1

    session.close()
    return combined, separate


def benchmark_trip_lifecycle(n_iterations: int) -> BenchmarkResult:
    """Benchmark the trip lifecycle: startTrip -> updatePosition -> endTrip."""
    result = BenchmarkResult(label="Trip Lifecycle")
    session = requests.Session()

    print(f"    Trip lifecycle (start+5xUpdate+end) x {n_iterations} ...")
    for _ in range(n_iterations):
        ms, nbytes, err = run_trip_lifecycle(session)
        result.latencies_ms.append(ms)
        result.total_bytes += nbytes
        if err:
            result.errors += 1

    session.close()
    return result


# ---------------------------------------------------------------------------
# Figure generators
# ---------------------------------------------------------------------------

def fig_latency_boxplot(combined: BenchmarkResult,
                        separate: BenchmarkResult,
                        lifecycle: BenchmarkResult | None = None) -> None:
    """Box plot comparing combined vs separate query latencies."""
    fig, ax = plt.subplots(figsize=(8, 5))

    data = [combined.latencies_ms, separate.latencies_ms]
    labels = ["Combined\nGraphQL Query", "5 Separate\nQueries"]
    colors = [COLOR_COMBINED, COLOR_SEPARATE]

    if lifecycle and lifecycle.latencies_ms:
        data.append(lifecycle.latencies_ms)
        labels.append("Trip\nLifecycle")
        colors.append("#FF7043")

    bp = ax.boxplot(data, labels=labels, patch_artist=True,
                    widths=0.45, showmeans=True, meanline=True)

    for patch, color in zip(bp["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.8)

    ax.set_ylabel("Latency (ms)")
    ax.set_title(f"WeatherWise - GraphQL Latency Distribution\n"
                 f"({combined.count} iterations per strategy)")

    # Annotate means
    results_list = [combined, separate]
    if lifecycle and lifecycle.latencies_ms:
        results_list.append(lifecycle)
    for i, r in enumerate(results_list, 1):
        ax.text(i, r.mean + 2, f"mean={r.mean:.1f}ms",
                ha="center", fontsize=8, fontweight="bold",
                color="#333")

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "real_latency_boxplot.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


def fig_percentiles(combined: BenchmarkResult,
                    separate: BenchmarkResult) -> None:
    """Bar chart of latency percentiles."""
    fig, ax = plt.subplots(figsize=(8, 5))

    metrics = ["Mean", "Median", "P95", "P99"]
    c_vals = [combined.mean, combined.median, combined.p95, combined.p99]
    s_vals = [separate.mean, separate.median, separate.p95, separate.p99]

    x = np.arange(len(metrics))
    w = 0.32

    bars1 = ax.bar(x - w/2, c_vals, w, label="Combined Query",
                   color=COLOR_COMBINED, edgecolor="white")
    bars2 = ax.bar(x + w/2, s_vals, w, label="5 Separate Queries",
                   color=COLOR_SEPARATE, edgecolor="white")

    for bar in bars1:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, h + 1,
                f"{h:.0f}", ha="center", fontsize=8, fontweight="bold",
                color="#0D47A1")
    for bar in bars2:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, h + 1,
                f"{h:.0f}", ha="center", fontsize=8, fontweight="bold",
                color="#546E7A")

    ax.set_xticks(x)
    ax.set_xticklabels(metrics)
    ax.set_ylabel("Latency (ms)")
    ax.set_title("WeatherWise - Latency Percentile Comparison")
    ax.legend()

    reduction = (1 - combined.mean / separate.mean) * 100 if separate.mean else 0
    ax.text(0.98, 0.95, f"Mean latency reduction: {reduction:.0f}%",
            transform=ax.transAxes, ha="right", va="top",
            fontsize=9, fontweight="bold", color="#0D47A1",
            bbox=dict(facecolor="#E3F2FD", edgecolor="#90CAF9",
                      boxstyle="round,pad=0.3"))

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "real_percentiles.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


def fig_payload(combined: BenchmarkResult,
                separate: BenchmarkResult) -> None:
    """Payload size comparison."""
    fig, ax = plt.subplots(figsize=(6, 5))

    c_kb = combined.avg_payload_kb
    s_kb = separate.avg_payload_kb

    bars = ax.bar(["Combined\nGraphQL", "5 Separate\nQueries"],
                  [c_kb, s_kb],
                  color=[COLOR_COMBINED, COLOR_SEPARATE],
                  width=0.45, edgecolor="white")

    for bar in bars:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, h + 0.1,
                f"{h:.1f} KB", ha="center", fontsize=10, fontweight="bold")

    reduction = (1 - c_kb / s_kb) * 100 if s_kb else 0
    ax.set_ylabel("Average Payload Size (KB)")
    ax.set_title(f"WeatherWise - Payload Comparison\n"
                 f"({reduction:.0f}% reduction with combined query)")

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "real_payload.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


def fig_summary(combined: BenchmarkResult, separate: BenchmarkResult,
                concurrency_results: dict,
                lifecycle: BenchmarkResult | None = None) -> None:
    """Multi-panel summary figure."""
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))

    # Panel 1: Box plot
    ax1 = axes[0]
    bp = ax1.boxplot([combined.latencies_ms, separate.latencies_ms],
                     labels=["Combined", "5 Separate"],
                     patch_artist=True, widths=0.45,
                     showmeans=True, meanline=True)
    for patch, color in zip(bp["boxes"], [COLOR_COMBINED, COLOR_SEPARATE]):
        patch.set_facecolor(color)
        patch.set_alpha(0.8)
    ax1.set_ylabel("Latency (ms)")
    ax1.set_title("Distribution")

    # Panel 2: Percentiles
    ax2 = axes[1]
    metrics = ["Mean", "P50", "P95", "P99"]
    c_vals = [combined.mean, combined.median, combined.p95, combined.p99]
    s_vals = [separate.mean, separate.median, separate.p95, separate.p99]
    x = np.arange(4)
    w = 0.32
    ax2.bar(x - w/2, c_vals, w, color=COLOR_COMBINED, label="Combined")
    ax2.bar(x + w/2, s_vals, w, color=COLOR_SEPARATE, label="Separate")
    ax2.set_xticks(x)
    ax2.set_xticklabels(metrics)
    ax2.set_ylabel("Latency (ms)")
    ax2.set_title("Percentiles")
    ax2.legend(fontsize=8)

    # Panel 3: Concurrency scaling
    ax3 = axes[2]
    if concurrency_results:
        levels = sorted(concurrency_results.keys())
        c_means = [concurrency_results[c]["combined"].mean for c in levels]
        s_means = [concurrency_results[c]["separate"].mean for c in levels]
        ax3.plot(levels, c_means, "s-", color=COLOR_COMBINED, lw=2,
                 markersize=8, label="Combined")
        ax3.plot(levels, s_means, "o-", color=COLOR_SEPARATE, lw=2,
                 markersize=8, label="Separate")
        ax3.set_xlabel("Concurrent Connections")
        ax3.set_ylabel("Avg Latency (ms)")
        ax3.set_title("Concurrency Scaling")
        ax3.legend(fontsize=8)
    else:
        ax3.text(0.5, 0.5, "No concurrency data", ha="center", va="center",
                 transform=ax3.transAxes, fontsize=10, color="#999")
        ax3.set_title("Concurrency Scaling")

    fig.suptitle("WeatherWise - GraphQL Benchmark Summary",
                 fontsize=13, fontweight="bold")
    plt.tight_layout()
    path = os.path.join(FIG_DIR, "real_summary.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("\n" + "=" * 72)
    print("  WeatherWise -- GraphQL Benchmark")
    print("  Evaluation Report,Section V-C: Performance Evaluation")
    print("=" * 72)

    # Check backend
    print(f"\n  Checking backend at {BACKEND_URL} ...")
    backend_ok = check_backend()

    if not backend_ok:
        print("  ERROR: Backend is not running.")
        print("  Start it: cd backend && bash mvnw spring-boot:run")
        print("  Or: docker compose up -d")
        return

    print("  Backend is running.")

    # Schema discovery
    schema = discover_schema()
    if schema:
        types = schema.get("data", {}).get("__schema", {}).get("types", [])
        print(f"  Schema discovered: {len(types)} types")

    # Warmup
    print("\n  Warming up (50 requests) ...")
    session = requests.Session()
    for _ in range(50):
        run_single_combined(session)
    session.close()

    # Main benchmark: 1000 iterations
    n = 1000
    print(f"\n  Running main benchmark ({n} iterations) ...")
    combined, separate = benchmark_sequential(n)

    # Trip lifecycle benchmark
    lifecycle = benchmark_trip_lifecycle(100)

    # Concurrency test: 10, 50, 100
    concurrency_results = {}
    for c in [10, 50, 100]:
        n_c = 200
        print(f"  Concurrency={c}: {n_c} iterations ...")
        c_comb, c_sep = benchmark_concurrent(n_c, c)
        concurrency_results[c] = {"combined": c_comb, "separate": c_sep}

    # Print results
    sep = "=" * 72
    print(f"\n{sep}")
    print("  BENCHMARK RESULTS")
    print(sep)

    reduction = ((1 - combined.mean / separate.mean) * 100
                 if separate.mean > 0 else 0)
    c_kb = combined.avg_payload_kb
    s_kb = separate.avg_payload_kb

    print(f"\n  {'Metric':<25s} {'Combined':>12s} {'Separate':>12s} {'Reduction':>12s}")
    print("  " + "-" * 63)
    print(f"  {'Iterations':<25s} {combined.count:>12d} {separate.count:>12d}")
    print(f"  {'Errors':<25s} {combined.errors:>12d} {separate.errors:>12d}")
    print(f"  {'Mean latency (ms)':<25s} {combined.mean:>12.1f} {separate.mean:>12.1f} {reduction:>10.1f}%")
    print(f"  {'Median latency (ms)':<25s} {combined.median:>12.1f} {separate.median:>12.1f}")
    print(f"  {'P95 latency (ms)':<25s} {combined.p95:>12.1f} {separate.p95:>12.1f}")
    print(f"  {'P99 latency (ms)':<25s} {combined.p99:>12.1f} {separate.p99:>12.1f}")
    print(f"  {'Std deviation (ms)':<25s} {combined.stdev:>12.1f} {separate.stdev:>12.1f}")
    print(f"  {'Avg payload (KB)':<25s} {c_kb:>12.1f} {s_kb:>12.1f}")

    if lifecycle.latencies_ms:
        print(f"\n  Trip Lifecycle (startTrip + 5x updatePosition + endTrip):")
        print(f"    Iterations: {lifecycle.count}")
        print(f"    Errors:     {lifecycle.errors}")
        print(f"    Mean:       {lifecycle.mean:.1f} ms")
        print(f"    P95:        {lifecycle.p95:.1f} ms")
        print(f"    P99:        {lifecycle.p99:.1f} ms")
        print(f"    Avg payload:{lifecycle.avg_payload_kb:.1f} KB")

    if concurrency_results:
        print(f"\n  Concurrency Scaling:")
        for c in sorted(concurrency_results.keys()):
            cr = concurrency_results[c]
            print(f"    c={c:>3d}: combined={cr['combined'].mean:.1f}ms  "
                  f"separate={cr['separate'].mean:.1f}ms")

    # Generate figures
    print("\n  Generating figures ...")
    fig_latency_boxplot(combined, separate, lifecycle)
    fig_percentiles(combined, separate)
    fig_payload(combined, separate)
    fig_summary(combined, separate, concurrency_results, lifecycle)

    # Save JSON results
    json_results = {
        "simulated": False,
        "combined_query": {
            "iterations": combined.count,
            "errors": combined.errors,
            "mean_ms": round(combined.mean, 2),
            "median_ms": round(combined.median, 2),
            "p95_ms": round(combined.p95, 2),
            "p99_ms": round(combined.p99, 2),
            "stdev_ms": round(combined.stdev, 2),
            "avg_payload_kb": round(c_kb, 2),
        },
        "separate_queries": {
            "iterations": separate.count,
            "errors": separate.errors,
            "mean_ms": round(separate.mean, 2),
            "median_ms": round(separate.median, 2),
            "p95_ms": round(separate.p95, 2),
            "p99_ms": round(separate.p99, 2),
            "stdev_ms": round(separate.stdev, 2),
            "avg_payload_kb": round(s_kb, 2),
        },
        "trip_lifecycle": {
            "iterations": lifecycle.count,
            "errors": lifecycle.errors,
            "mean_ms": round(lifecycle.mean, 2),
            "p95_ms": round(lifecycle.p95, 2),
            "p99_ms": round(lifecycle.p99, 2),
            "avg_payload_kb": round(lifecycle.avg_payload_kb, 2),
        },
        "latency_reduction_pct": round(reduction, 1),
        "concurrency": {
            str(c): {
                "combined_mean_ms": round(cr["combined"].mean, 2),
                "separate_mean_ms": round(cr["separate"].mean, 2),
            }
            for c, cr in concurrency_results.items()
        },
    }
    json_path = os.path.join(RESULTS_DIR, "real_benchmark.json")
    with open(json_path, "w") as f:
        json.dump(json_results, f, indent=2)
    print(f"  Results -> {json_path}")

    print(f"\n  All figures saved to: {FIG_DIR}")
    print("  Benchmark complete.\n")


if __name__ == "__main__":
    main()
