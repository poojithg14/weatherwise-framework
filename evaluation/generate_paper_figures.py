#!/usr/bin/env python3
"""
WeatherWise Evaluation Suite -- Additional Publication Figures
================================================================

Generates system-architecture, risk-score formula, alert-tier, and
decision-tree diagrams for the WeatherWise paper.  All figures use
print-appropriate styling: white background, Arial font, 300 DPI,
clean borders, no gridlines.

Authors: WeatherWise Research Team
"""

from __future__ import annotations

import os
from typing import List, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.patches as FancyBboxPatch_mod
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as patheffects
import numpy as np

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FIG_DIR = os.path.join(SCRIPT_DIR, "figures")
os.makedirs(FIG_DIR, exist_ok=True)
DPI = 300

# ---------------------------------------------------------------------------
# clean style
# ---------------------------------------------------------------------------
plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
    "font.size": 10,
    "axes.titlesize": 12,
    "axes.labelsize": 10,
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "axes.edgecolor": "#333333",
    "axes.linewidth": 0.8,
    "axes.grid": False,
})

# ---------------------------------------------------------------------------
# Color palette for architecture layers
# ---------------------------------------------------------------------------
BLUE    = "#1565C0"     # data sources
BLUE_LT = "#BBDEFB"
GREEN   = "#2E7D32"     # GraphQL
GREEN_LT = "#C8E6C9"
ORANGE  = "#E65100"     # AI engine
ORANGE_LT = "#FFE0B2"
RED     = "#C62828"     # alerts
RED_LT  = "#FFCDD2"
GREY    = "#455A64"
GREY_LT = "#ECEFF1"

# ===========================================================================
# FIGURE 1: System Architecture
# ===========================================================================

def _draw_box(ax, cx: float, cy: float, w: float, h: float,
              text: str, facecolor: str, edgecolor: str,
              fontsize: float = 9, bold: bool = False,
              text_color: str = "#FFFFFF") -> None:
    """Draw a rounded-rectangle box centered at (cx, cy)."""
    box = FancyBboxPatch(
        (cx - w / 2, cy - h / 2), w, h,
        boxstyle="round,pad=0.02",
        facecolor=facecolor, edgecolor=edgecolor, linewidth=1.2,
        zorder=2,
    )
    ax.add_patch(box)
    weight = "bold" if bold else "normal"
    ax.text(cx, cy, text, ha="center", va="center",
            fontsize=fontsize, fontweight=weight, color=text_color,
            zorder=3)


def _draw_arrow(ax, x1: float, y1: float, x2: float, y2: float,
                color: str = "#666666", style: str = "->") -> None:
    """Draw an arrow from (x1,y1) to (x2,y2)."""
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color,
                                linewidth=1.5, shrinkA=2, shrinkB=2),
                zorder=1)


