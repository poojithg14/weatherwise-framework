#!/usr/bin/env python3
"""
WeatherWise IEEE Access Paper -- GraphQL vs REST Benchmark
==========================================================

Simulates and compares the performance characteristics of GraphQL (single
federated query) versus traditional REST (multiple sequential requests) for
the WeatherWise real-time alerting use case.

Methodology:
    REST:  5 sequential HTTP requests with realistic latency distributions.
           Endpoints: alerts (120ms), storms (150ms), locations (100ms),
                      risk (80ms), routes (200ms).  Each with +/-20% variance.
    GraphQL: 1 single federated request (250ms +/-20% variance).

Each configuration is simulated 1000 times to obtain stable percentile
estimates.  Scalability is modeled under 100 / 500 / 1000 / 2000 concurrent
users using a simple M/M/1 queuing approximation for average response time.

Generates publication-quality figures for IEEE Access Section V-C.

Authors: WeatherWise Research Team
"""

from __future__ import annotations

import os
import textwrap
from dataclasses import dataclass, field
from typing import List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.ticker as mticker
import numpy as np

# ---------------------------------------------------------------------------
# Output directory
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIG_DIR = os.path.join(SCRIPT_DIR, "figures")
os.makedirs(FIG_DIR, exist_ok=True)

DPI = 300
SEED = 42

# ---------------------------------------------------------------------------
# IEEE-clean style defaults
# ---------------------------------------------------------------------------
plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
    "font.size": 10,
    "axes.titlesize": 12,
    "axes.labelsize": 10,
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "legend.fontsize": 9,
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "axes.edgecolor": "#333333",
    "axes.linewidth": 0.8,
    "axes.grid": False,
    "xtick.direction": "out",
    "ytick.direction": "out",
})

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
COLOR_REST    = "#90A4AE"   # blue-grey
COLOR_GRAPHQL = "#1565C0"   # dark blue
COLOR_REST_ACCENT = "#546E7A"
COLOR_GRAPHQL_ACCENT = "#0D47A1"

# ---------------------------------------------------------------------------
# REST endpoint definitions
# ---------------------------------------------------------------------------

@dataclass
class RestEndpoint:
    name: str
    base_latency_ms: float
    payload_bytes: int

REST_ENDPOINTS = [
    RestEndpoint("alerts",    120.0, 3200),
    RestEndpoint("storms",    150.0, 4100),
    RestEndpoint("locations", 100.0, 2800),
    RestEndpoint("risk",       80.0, 1900),
    RestEndpoint("routes",    200.0, 3500),
]

GRAPHQL_BASE_LATENCY_MS = 250.0
GRAPHQL_PAYLOAD_BYTES   = 4096
VARIANCE_FRACTION       = 0.20    # +/- 20%

N_SIMULATIONS = 1000
CONCURRENT_LEVELS = [100, 500, 1000, 2000]

# ---------------------------------------------------------------------------
# Simulation
# ---------------------------------------------------------------------------

@dataclass
class BenchmarkResult:
    label: str
    latencies_ms: np.ndarray
    total_payload_bytes: int

    @property
    def mean(self) -> float:
        return float(np.mean(self.latencies_ms))

    @property
    def p50(self) -> float:
        return float(np.percentile(self.latencies_ms, 50))

    @property
    def p95(self) -> float:
        return float(np.percentile(self.latencies_ms, 95))

    @property
    def p99(self) -> float:
        return float(np.percentile(self.latencies_ms, 99))

    @property
    def std(self) -> float:
        return float(np.std(self.latencies_ms))

    @property
    def payload_kb(self) -> float:
        return self.total_payload_bytes / 1024.0


def simulate_rest(rng: np.random.Generator, n: int) -> BenchmarkResult:
    """Simulate n REST request sequences (5 sequential calls each)."""
    total_latencies = np.zeros(n)
    total_payload = sum(ep.payload_bytes for ep in REST_ENDPOINTS)

    for ep in REST_ENDPOINTS:
        low  = ep.base_latency_ms * (1.0 - VARIANCE_FRACTION)
        high = ep.base_latency_ms * (1.0 + VARIANCE_FRACTION)
        total_latencies += rng.uniform(low, high, size=n)

    return BenchmarkResult("REST (5 calls)", total_latencies, total_payload)


