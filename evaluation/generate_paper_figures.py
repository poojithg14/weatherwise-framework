#!/usr/bin/env python3
"""
WeatherWise -- Design Figures Generator
==========================================================
Generates 7 design/diagram figures at 300 DPI.
These are conceptual/architectural figures, not data-driven plots.

Figures:
    1. system_architecture.png     - 4-layer block diagram
    2. risk_score_formula.png      - R = 0.25P + 0.30I + 0.20S + 0.15E + 0.10O
    3. alert_tiers.png             - 4 tier boxes (green/yellow/orange/red)
    4. decision_tree.png           - Risk scoring flowchart
    5. ml_pipeline.png             - NOAA -> remove post-event -> add radar -> train -> deploy
    6. london_ky_timeline.png      - T-45 to T-0 with +25 min advantage marker
    7. evaluation_methodology.png  - Measured vs estimated labels

Authors: WeatherWise Research Team
"""

from __future__ import annotations

import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import numpy as np

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIG_DIR = os.path.join(SCRIPT_DIR, "figures")
os.makedirs(FIG_DIR, exist_ok=True)

DPI = 300

# Clean style
plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
    "font.size": 10,
    "axes.titlesize": 12,
    "axes.labelsize": 10,
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "axes.grid": False,
})


# ---------------------------------------------------------------------------
# Helper: rounded box
# ---------------------------------------------------------------------------

def draw_box(ax, x, y, w, h, text, facecolor="#E3F2FD",
             edgecolor="#1565C0", fontsize=9, fontweight="normal",
             textcolor="#1A237E"):
    """Draw a rounded box with centered text."""
    box = FancyBboxPatch((x, y), w, h,
                         boxstyle="round,pad=0.1",
                         facecolor=facecolor, edgecolor=edgecolor,
                         linewidth=1.5)
    ax.add_patch(box)
    ax.text(x + w/2, y + h/2, text,
            ha="center", va="center", fontsize=fontsize,
            fontweight=fontweight, color=textcolor, wrap=True)


def draw_arrow(ax, x1, y1, x2, y2, color="#666666"):
    """Draw an arrow between two points."""
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="->", color=color, lw=1.5))


# ---------------------------------------------------------------------------
# Figure 1: System Architecture (4-layer block diagram)
# ---------------------------------------------------------------------------

def fig_system_architecture():
    fig, ax = plt.subplots(figsize=(12, 8))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8)
    ax.axis("off")

    # Title
    ax.text(6, 7.6, "WeatherWise System Architecture",
            ha="center", fontsize=14, fontweight="bold", color="#1A237E")

    # Layer 4 (top): Data Sources
    layer_y = 6.5
    ax.text(0.5, layer_y + 0.6, "Layer 1: Data Ingestion",
            fontsize=11, fontweight="bold", color="#0D47A1")
    sources = [("NOAA\nStorm Events", 0.5), ("NWS\nAlerts API", 3.0),
               ("Radar\nProxy", 5.5), ("NEXRAD\nSimulated", 8.0),
               ("EPA\nAir Quality", 10.5)]
    for label, x in sources:
        draw_box(ax, x, layer_y - 0.5, 2.0, 0.9, label,
                 facecolor="#E8EAF6", edgecolor="#3F51B5", fontsize=8)

    # Layer 3: Processing
    layer_y = 4.8
    ax.text(0.5, layer_y + 0.6, "Layer 2: ML Processing",
            fontsize=11, fontweight="bold", color="#0D47A1")
    proc = [("Feature\nEngineering\n(20 features)", 0.5),
            ("XGBoost\nClassifier\n(6 hazard types)", 3.5),
            ("Risk Scoring\nAlgorithm\n(5-factor weighted)", 7.0),
            ("Route\nOptimizer\n(Dijkstra)", 10.0)]
    for label, x in proc:
        draw_box(ax, x, layer_y - 0.5, 2.5, 1.0, label,
                 facecolor="#E8F5E9", edgecolor="#388E3C", fontsize=8)

    # Layer 2: API
    layer_y = 3.0
    ax.text(0.5, layer_y + 0.6, "Layer 3: GraphQL API (Spring Boot + DGS)",
            fontsize=11, fontweight="bold", color="#0D47A1")
    api = [("activeStormCells", 0.5), ("weatherAlerts", 2.8),
           ("travelerRiskScore", 5.1), ("safeRoute", 7.4),
           ("nearestSafe\nLocations", 9.7)]
    for label, x in api:
        draw_box(ax, x, layer_y - 0.4, 2.1, 0.8, label,
                 facecolor="#FFF3E0", edgecolor="#E65100", fontsize=7)

    # Layer 1 (bottom): Frontend
    layer_y = 1.2
    ax.text(0.5, layer_y + 0.6, "Layer 4: React Frontend",
            fontsize=11, fontweight="bold", color="#0D47A1")
    front = [("Interactive\nMap", 0.5), ("Risk\nGauge", 3.0),
             ("Alert\nBanner", 5.5), ("Route\nDisplay", 8.0),
             ("Scenario\nSelector", 10.5)]
    for label, x in front:
        draw_box(ax, x, layer_y - 0.4, 2.0, 0.8, label,
                 facecolor="#FCE4EC", edgecolor="#C62828", fontsize=8)

    # Arrows between layers
    for x in [1.5, 4.0, 6.5, 9.0, 11.0]:
        draw_arrow(ax, x, 5.9, x, 5.5)
    for x in [1.75, 4.75, 8.25, 11.0]:
        draw_arrow(ax, x, 4.25, x, 3.75)
    for x in [1.5, 3.85, 6.15, 8.45, 10.75]:
        draw_arrow(ax, x, 2.55, x, 2.1)

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "system_architecture.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Figure 2: Risk Score Formula
# ---------------------------------------------------------------------------