def fig_system_architecture() -> None:
    """4-layer architecture: Data Ingestion -> GraphQL Fusion -> AI Engine -> Alert & Rerouting."""
    fig, ax = plt.subplots(figsize=(10, 7))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 8)
    ax.axis("off")

    # ---- Layer 1: Data Sources (bottom) ----
    layer1_y = 1.2
    sources = [
        ("NWS\nAlerts API", 1.5),
        ("NEXRAD\nRadar", 3.5),
        ("EPA\nAirNow", 5.5),
        ("USGS\nStream\nGauges", 7.5),
        ("Satellite\nImagery", 9.0),
    ]
    # Layer background
    layer_bg = FancyBboxPatch(
        (0.3, layer1_y - 0.55), 9.4, 1.1,
        boxstyle="round,pad=0.05", facecolor=BLUE_LT, edgecolor=BLUE,
        linewidth=0.8, alpha=0.3, zorder=0)
    ax.add_patch(layer_bg)
    ax.text(0.15, layer1_y, "Data\nIngestion", ha="center", va="center",
            fontsize=8, fontweight="bold", color=BLUE, rotation=90)

    for label, cx in sources:
        _draw_box(ax, cx, layer1_y, 1.4, 0.85, label,
                  facecolor=BLUE, edgecolor="#0D47A1",
                  fontsize=7.5, text_color="white")

    # ---- Layer 2: GraphQL Fusion ----
    layer2_y = 3.0
    gql_boxes = [
        ("Schema\nStitching", 2.0),
        ("Federation\nGateway", 5.0),
        ("WebSocket\nSubscriptions", 8.0),
    ]
    layer_bg2 = FancyBboxPatch(
        (0.3, layer2_y - 0.55), 9.4, 1.1,
        boxstyle="round,pad=0.05", facecolor=GREEN_LT, edgecolor=GREEN,
        linewidth=0.8, alpha=0.3, zorder=0)
    ax.add_patch(layer_bg2)
    ax.text(0.15, layer2_y, "GraphQL\nFusion", ha="center", va="center",
            fontsize=8, fontweight="bold", color=GREEN, rotation=90)

    for label, cx in gql_boxes:
        _draw_box(ax, cx, layer2_y, 1.8, 0.85, label,
                  facecolor=GREEN, edgecolor="#1B5E20",
                  fontsize=8, text_color="white")

    # Arrows layer 1 -> layer 2
    for _, sx in sources:
        # Find nearest gql box
        nearest = min(gql_boxes, key=lambda b: abs(b[1] - sx))
        _draw_arrow(ax, sx, layer1_y + 0.45, nearest[1], layer2_y - 0.45,
                    color=BLUE)

    # ---- Layer 3: AI Engine ----
    layer3_y = 4.8
    ai_boxes = [
        ("Geometric\nIntersection", 1.8),
        ("Risk Scorer\n(5-component)", 4.2),
        ("Path\nProjection", 6.6),
        ("Safe Route\nOptimizer", 9.0),
    ]
    layer_bg3 = FancyBboxPatch(
        (0.3, layer3_y - 0.55), 9.4, 1.1,
        boxstyle="round,pad=0.05", facecolor=ORANGE_LT, edgecolor=ORANGE,
        linewidth=0.8, alpha=0.3, zorder=0)
    ax.add_patch(layer_bg3)
    ax.text(0.15, layer3_y, "AI\nEngine", ha="center", va="center",
            fontsize=8, fontweight="bold", color=ORANGE, rotation=90)

    for label, cx in ai_boxes:
        _draw_box(ax, cx, layer3_y, 1.7, 0.85, label,
                  facecolor=ORANGE, edgecolor="#BF360C",
                  fontsize=8, text_color="white")

    # Arrows layer 2 -> layer 3
    for _, sx in gql_boxes:
        nearest = min(ai_boxes, key=lambda b: abs(b[1] - sx))
        _draw_arrow(ax, sx, layer2_y + 0.45, nearest[1], layer3_y - 0.45,
                    color=GREEN)

    # ---- Layer 4: Alert & Rerouting ----
    layer4_y = 6.6
    alert_boxes = [
        ("ADVISORY\nTier", 2.0),
        ("ACTION\nREQUIRED Tier", 5.0),
        ("IMMEDIATE\nDANGER Tier", 8.0),
    ]
    alert_colors = ["#1976D2", "#F57C00", "#D32F2F"]
    layer_bg4 = FancyBboxPatch(
        (0.3, layer4_y - 0.55), 9.4, 1.1,
        boxstyle="round,pad=0.05", facecolor=RED_LT, edgecolor=RED,
        linewidth=0.8, alpha=0.3, zorder=0)
    ax.add_patch(layer_bg4)
    ax.text(0.15, layer4_y, "Alert &\nRerouting", ha="center", va="center",
            fontsize=8, fontweight="bold", color=RED, rotation=90)

    for (label, cx), color in zip(alert_boxes, alert_colors):
        _draw_box(ax, cx, layer4_y, 1.8, 0.85, label,
                  facecolor=color, edgecolor="#B71C1C",
                  fontsize=8, bold=True, text_color="white")

    # Arrows layer 3 -> layer 4
    for _, sx in ai_boxes:
        nearest = min(alert_boxes, key=lambda b: abs(b[1] - sx))
        _draw_arrow(ax, sx, layer3_y + 0.45, nearest[1], layer4_y - 0.45,
                    color=ORANGE)

    ax.set_title("WeatherWise System Architecture", fontsize=14,
                 fontweight="bold", pad=15)

    fig.tight_layout()
    path = os.path.join(FIG_DIR, "system_architecture.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  Saved: {path}")


# ===========================================================================
# FIGURE 2: Risk Score Formula
# ===========================================================================