def simulate_graphql(rng: np.random.Generator, n: int) -> BenchmarkResult:
    """Simulate n GraphQL single-request calls."""
    low  = GRAPHQL_BASE_LATENCY_MS * (1.0 - VARIANCE_FRACTION)
    high = GRAPHQL_BASE_LATENCY_MS * (1.0 + VARIANCE_FRACTION)
    latencies = rng.uniform(low, high, size=n)
    return BenchmarkResult("GraphQL (1 call)", latencies, GRAPHQL_PAYLOAD_BYTES)


def compute_scalability(rest: BenchmarkResult, graphql: BenchmarkResult,
                        concurrent_levels: List[int]
                        ) -> Tuple[List[float], List[float]]:
    """
    Model average response time under load using a simple M/M/1 queue
    approximation:
        W = S / (1 - rho)
    where S is the mean service time and rho = arrival_rate * S.

    We assume a server capacity of ~500 req/s for REST (limited by
    sequential calls) and ~2000 req/s for GraphQL (single fast call).
    """
    rest_base = rest.mean / 1000.0          # seconds
    gql_base  = graphql.mean / 1000.0       # seconds

    # Maximum throughput (requests per second the server can handle)
    rest_capacity = 500.0
    graphql_capacity = 2000.0

    rest_latencies = []
    graphql_latencies = []

    for users in concurrent_levels:
        # Approximate arrival rate = users * (1 / avg_think_time)
        # Assume 1 request per second per user
        arrival_rate = float(users)

        # REST
        rho_r = arrival_rate / rest_capacity
        if rho_r >= 1.0:
            rest_latencies.append(rest_base * 1000.0 * (1.0 + rho_r * 5.0))
        else:
            rest_latencies.append(rest_base / (1.0 - rho_r) * 1000.0)

        # GraphQL
        rho_g = arrival_rate / graphql_capacity
        if rho_g >= 1.0:
            graphql_latencies.append(gql_base * 1000.0 * (1.0 + rho_g * 5.0))
        else:
            graphql_latencies.append(gql_base / (1.0 - rho_g) * 1000.0)

    return rest_latencies, graphql_latencies


# ---------------------------------------------------------------------------
# Console output
# ---------------------------------------------------------------------------