def fig_risk_score_formula():
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 5)
    ax.axis("off")

    ax.text(5, 4.5, "WeatherWise Composite Risk Score",
            ha="center", fontsize=14, fontweight="bold", color="#1A237E")

    # Main formula
    ax.text(5, 3.5,
            r"$R = 0.25 \cdot P + 0.30 \cdot I + 0.20 \cdot S + 0.15 \cdot E + 0.10 \cdot O$",
            ha="center", fontsize=16, fontweight="bold",
            color="#0D47A1",
            bbox=dict(facecolor="#E3F2FD", edgecolor="#1565C0",
                      boxstyle="round,pad=0.4", lw=2))

    # Factor descriptions
    factors = [
        ("P", "Proximity", "0.25", "Log-decay distance to hazard", "#E8F5E9"),
        ("I", "Intersection", "0.30", "Time-to-collision probability", "#E3F2FD"),
        ("S", "Severity", "0.20", "Hazard intensity coefficient", "#FFF3E0"),
        ("E", "Exposure", "0.15", "Duration in risk zone", "#FCE4EC"),
        ("O", "Escape Options", "0.10", "Inverse of nearby exit count", "#F3E5F5"),
    ]

    y = 2.5
    for sym, name, weight, desc, color in factors:
        draw_box(ax, 0.3, y - 0.3, 0.5, 0.5, sym,
                 facecolor=color, edgecolor="#333", fontsize=11,
                 fontweight="bold")
        ax.text(1.1, y, f"{name} (w={weight})",
                fontsize=10, fontweight="bold", va="center", color="#333")
        ax.text(4.0, y, desc,
                fontsize=9, va="center", color="#666")
        y -= 0.55

    # Score range
    ax.text(5, 0.2, "Score Range: 0.0 (no risk) to 1.0 (maximum risk)",
            ha="center", fontsize=9, fontstyle="italic", color="#888")

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "risk_score_formula.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Figure 3: Alert Tiers
# ---------------------------------------------------------------------------

def fig_alert_tiers():
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 4)
    ax.axis("off")

    ax.text(5, 3.6, "WeatherWise Alert Tier System",
            ha="center", fontsize=14, fontweight="bold", color="#1A237E")

    tiers = [
        ("MONITORING", "R < 0.25", "Normal driving\nconditions",
         "#4CAF50", "#E8F5E9", "#1B5E20"),
        ("ADVISORY", "0.25 \u2264 R < 0.50", "Hazard detected;\nproceed with caution",
         "#FFC107", "#FFF8E1", "#F57F17"),
        ("ACTION REQUIRED", "0.50 \u2264 R < 0.75", "Seek alternate route\nor shelter",
         "#FF9800", "#FFF3E0", "#E65100"),
        ("IMMEDIATE DANGER", "R \u2265 0.75", "Pull over NOW;\ntake shelter",
         "#F44336", "#FFEBEE", "#B71C1C"),
    ]

    x = 0.3
    for name, threshold, action, border_color, bg_color, text_color in tiers:
        box = FancyBboxPatch((x, 0.5), 2.2, 2.8,
                             boxstyle="round,pad=0.15",
                             facecolor=bg_color, edgecolor=border_color,
                             linewidth=3)
        ax.add_patch(box)

        ax.text(x + 1.1, 3.0, name,
                ha="center", fontsize=9, fontweight="bold", color=text_color)
        ax.text(x + 1.1, 2.4, threshold,
                ha="center", fontsize=10, fontweight="bold",
                color="#333",
                bbox=dict(facecolor="white", edgecolor=border_color,
                          boxstyle="round,pad=0.15", lw=1))
        ax.text(x + 1.1, 1.4, action,
                ha="center", fontsize=8, color="#555")

        if x < 7:
            draw_arrow(ax, x + 2.3, 1.9, x + 2.5, 1.9, color="#999")

        x += 2.4

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "alert_tiers.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Figure 4: Decision Tree / Flowchart
# ---------------------------------------------------------------------------