def fig_risk_score_formula() -> None:
    """Visualization of the 5-component weighted-sum risk formula."""
    fig, ax = plt.subplots(figsize=(10, 5.5))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis("off")

    # Title
    ax.text(5.0, 5.5, "WeatherWise Composite Risk Score Formula",
            ha="center", va="center", fontsize=14, fontweight="bold")

    # Main formula
    formula = (r"$R \;=\; w_1 \cdot \mathrm{PROXIMITY}"
               r"\;+\; w_2 \cdot \mathrm{INTERSECTION}"
               r"\;+\; w_3 \cdot \mathrm{SEVERITY}"
               r"\;+\; w_4 \cdot \mathrm{EXPOSURE}"
               r"\;+\; w_5 \cdot \mathrm{ESCAPE}$")
    ax.text(5.0, 4.7, formula, ha="center", va="center", fontsize=11)

    # Component detail boxes
    components = [
        ("PROXIMITY",    "w = 0.25", BLUE,   "Logarithmic decay\nof distance to hazard",
         r"$\max(0,\; 1 - \frac{\log_{10}(d+1)}{\log_{10}(51)})$"),
        ("INTERSECTION", "w = 0.30", GREEN,  "Forward path projection\nat 5-min intervals",
         "1.0 if t\u226415, linear\ndecay to 0.0 at t=60"),
        ("SEVERITY",     "w = 0.20", ORANGE, "Hazard-type coefficient\n(TORNADO=1.0, etc.)",
         r"$c_{hazard}$"),
        ("EXPOSURE",     "w = 0.15", "#7B1FA2", "Minutes inside corridor\nnormalized by 30 min",
         r"$\min(1.0,\; \frac{t_{inside}}{30})$"),
        ("ESCAPE",       "w = 0.10", RED,    "Inverse of nearby\nsafe-exit availability",
         r"$f(exits_{5mi}, exits_{10mi})$"),
    ]

    box_w = 1.65
    box_h = 1.8
    start_x = 0.5
    spacing = 1.85

    for i, (name, weight, color, desc, formula_str) in enumerate(components):
        cx = start_x + i * spacing + box_w / 2

        # Colored header bar
        header = FancyBboxPatch(
            (cx - box_w / 2, 3.65), box_w, 0.45,
            boxstyle="round,pad=0.02",
            facecolor=color, edgecolor=color, linewidth=1.0, zorder=2)
        ax.add_patch(header)
        ax.text(cx, 3.87, name, ha="center", va="center",
                fontsize=7, fontweight="bold", color="white", zorder=3)

        # Weight badge
        ax.text(cx, 3.35, weight, ha="center", va="center",
                fontsize=9, fontweight="bold", color=color,
                bbox=dict(boxstyle="round,pad=0.2", facecolor="white",
                          edgecolor=color, linewidth=0.8))

        # Description
        ax.text(cx, 2.65, desc, ha="center", va="center",
                fontsize=7, color="#424242")

        # Formula
        ax.text(cx, 1.85, formula_str, ha="center", va="center",
                fontsize=8, color="#333333")

        # Surrounding box
        outer = FancyBboxPatch(
            (cx - box_w / 2, 1.3), box_w, box_h,
            boxstyle="round,pad=0.03",
            facecolor="#FAFAFA", edgecolor=color, linewidth=0.8,
            alpha=0.5, zorder=0)
        ax.add_patch(outer)

    # Tier mapping at bottom
    ax.text(5.0, 0.65, "Alert Tier Mapping:", ha="center", va="center",
            fontsize=10, fontweight="bold", color="#333333")
    tier_text = (r"$R < 0.30 \rightarrow$ ADVISORY"
                 r"     |     "
                 r"$0.30 \leq R < 0.70 \rightarrow$ ACTION REQUIRED"
                 r"     |     "
                 r"$R \geq 0.70 \rightarrow$ IMMEDIATE DANGER")
    ax.text(5.0, 0.25, tier_text, ha="center", va="center", fontsize=9,
            color="#555555")

    fig.tight_layout()
    path = os.path.join(FIG_DIR, "risk_score_formula.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  Saved: {path}")


# ===========================================================================
# FIGURE 3: Alert Tiers
# ===========================================================================