def print_results(rest: BenchmarkResult, graphql: BenchmarkResult,
                  rest_scale: List[float], gql_scale: List[float]) -> None:
    sep = "=" * 72
    print(f"\n{sep}")
    print("  WeatherWise -- GraphQL vs REST Benchmark Results")
    print(f"  Simulations per configuration: {N_SIMULATIONS}")
    print(sep)

    print("\n  REST Configuration (5 sequential requests):")
    for ep in REST_ENDPOINTS:
        print(f"    {ep.name:<12s}  base={ep.base_latency_ms:>6.0f} ms  "
              f"payload={ep.payload_bytes:>5d} B")

    print(f"\n  GraphQL Configuration (1 federated request):")
    print(f"    single query   base={GRAPHQL_BASE_LATENCY_MS:>6.0f} ms  "
          f"payload={GRAPHQL_PAYLOAD_BYTES:>5d} B")

    print(f"\n  {'Metric':<28s} {'REST':>12s} {'GraphQL':>12s} {'Reduction':>12s}")
    print("  " + "-" * 66)

    def row(label: str, r: float, g: float, unit: str = "ms") -> None:
        reduction = (1.0 - g / r) * 100.0 if r > 0 else 0.0
        print(f"  {label:<28s} {r:>10.1f}{unit:>2s} {g:>10.1f}{unit:>2s} "
              f"{reduction:>10.1f}%")

    row("Average latency",   rest.mean,  graphql.mean)
    row("P50 latency",       rest.p50,   graphql.p50)
    row("P95 latency",       rest.p95,   graphql.p95)
    row("P99 latency",       rest.p99,   graphql.p99)
    row("Std deviation",     rest.std,   graphql.std)
    row("Payload size",      rest.payload_kb, graphql.payload_kb, "KB")

    print(f"\n  {'Concurrent Users':<20s} {'REST (ms)':>12s} {'GraphQL (ms)':>14s} "
          f"{'Reduction':>12s}")
    print("  " + "-" * 60)
    for i, users in enumerate(CONCURRENT_LEVELS):
        r_lat = rest_scale[i]
        g_lat = gql_scale[i]
        reduction = (1.0 - g_lat / r_lat) * 100.0 if r_lat > 0 else 0.0
        print(f"  {users:<20d} {r_lat:>12.1f} {g_lat:>14.1f} {reduction:>10.1f}%")

    # Summary for copy-paste into paper
    print(f"\n  === Paper-Ready Summary ===")
    print(f"  Average latency reduction: "
          f"{(1.0 - graphql.mean / rest.mean) * 100:.1f}%")
    print(f"  P95 latency reduction: "
          f"{(1.0 - graphql.p95 / rest.p95) * 100:.1f}%")
    print(f"  Payload reduction: "
          f"{(1.0 - graphql.payload_kb / rest.payload_kb) * 100:.1f}%")
    print(f"  REST avg:     {rest.mean:.1f} ms  |  GraphQL avg:     {graphql.mean:.1f} ms")
    print(f"  REST P95:     {rest.p95:.1f} ms  |  GraphQL P95:     {graphql.p95:.1f} ms")
    print(f"  REST P99:     {rest.p99:.1f} ms  |  GraphQL P99:     {graphql.p99:.1f} ms")
    print(f"  REST payload: {rest.payload_kb:.1f} KB |  GraphQL payload: {graphql.payload_kb:.1f} KB")
    print()


# ---------------------------------------------------------------------------
# Figure generators
# ---------------------------------------------------------------------------

def fig_latency_comparison(rest: BenchmarkResult, graphql: BenchmarkResult) -> None:
    """Bar chart: average + P95 latency for REST vs GraphQL."""
    fig, ax = plt.subplots(figsize=(7, 4.5))

    metrics = ["Average", "P95"]
    rest_vals = [rest.mean, rest.p95]
    gql_vals = [graphql.mean, graphql.p95]

    x = np.arange(len(metrics))
    width = 0.30

    bars_r = ax.bar(x - width / 2, rest_vals, width, label="REST (5 calls)",
                    color=COLOR_REST, edgecolor=COLOR_REST_ACCENT, linewidth=0.6)
    bars_g = ax.bar(x + width / 2, gql_vals, width, label="GraphQL (1 call)",
                    color=COLOR_GRAPHQL, edgecolor=COLOR_GRAPHQL_ACCENT, linewidth=0.6)

    # Value labels
    for bar in bars_r:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2, h + 8,
                f"{h:.0f} ms", ha="center", va="bottom", fontsize=9,
                color=COLOR_REST_ACCENT, fontweight="bold")
    for bar in bars_g:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2, h + 8,
                f"{h:.0f} ms", ha="center", va="bottom", fontsize=9,
                color=COLOR_GRAPHQL_ACCENT, fontweight="bold")

    # Reduction annotations
    for i in range(len(metrics)):
        reduction = (1.0 - gql_vals[i] / rest_vals[i]) * 100
        mid_x = x[i]
        mid_y = max(rest_vals[i], gql_vals[i]) + 40
        ax.annotate(f"\u2212{reduction:.0f}%", xy=(mid_x, mid_y),
                    ha="center", fontsize=10, fontweight="bold", color="#2E7D32")

    ax.set_ylabel("Latency (ms)")
    ax.set_title("WeatherWise API Latency: REST vs GraphQL")
    ax.set_xticks(x)
    ax.set_xticklabels(metrics)
    ax.legend(frameon=True, edgecolor="#CCCCCC")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_ylim(0, max(rest_vals) * 1.3)

    fig.tight_layout()
    path = os.path.join(FIG_DIR, "latency_comparison.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  Saved: {path}")