def fig_decision_tree():
    fig, ax = plt.subplots(figsize=(10, 8))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 8)
    ax.axis("off")

    ax.text(5, 7.6, "WeatherWise Risk Assessment Decision Flow",
            ha="center", fontsize=14, fontweight="bold", color="#1A237E")

    # Nodes
    draw_box(ax, 3.0, 6.5, 4.0, 0.8, "Receive Radar/NWS Data",
             facecolor="#E8EAF6", edgecolor="#3F51B5", fontsize=10,
             fontweight="bold")

    draw_box(ax, 3.0, 5.2, 4.0, 0.8, "ML Hazard Classification\n(XGBoost, 6 classes)",
             facecolor="#E8F5E9", edgecolor="#388E3C", fontsize=9)

    draw_box(ax, 3.0, 3.9, 4.0, 0.8, "Compute 5-Factor Risk Score\n(R = weighted sum)",
             facecolor="#FFF3E0", edgecolor="#E65100", fontsize=9)

    # Decision diamond
    diamond_x, diamond_y = 5.0, 2.8
    diamond = plt.Polygon(
        [(diamond_x, diamond_y + 0.5),
         (diamond_x + 1.2, diamond_y),
         (diamond_x, diamond_y - 0.5),
         (diamond_x - 1.2, diamond_y)],
        facecolor="#FFF9C4", edgecolor="#F9A825", lw=2)
    ax.add_patch(diamond)
    ax.text(diamond_x, diamond_y, "R \u2265 0.25?",
            ha="center", va="center", fontsize=9, fontweight="bold")

    # Outcomes
    draw_box(ax, 0.5, 1.5, 2.5, 0.7, "MONITORING\n(no action)",
             facecolor="#E8F5E9", edgecolor="#4CAF50", fontsize=9,
             fontweight="bold", textcolor="#1B5E20")

    draw_box(ax, 7.0, 1.5, 2.5, 0.7, "Generate Alert\n+ Reroute Options",
             facecolor="#FFEBEE", edgecolor="#F44336", fontsize=9,
             fontweight="bold", textcolor="#B71C1C")

    draw_box(ax, 7.0, 0.3, 2.5, 0.7, "Push to Traveler\nvia WebSocket",
             facecolor="#FCE4EC", edgecolor="#C62828", fontsize=9)

    # Arrows
    draw_arrow(ax, 5.0, 6.5, 5.0, 6.05)
    draw_arrow(ax, 5.0, 5.2, 5.0, 4.75)
    draw_arrow(ax, 5.0, 3.9, 5.0, 3.35)

    # No branch (left)
    ax.annotate("", xy=(1.75, 2.25), xytext=(3.8, 2.8),
                arrowprops=dict(arrowstyle="->", color="#4CAF50", lw=1.5))
    ax.text(2.3, 2.6, "No", fontsize=9, fontweight="bold", color="#4CAF50")

    # Yes branch (right)
    ax.annotate("", xy=(8.25, 2.25), xytext=(6.2, 2.8),
                arrowprops=dict(arrowstyle="->", color="#F44336", lw=1.5))
    ax.text(7.2, 2.6, "Yes", fontsize=9, fontweight="bold", color="#F44336")

    # Arrow from alert to push
    draw_arrow(ax, 8.25, 1.5, 8.25, 1.05)

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "decision_tree.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Figure 5: ML Pipeline
# ---------------------------------------------------------------------------