def fig_alert_tiers() -> None:
    """Visual of 3 alert tiers with colors, thresholds, descriptions."""
    fig, ax = plt.subplots(figsize=(9, 5))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 7)
    ax.axis("off")

    ax.text(5.0, 6.6, "WeatherWise Alert Tier System",
            ha="center", va="center", fontsize=14, fontweight="bold")

    tiers = [
        {
            "name": "ADVISORY",
            "threshold": "R < 0.30",
            "color": "#1976D2",
            "light": "#BBDEFB",
            "icon_text": "i",
            "action": "CONTINUE MONITORING",
            "description": (
                "Severe weather developing in the area but not yet\n"
                "expected to impact traveler's route.  System continues\n"
                "monitoring and will escalate if conditions change."
            ),
            "guidance": "No action needed. Stay informed.",
        },
        {
            "name": "ACTION REQUIRED",
            "threshold": "0.30 <= R < 0.70",
            "color": "#F57C00",
            "light": "#FFE0B2",
            "icon_text": "!",
            "action": "REROUTE / EXIT TO SHELTER / PULL OVER",
            "description": (
                "Hazard is likely to intersect traveler's path within\n"
                "the projection window.  System recommends evasive action:\n"
                "reroute, exit to shelter, or reduce speed and prepare."
            ),
            "guidance": "Take evasive action now.",
        },
        {
            "name": "IMMEDIATE DANGER",
            "threshold": "R >= 0.70",
            "color": "#D32F2F",
            "light": "#FFCDD2",
            "icon_text": "!!",
            "action": "EXIT NOW / SHELTER IN VEHICLE",
            "description": (
                "Life-threatening hazard is imminent or actively impacting\n"
                "the traveler's position.  Immediate protective action\n"
                "required.  Audio + haptic alerts activated."
            ),
            "guidance": "Immediate protective action required.",
        },
    ]

    y_start = 5.5
    row_h = 1.7
    left_margin = 0.6

    for i, tier in enumerate(tiers):
        y = y_start - i * row_h

        # Background row
        bg = FancyBboxPatch(
            (left_margin, y - 0.65), 8.8, 1.3,
            boxstyle="round,pad=0.04",
            facecolor=tier["light"], edgecolor=tier["color"],
            linewidth=1.2, zorder=0)
        ax.add_patch(bg)

        # Icon circle
        circle = plt.Circle((1.3, y), 0.35, facecolor=tier["color"],
                             edgecolor="white", linewidth=2, zorder=2)
        ax.add_patch(circle)
        ax.text(1.3, y, tier["icon_text"], ha="center", va="center",
                fontsize=14, fontweight="bold", color="white", zorder=3)

        # Tier name and threshold
        ax.text(2.1, y + 0.35, tier["name"], ha="left", va="center",
                fontsize=11, fontweight="bold", color=tier["color"])
        ax.text(2.1, y + 0.05, f'Threshold: {tier["threshold"]}',
                ha="left", va="center", fontsize=8, color="#666666",
                fontstyle="italic")

        # Recommended action
        ax.text(2.1, y - 0.25, f'Action: {tier["action"]}',
                ha="left", va="center", fontsize=8, fontweight="bold",
                color="#333333")

        # Description
        ax.text(5.5, y + 0.1, tier["description"],
                ha="left", va="center", fontsize=7.5, color="#424242",
                linespacing=1.4)

    # Gradient bar at bottom
    gradient_y = 0.3
    gradient = np.linspace(0, 1, 256).reshape(1, -1)
    from matplotlib.colors import LinearSegmentedColormap
    cmap = LinearSegmentedColormap.from_list(
        "risk", ["#1976D2", "#F57C00", "#D32F2F"])
    ax.imshow(gradient, aspect="auto", cmap=cmap,
              extent=[1.0, 9.0, gradient_y - 0.12, gradient_y + 0.12],
              zorder=1)

    ax.text(1.0, gradient_y - 0.3, "0.0", ha="center", fontsize=8, color="#666666")
    ax.text(3.4, gradient_y - 0.3, "0.30", ha="center", fontsize=8, color="#666666")
    ax.text(6.6, gradient_y - 0.3, "0.70", ha="center", fontsize=8, color="#666666")
    ax.text(9.0, gradient_y - 0.3, "1.0", ha="center", fontsize=8, color="#666666")

    # Threshold markers
    for xval in [3.4, 6.6]:
        ax.plot([xval, xval], [gradient_y - 0.15, gradient_y + 0.15],
                color="white", linewidth=2, zorder=2)

    ax.text(5.0, gradient_y + 0.35, "Composite Risk Score (R)",
            ha="center", va="center", fontsize=9, color="#333333")

    fig.tight_layout()
    path = os.path.join(FIG_DIR, "alert_tiers.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  Saved: {path}")