def fig_payload_comparison(rest: BenchmarkResult, graphql: BenchmarkResult) -> None:
    """Bar chart: payload size comparison."""
    fig, ax = plt.subplots(figsize=(5, 4))

    labels = ["REST\n(5 responses)", "GraphQL\n(1 response)"]
    sizes = [rest.payload_kb, graphql.payload_kb]
    colors = [COLOR_REST, COLOR_GRAPHQL]
    edge_colors = [COLOR_REST_ACCENT, COLOR_GRAPHQL_ACCENT]

    bars = ax.bar(labels, sizes, width=0.45, color=colors,
                  edgecolor=edge_colors, linewidth=0.6)

    for bar, sz in zip(bars, sizes):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3,
                f"{sz:.1f} KB", ha="center", va="bottom", fontsize=10,
                fontweight="bold")

    reduction = (1.0 - sizes[1] / sizes[0]) * 100
    ax.annotate(f"\u2212{reduction:.0f}%",
                xy=(0.5, max(sizes) * 0.75),
                xycoords=("axes fraction", "data"),
                ha="center", fontsize=14, fontweight="bold", color="#2E7D32")

    ax.set_ylabel("Payload Size (KB)")
    ax.set_title("WeatherWise Payload: REST vs GraphQL")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_ylim(0, max(sizes) * 1.25)

    fig.tight_layout()
    path = os.path.join(FIG_DIR, "payload_comparison.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  Saved: {path}")


def fig_scalability(rest_scale: List[float], gql_scale: List[float]) -> None:
    """Line chart: latency vs concurrent users."""
    fig, ax = plt.subplots(figsize=(7, 4.5))

    ax.plot(CONCURRENT_LEVELS, rest_scale, "o-", color=COLOR_REST,
            linewidth=2, markersize=7, label="REST (5 calls)",
            markeredgecolor=COLOR_REST_ACCENT, markeredgewidth=0.8)
    ax.plot(CONCURRENT_LEVELS, gql_scale, "s-", color=COLOR_GRAPHQL,
            linewidth=2, markersize=7, label="GraphQL (1 call)",
            markeredgecolor=COLOR_GRAPHQL_ACCENT, markeredgewidth=0.8)

    # Annotate values
    for i, users in enumerate(CONCURRENT_LEVELS):
        ax.annotate(f"{rest_scale[i]:.0f}",
                    xy=(users, rest_scale[i]),
                    xytext=(10, 8), textcoords="offset points",
                    fontsize=7, color=COLOR_REST_ACCENT)
        ax.annotate(f"{gql_scale[i]:.0f}",
                    xy=(users, gql_scale[i]),
                    xytext=(10, -12), textcoords="offset points",
                    fontsize=7, color=COLOR_GRAPHQL_ACCENT)

    ax.set_xlabel("Concurrent Users")
    ax.set_ylabel("Average Response Time (ms)")
    ax.set_title("WeatherWise Scalability: REST vs GraphQL Under Load")
    ax.legend(frameon=True, edgecolor="#CCCCCC")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    ax.set_xticks(CONCURRENT_LEVELS)
    ax.set_xticklabels([str(c) for c in CONCURRENT_LEVELS])

    fig.tight_layout()
    path = os.path.join(FIG_DIR, "scalability.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  Saved: {path}")