def fig_ml_pipeline():
    fig, ax = plt.subplots(figsize=(14, 4))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 4)
    ax.axis("off")

    ax.text(7, 3.6, "WeatherWise ML Training Pipeline",
            ha="center", fontsize=14, fontweight="bold", color="#1A237E")

    steps = [
        ("NOAA Storm\nEvents DB\n(315K records)", 0.2, "#E8EAF6", "#3F51B5"),
        ("Remove\nPost-Event\nFeatures", 2.6, "#FFEBEE", "#F44336"),
        ("Add Synthetic\nRadar-Proxy\nFeatures (7)", 5.0, "#FFF3E0", "#E65100"),
        ("Train Models\n(XGB, RF, LR)\n5-fold CV", 7.4, "#E8F5E9", "#388E3C"),
        ("Ablation\nStudy\n(9 groups)", 9.8, "#F3E5F5", "#7B1FA2"),
        ("Deploy\nBest Model\n(Flask API)", 12.2, "#E3F2FD", "#1565C0"),
    ]

    for label, x, bg, edge in steps:
        draw_box(ax, x, 1.0, 2.0, 2.0, label,
                 facecolor=bg, edgecolor=edge, fontsize=9, fontweight="bold")

    for i in range(len(steps) - 1):
        x1 = steps[i][1] + 2.0
        x2 = steps[i + 1][1]
        draw_arrow(ax, x1 + 0.05, 2.0, x2 - 0.05, 2.0, color="#666")

    # Feature counts annotation
    ax.text(1.2, 0.6, "51 columns", fontsize=7, ha="center",
            color="#666", fontstyle="italic")
    ax.text(3.6, 0.6, "Remove deaths,\ninjuries, damage,\ntor_scale",
            fontsize=7, ha="center", color="#F44336", fontstyle="italic")
    ax.text(6.0, 0.6, "CAPE, VIL, shear,\nrotation, echo_top,\npressure, dewpoint",
            fontsize=7, ha="center", color="#E65100", fontstyle="italic")
    ax.text(8.4, 0.6, "20 features\n6 hazard classes",
            fontsize=7, ha="center", color="#388E3C", fontstyle="italic")

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "ml_pipeline.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Figure 6: London KY Timeline
# ---------------------------------------------------------------------------

def fig_london_ky_timeline():
    fig, ax = plt.subplots(figsize=(12, 4))
    ax.set_xlim(-50, 5)
    ax.set_ylim(0, 4)
    ax.axis("off")

    ax.text(-22.5, 3.6, "London KY EF-4 Tornado: Alert Timeline (May 16, 2025)",
            ha="center", fontsize=14, fontweight="bold", color="#1A237E")

    # Timeline axis
    ax.plot([-48, 2], [2.0, 2.0], "k-", lw=2)

    # Tick marks
    ticks = [-45, -37, -30, -20, -12, -5, 0]
    for t in ticks:
        ax.plot([t, t], [1.85, 2.15], "k-", lw=1.5)
        ax.text(t, 1.6, f"T{t:+d}", ha="center", fontsize=8, color="#333")

    # T=0 impact marker
    ax.plot(0, 2.0, "rv", markersize=15, zorder=5)
    ax.text(0, 1.2, "IMPACT", ha="center", fontsize=9, fontweight="bold",
            color="#B71C1C")

    # WeatherWise alert at T-37
    ax.plot(-37, 2.0, "s", markersize=12, color="#1565C0", zorder=5)
    ax.text(-37, 2.6, "WeatherWise\nADVISORY",
            ha="center", fontsize=8, fontweight="bold", color="#1565C0")

    # NWS warning at T-12
    ax.plot(-12, 2.0, "o", markersize=12, color="#607D8B", zorder=5)
    ax.text(-12, 2.6, "NWS Tornado\nWarning",
            ha="center", fontsize=8, fontweight="bold", color="#607D8B")

    # Advantage annotation
    ax.annotate("", xy=(-37, 2.95), xytext=(-12, 2.95),
                arrowprops=dict(arrowstyle="<->", color="#FF6F00", lw=2))
    ax.text(-24.5, 3.15, "+25 min advantage",
            ha="center", fontsize=10, fontweight="bold", color="#FF6F00",
            bbox=dict(facecolor="#FFF3E0", edgecolor="#FF6F00",
                      boxstyle="round,pad=0.2", lw=1.5))

    # WeatherWise escalation markers
    ww_events = [
        (-37, "ADVISORY", "#FFC107"),
        (-25, "ACTION\nREQUIRED", "#FF9800"),
        (-10, "IMMEDIATE\nDANGER", "#F44336"),
    ]
    for t, label, color in ww_events:
        ax.plot(t, 2.0, "s", markersize=8, color=color, zorder=4)

    # Legend
    leg_items = [
        plt.Line2D([0], [0], marker="s", color="w", markerfacecolor="#1565C0",
                    markersize=8, label="WeatherWise Alert"),
        plt.Line2D([0], [0], marker="o", color="w", markerfacecolor="#607D8B",
                    markersize=8, label="NWS Warning"),
        plt.Line2D([0], [0], marker="v", color="w", markerfacecolor="red",
                    markersize=8, label="Impact"),
    ]
    ax.legend(handles=leg_items, loc="lower left", fontsize=8,
              frameon=True, edgecolor="#CCC")

    # Note
    ax.text(-22.5, 0.3,
            "Note: WeatherWise times are estimated from Monte Carlo "
            "simulation (mean=37 min, 95% CI: [28, 46])",
            ha="center", fontsize=7, color="#888", fontstyle="italic")

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "london_ky_timeline.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Figure 7: Evaluation Methodology
# ---------------------------------------------------------------------------