# ===========================================================================
# FIGURE 4: Decision Tree / Flowchart
# ===========================================================================

def fig_decision_tree() -> None:
    """Flowchart of decision logic: hazard detection -> alert -> action."""
    fig, ax = plt.subplots(figsize=(11, 9))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 10)
    ax.axis("off")

    ax.text(5.5, 9.6, "WeatherWise Decision Logic Flowchart",
            ha="center", va="center", fontsize=14, fontweight="bold")

    # ---- Helper: draw a process box ----
    def proc_box(cx, cy, w, h, text, color, fc=None, fs=8):
        if fc is None:
            fc = color
        box = FancyBboxPatch(
            (cx - w / 2, cy - h / 2), w, h,
            boxstyle="round,pad=0.03",
            facecolor=fc, edgecolor=color, linewidth=1.2, zorder=2)
        ax.add_patch(box)
        ax.text(cx, cy, text, ha="center", va="center",
                fontsize=fs, fontweight="bold", color="white"
                if fc == color else color, zorder=3, linespacing=1.3)

    # ---- Helper: draw a diamond (decision) ----
    def diamond(cx, cy, w, h, text, color):
        verts = [
            (cx, cy + h / 2),
            (cx + w / 2, cy),
            (cx, cy - h / 2),
            (cx - w / 2, cy),
            (cx, cy + h / 2),
        ]
        from matplotlib.patches import Polygon
        poly = Polygon(verts, closed=True, facecolor="#FFFDE7",
                       edgecolor=color, linewidth=1.2, zorder=2)
        ax.add_patch(poly)
        ax.text(cx, cy, text, ha="center", va="center",
                fontsize=7.5, fontweight="bold", color=color, zorder=3,
                linespacing=1.2)

    # ---- Helper: arrow ----
    def arrow(x1, y1, x2, y2, color="#666666", label="", label_side="right"):
        _draw_arrow(ax, x1, y1, x2, y2, color=color)
        if label:
            mx = (x1 + x2) / 2
            my = (y1 + y2) / 2
            offset = 0.15 if label_side == "right" else -0.15
            ax.text(mx + offset, my, label, ha="left" if label_side == "right" else "right",
                    va="center", fontsize=7, color=color, fontstyle="italic")

    # ============ FLOW ============

    # Step 1: Data ingestion
    proc_box(5.5, 9.0, 3.2, 0.6, "Ingest Real-Time Weather Data\n(NWS, Radar, AirNow, USGS)",
             BLUE, fs=8)

    arrow(5.5, 8.7, 5.5, 8.2, color=BLUE)

    # Step 2: Hazard detection
    diamond(5.5, 7.7, 3.0, 0.9, "Active hazard\ndetected?", BLUE)

    # No branch
    arrow(7.0, 7.7, 9.5, 7.7, color=GREY, label="No")
    proc_box(9.5, 7.7, 1.6, 0.5, "Continue\nMonitoring",
             GREY, fc=GREY_LT, fs=7)

    # Yes branch
    arrow(5.5, 7.25, 5.5, 6.65, color=BLUE, label="Yes", label_side="right")

    # Step 3: Compute risk
    proc_box(5.5, 6.3, 3.5, 0.6, "Compute 5-Component Risk Score\n"
             "R = w1*PROX + w2*INTER + w3*SEV + w4*EXP + w5*ESC",
             GREEN, fs=7)

    arrow(5.5, 6.0, 5.5, 5.4, color=GREEN)

    # Step 4: Tier decision
    diamond(5.5, 4.95, 2.6, 0.8, "R >= 0.70?", "#D32F2F")

    # Yes -> IMMEDIATE DANGER
    arrow(6.8, 4.95, 9.2, 4.95, color="#D32F2F", label="Yes")
    proc_box(9.5, 4.95, 1.8, 0.55, "IMMEDIATE\nDANGER", "#D32F2F", fs=8)

    # No
    arrow(5.5, 4.55, 5.5, 3.95, color="#F57C00", label="No", label_side="right")

    # Step 5: Action tier decision
    diamond(5.5, 3.5, 2.6, 0.8, "R >= 0.30?", "#F57C00")

    # Yes -> ACTION REQUIRED
    arrow(6.8, 3.5, 9.2, 3.5, color="#F57C00", label="Yes")
    proc_box(9.5, 3.5, 1.8, 0.55, "ACTION\nREQUIRED", "#F57C00", fs=8)

    # No -> ADVISORY
    arrow(5.5, 3.1, 5.5, 2.45, color="#1976D2", label="No", label_side="right")
    proc_box(5.5, 2.15, 1.8, 0.55, "ADVISORY", "#1976D2", fs=8)

    # ---- Action sub-decisions (from IMMEDIATE DANGER) ----
    arrow(9.5, 4.40, 9.5, 3.95, color="#D32F2F")
    diamond(9.5, 3.5, 2.0, 0.7, "Exit within\n2 mi?", "#D32F2F")
    # Yes
    proc_box(9.5, 2.45, 1.6, 0.5, "EXIT TO\nSHELTER", "#D32F2F", fc=RED_LT, fs=7)
    arrow(9.5, 3.15, 9.5, 2.70, color="#D32F2F", label="Yes", label_side="right")
    # No
    proc_box(7.8, 2.45, 1.8, 0.5, "SHELTER IN\nVEHICLE", "#D32F2F", fc=RED_LT, fs=7)
    arrow(8.5, 3.5, 7.9, 2.90, color="#D32F2F", label="No", label_side="left")

    # ---- Action sub-decisions (from ACTION REQUIRED) ----
    # Connect from the R>=0.30 "Yes" branch to a sub-decision at x=2.0
    arrow(4.2, 3.5, 2.5, 2.8, color="#F57C00", label="", label_side="left")
    diamond(2.0, 2.35, 2.2, 0.7, "Safe route\nclear?", "#F57C00")

    # Yes -> REROUTE
    proc_box(2.0, 1.30, 1.4, 0.5, "REROUTE", "#F57C00", fc=ORANGE_LT, fs=7)
    arrow(2.0, 2.00, 2.0, 1.55, color="#F57C00", label="Yes", label_side="right")

    # No -> check nearby shelter
    proc_box(0.8, 1.30, 1.4, 0.5, "EXIT TO\nSHELTER", "#F57C00", fc=ORANGE_LT, fs=7)
    arrow(0.9, 2.35, 0.8, 1.55, color="#F57C00", label="No", label_side="left")

    proc_box(3.2, 1.30, 1.4, 0.5, "PULL\nOVER", "#F57C00", fc=ORANGE_LT, fs=7)
    arrow(3.1, 2.35, 3.2, 1.55, color="#F57C00", label="No exits", label_side="right")

    # ---- Feedback loop ----
    # From ADVISORY back down to device push
    arrow(5.5, 1.88, 5.5, 1.15, color="#1976D2")
    proc_box(5.5, 0.75, 2.8, 0.55,
             "Push to Traveler Device\n(Visual + Audio + Haptic)", GREY, fs=7)

    # Re-evaluation label
    ax.annotate("", xy=(0.5, 9.0), xytext=(0.5, 0.75),
                arrowprops=dict(arrowstyle="->", color="#BDBDBD",
                                linewidth=1.0, linestyle="dashed",
                                connectionstyle="arc3,rad=0.0"),
                zorder=0)
    ax.text(0.25, 5.0, "Re-evaluate\nevery 30s", ha="center", va="center",
            fontsize=7, color="#999999", rotation=90, fontstyle="italic")

    fig.tight_layout()
    path = os.path.join(FIG_DIR, "decision_tree.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"  Saved: {path}")


# ===========================================================================
# Main
# ===========================================================================

def main() -> None:
    print("\n" + "=" * 72)
    print("  WeatherWise -- Paper Figure Generation")
    print("  Evaluation Report,Sections III-IV")
    print("=" * 72)

    print("\n  Generating system architecture diagram ...")
    fig_system_architecture()

    print("  Generating risk score formula visualization ...")
    fig_risk_score_formula()

    print("  Generating alert tiers visualization ...")
    fig_alert_tiers()

    print("  Generating decision tree flowchart ...")
    fig_decision_tree()

    print(f"\n  All figures saved to: {FIG_DIR}")
    print("  Figure generation complete.\n")


if __name__ == "__main__":
    main()