def fig_performance_table(rest: BenchmarkResult, graphql: BenchmarkResult,
                          rest_scale: List[float], gql_scale: List[float]) -> None:
    """Formatted table image of all benchmark results."""
    fig, ax = plt.subplots(figsize=(10, 5.5))
    ax.axis("off")

    # ---------- Latency section ----------
    col_labels = ["Metric", "REST (5 calls)", "GraphQL (1 call)", "Reduction"]

    reduction_lat_avg = f"{(1 - graphql.mean / rest.mean) * 100:.1f}%"
    reduction_lat_p50 = f"{(1 - graphql.p50 / rest.p50) * 100:.1f}%"
    reduction_lat_p95 = f"{(1 - graphql.p95 / rest.p95) * 100:.1f}%"
    reduction_lat_p99 = f"{(1 - graphql.p99 / rest.p99) * 100:.1f}%"
    reduction_payload = f"{(1 - graphql.payload_kb / rest.payload_kb) * 100:.1f}%"

    rows = [
        ["Average Latency",  f"{rest.mean:.1f} ms",  f"{graphql.mean:.1f} ms",  reduction_lat_avg],
        ["P50 Latency",      f"{rest.p50:.1f} ms",   f"{graphql.p50:.1f} ms",   reduction_lat_p50],
        ["P95 Latency",      f"{rest.p95:.1f} ms",   f"{graphql.p95:.1f} ms",   reduction_lat_p95],
        ["P99 Latency",      f"{rest.p99:.1f} ms",   f"{graphql.p99:.1f} ms",   reduction_lat_p99],
        ["Payload Size",     f"{rest.payload_kb:.1f} KB", f"{graphql.payload_kb:.1f} KB", reduction_payload],
        ["HTTP Requests",    "5",                     "1",                       "80.0%"],
    ]

    # Scalability rows
    for i, users in enumerate(CONCURRENT_LEVELS):
        r_ms = rest_scale[i]
        g_ms = gql_scale[i]
        red = f"{(1 - g_ms / r_ms) * 100:.1f}%"
        rows.append([
            f"Avg Latency @ {users} users",
            f"{r_ms:.0f} ms",
            f"{g_ms:.0f} ms",
            red,
        ])

    table = ax.table(
        cellText=rows,
        colLabels=col_labels,
        cellLoc="center",
        loc="center",
        colColours=["#E3F2FD"] * 4,
    )

    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1.0, 1.6)

    # Style header
    for j in range(len(col_labels)):
        cell = table[0, j]
        cell.set_text_props(fontweight="bold", color="#1A237E")
        cell.set_edgecolor("#90CAF9")
        cell.set_linewidth(0.5)

    # Style data cells
    for i in range(len(rows)):
        for j in range(len(col_labels)):
            cell = table[i + 1, j]
            cell.set_edgecolor("#E0E0E0")
            cell.set_linewidth(0.5)
            if i < 6:
                cell.set_facecolor("#FAFAFA")
            else:
                cell.set_facecolor("#F5F5F5")
            # Highlight reduction column in green
            if j == 3:
                cell.set_facecolor("#C8E6C9")

    ax.set_title("WeatherWise Performance Benchmark: GraphQL vs REST",
                 fontsize=12, pad=20)

    fig.tight_layout()
    path = os.path.join(FIG_DIR, "performance_table.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("\n" + "=" * 72)
    print("  WeatherWise -- GraphQL vs REST Benchmark")
    print("  IEEE Access Paper, Section V-C: Performance Evaluation")
    print("=" * 72)

    rng = np.random.default_rng(SEED)

    # ---- Run simulations ----
    print(f"\n  Simulating {N_SIMULATIONS} iterations ...")
    rest_result = simulate_rest(rng, N_SIMULATIONS)
    graphql_result = simulate_graphql(rng, N_SIMULATIONS)

    # ---- Compute scalability ----
    print("  Computing scalability model ...")
    rest_scale, gql_scale = compute_scalability(
        rest_result, graphql_result, CONCURRENT_LEVELS)

    # ---- Print results ----
    print_results(rest_result, graphql_result, rest_scale, gql_scale)

    # ---- Generate figures ----
    print("  Generating figures ...")
    fig_latency_comparison(rest_result, graphql_result)
    fig_payload_comparison(rest_result, graphql_result)
    fig_scalability(rest_scale, gql_scale)
    fig_performance_table(rest_result, graphql_result, rest_scale, gql_scale)

    print(f"\n  All figures saved to: {FIG_DIR}")
    print("  Benchmark complete.\n")


if __name__ == "__main__":
    main()