def fig_evaluation_methodology():
    fig, ax = plt.subplots(figsize=(10, 7))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 7)
    ax.axis("off")

    ax.text(5, 6.6, "WeatherWise Evaluation Methodology",
            ha="center", fontsize=14, fontweight="bold", color="#1A237E")

    # MEASURED section (green)
    y = 5.8
    draw_box(ax, 0.3, y, 4.2, 0.5, "MEASURED (Direct Observation)",
             facecolor="#C8E6C9", edgecolor="#2E7D32", fontsize=10,
             fontweight="bold", textcolor="#1B5E20")

    measured = [
        "ML Model Accuracy: Test-set precision/recall/F1",
        "GraphQL Latency: 1000 HTTP requests measured",
        "NWS Lead Times: Documented warning records",
        "Payload Size: Byte counts from real responses",
    ]
    y -= 0.15
    for item in measured:
        y -= 0.35
        ax.text(0.5, y, f"\u2713  {item}", fontsize=8, color="#333")

    # ESTIMATED section (orange)
    y -= 0.4
    draw_box(ax, 0.3, y, 4.2, 0.5, "ESTIMATED (Algorithm Simulation)",
             facecolor="#FFE0B2", edgecolor="#E65100", fontsize=10,
             fontweight="bold", textcolor="#E65100")

    estimated = [
        "WeatherWise Lead Times: Monte Carlo (n=1000)",
        "Tier Accuracy: Simulated distance scenarios",
        "Scalability: ThreadPoolExecutor concurrency test",
    ]
    y -= 0.15
    for item in estimated:
        y -= 0.35
        ax.text(0.5, y, f"\u25CB  {item}", fontsize=8, color="#333")

    # RIGHT SIDE: Validation approach
    draw_box(ax, 5.5, 5.8, 4.2, 0.5, "Validation Approach",
             facecolor="#E3F2FD", edgecolor="#1565C0", fontsize=10,
             fontweight="bold", textcolor="#0D47A1")

    validations = [
        "5-Fold Stratified Cross-Validation",
        "95% Confidence Intervals on all estimates",
        "Conservative parameter assumptions",
        "Methodology transparency disclosure",
        "Ablation study (9 feature groups)",
        "Comparison with 3 model architectures",
    ]
    vy = 5.65
    for item in validations:
        vy -= 0.35
        ax.text(5.7, vy, f"\u2022  {item}", fontsize=8, color="#333")

    # Bottom: key metrics box
    draw_box(ax, 0.3, 0.3, 9.4, 1.6, "",
             facecolor="#F5F5F5", edgecolor="#999")

    ax.text(5.0, 1.7, "Key Paper Metrics",
            ha="center", fontsize=11, fontweight="bold", color="#333")

    metrics = [
        ("ML Accuracy", "Weighted F1 from test set", 1.0),
        ("Avg Lead Time Advantage", "+25 min (estimated)", 4.0),
        ("Latency Reduction", "~63% (combined vs separate)", 7.5),
    ]
    for label, value, x in metrics:
        ax.text(x, 1.15, label, fontsize=9, fontweight="bold", color="#0D47A1")
        ax.text(x, 0.75, value, fontsize=9, color="#555")

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "evaluation_methodology.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("\n" + "=" * 72)
    print("  WeatherWise -- Paper Design Figures Generator")
    print("  WeatherWise: 7 Design Figures at 300 DPI")
    print("=" * 72)

    generators = [
        ("1/7", "System Architecture", fig_system_architecture),
        ("2/7", "Risk Score Formula", fig_risk_score_formula),
        ("3/7", "Alert Tiers", fig_alert_tiers),
        ("4/7", "Decision Tree", fig_decision_tree),
        ("5/7", "ML Pipeline", fig_ml_pipeline),
        ("6/7", "London KY Timeline", fig_london_ky_timeline),
        ("7/7", "Evaluation Methodology", fig_evaluation_methodology),
    ]

    for step, name, func in generators:
        print(f"\n  [{step}] {name}")
        func()

    print(f"\n  All 7 figures saved to: {FIG_DIR}")
    print("  Figure generation complete.\n")


if __name__ == "__main__":
    main()
