#!/usr/bin/env python3
"""
WeatherWise Evaluation Suite -- Live NWS Weather Integration Test
===================================================================
Queries the live NWS (National Weather Service) API to find active
weather alerts, then optionally simulates a traveler driving through
the alert area using WeatherWise's risk scoring algorithm.

If the backend is running at localhost:8080, it also sends the alert
data through the GraphQL API to demonstrate end-to-end integration.
If not, it saves an NWS alert snapshot only.

NWS API: https://api.weather.gov  (free, no API key required)

Usage:
    python live_weather_test.py

Generates:
    evaluation/figures/live_weather_alerts_map.png
    evaluation/figures/live_risk_timeline.png
    evaluation/results/live_weather_results.json

Authors: WeatherWise Research Team
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional, Tuple

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
NWS_API_BASE = "https://api.weather.gov"
NWS_HEADERS = {
    "User-Agent": "WeatherWise-Research (weatherwise@research.edu)",
    "Accept": "application/geo+json",
}
BACKEND_URL = "http://localhost:8080/graphql"

# clean plot style
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

# Risk scoring weights (from the paper)
WEIGHTS = {
    "proximity": 0.25,
    "intersection": 0.30,
    "severity": 0.20,
    "exposure": 0.15,
    "escape": 0.10,
}

SEVERITY_COEFFICIENTS = {
    "Tornado Warning": 1.00,
    "Tornado Watch": 0.60,
    "Severe Thunderstorm Warning": 0.75,
    "Severe Thunderstorm Watch": 0.45,
    "Flash Flood Warning": 0.80,
    "Flash Flood Watch": 0.50,
    "Flood Warning": 0.65,
    "Flood Watch": 0.40,
    "Winter Storm Warning": 0.55,
    "Winter Storm Watch": 0.35,
    "Blizzard Warning": 0.70,
    "Ice Storm Warning": 0.65,
    "Hurricane Warning": 0.95,
    "Hurricane Watch": 0.70,
    "Tropical Storm Warning": 0.80,
    "Red Flag Warning": 0.60,
    "Excessive Heat Warning": 0.50,
    "Wind Advisory": 0.30,
}

TIER_COLORS = {
    "MONITORING": "#4CAF50",
    "ADVISORY": "#FFC107",
    "ACTION_REQUIRED": "#FF9800",
    "IMMEDIATE_DANGER": "#F44336",
}


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class NWSAlert:
    event_type: str
    severity: str
    headline: str
    description: str
    onset: Optional[str]
    expires: Optional[str]
    area_desc: str
    coordinates: List[List[float]] = field(default_factory=list)
    centroid: Optional[Tuple[float, float]] = None

    @property
    def severity_coefficient(self) -> float:
        return SEVERITY_COEFFICIENTS.get(self.event_type, 0.30)


@dataclass
class RiskPoint:
    lat: float
    lon: float
    distance_to_alert_mi: float
    risk_score: float
    tier: str
    minute: int
    alert_event: str


# ---------------------------------------------------------------------------
# NWS API
# ---------------------------------------------------------------------------

def fetch_active_alerts(area: str = None) -> List[NWSAlert]:
    """Fetch active weather alerts from NWS API."""
    url = f"{NWS_API_BASE}/alerts/active"
    params = {"status": "actual", "message_type": "alert"}
    if area:
        params["area"] = area

    try:
        resp = requests.get(url, headers=NWS_HEADERS,
                            params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  WARNING: NWS API request failed: {e}")
        return []

    alerts = []
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        event_type = props.get("event", "Unknown")

        geom = feature.get("geometry")
        coords = []
        centroid = None
        if geom and geom.get("type") == "Polygon":
            coords = geom["coordinates"][0] if geom["coordinates"] else []
            if coords:
                lats = [c[1] for c in coords]
                lons = [c[0] for c in coords]
                centroid = (float(np.mean(lats)), float(np.mean(lons)))

        alert = NWSAlert(
            event_type=event_type,
            severity=props.get("severity", "Unknown"),
            headline=props.get("headline", ""),
            description=props.get("description", "")[:200],
            onset=props.get("onset"),
            expires=props.get("expires"),
            area_desc=props.get("areaDesc", ""),
            coordinates=coords,
            centroid=centroid,
        )
        alerts.append(alert)

    return alerts


def fetch_alerts_for_states(states: List[str]) -> List[NWSAlert]:
    """Fetch alerts for multiple states."""
    all_alerts = []
    for state in states:
        print(f"    Fetching alerts for {state} ...")
        alerts = fetch_active_alerts(area=state)
        all_alerts.extend(alerts)
        time.sleep(0.5)
    return all_alerts


# ---------------------------------------------------------------------------
# Risk scoring
# ---------------------------------------------------------------------------

def haversine_miles(lat1, lon1, lat2, lon2):
    R = 3959.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = (np.sin(dlat/2)**2 +
         np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) *
         np.sin(dlon/2)**2)
    return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))


def compute_risk_score(distance_mi: float, severity_coeff: float,
                       exposure_min: float = 0,
                       nearby_exits: int = 2) -> float:
    if distance_mi <= 0:
        proximity = 1.0
    else:
        proximity = max(0.0, 1.0 - np.log10(distance_mi + 1) / np.log10(51))

    if distance_mi <= 0:
        intersection = 1.0
    else:
        time_min = distance_mi / 65 * 60
        if time_min <= 15:
            intersection = 1.0
        elif time_min >= 60:
            intersection = 0.0
        else:
            intersection = 1.0 - (time_min - 15) / 45

    exposure = min(1.0, exposure_min / 30.0)
    escape = max(0.0, 1.0 - nearby_exits * 0.2)

    score = (WEIGHTS["proximity"] * proximity +
             WEIGHTS["intersection"] * intersection +
             WEIGHTS["severity"] * severity_coeff +
             WEIGHTS["exposure"] * exposure +
             WEIGHTS["escape"] * escape)
    return min(1.0, score)


def score_to_tier(score: float) -> str:
    if score >= 0.75:
        return "IMMEDIATE_DANGER"
    elif score >= 0.50:
        return "ACTION_REQUIRED"
    elif score >= 0.25:
        return "ADVISORY"
    return "MONITORING"


# ---------------------------------------------------------------------------
# Traveler simulation
# ---------------------------------------------------------------------------

def simulate_traveler_route(alert: NWSAlert, n_points: int = 20) -> List[RiskPoint]:
    """Simulate a traveler approaching and passing through an alert area."""
    if alert.centroid is None:
        return []

    center_lat, center_lon = alert.centroid

    start_lat = center_lat + 0.6
    start_lon = center_lon - 0.2
    end_lat = center_lat - 0.6
    end_lon = center_lon + 0.2

    risk_points = []
    for i in range(n_points):
        t = i / (n_points - 1)
        lat = start_lat + t * (end_lat - start_lat)
        lon = start_lon + t * (end_lon - start_lon)

        dist = haversine_miles(lat, lon, center_lat, center_lon)
        exposure_min = max(0, (n_points / 2 - abs(i - n_points / 2)) * 3)

        risk = compute_risk_score(dist, alert.severity_coefficient,
                                  exposure_min)
        tier = score_to_tier(risk)

        rp = RiskPoint(
            lat=round(lat, 4), lon=round(lon, 4),
            distance_to_alert_mi=round(dist, 1),
            risk_score=round(risk, 3),
            tier=tier,
            minute=i * 5,
            alert_event=alert.event_type,
        )
        risk_points.append(rp)

    return risk_points


# ---------------------------------------------------------------------------
# Backend integration
# ---------------------------------------------------------------------------

def check_backend() -> bool:
    """Check if the WeatherWise backend is reachable."""
    try:
        r = requests.post(BACKEND_URL,
                          json={"query": "{ __typename }"},
                          timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def query_backend_risk(lat: float, lon: float) -> dict | None:
    """Query backend for traveler risk score."""
    query = """
    query Risk($lat: Float!, $lon: Float!) {
      travelerRiskScore(lat: $lat, lon: $lon, bearing: 180.0, speedMph: 65.0) {
        riskScore alertTier
      }
    }
    """
    try:
        r = requests.post(BACKEND_URL,
                          json={"query": query,
                                "variables": {"lat": lat, "lon": lon}},
                          timeout=10)
        if r.status_code == 200:
            return r.json().get("data", {}).get("travelerRiskScore")
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Figure generators
# ---------------------------------------------------------------------------

def fig_alert_summary(alerts: List[NWSAlert], timestamp: str) -> None:
    """Summary figure showing alert types and severities."""
    if not alerts:
        return

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    event_types = [a.event_type for a in alerts]
    unique_types, counts = np.unique(event_types, return_counts=True)
    sorted_idx = np.argsort(-counts)
    top_n = min(10, len(unique_types))

    ax1.barh(range(top_n), counts[sorted_idx[:top_n]],
             color="#1565C0", edgecolor="white")
    ax1.set_yticks(range(top_n))
    ax1.set_yticklabels(unique_types[sorted_idx[:top_n]], fontsize=8)
    ax1.set_xlabel("Count")
    ax1.set_title(f"Active NWS Alerts ({len(alerts)} total)")
    ax1.invert_yaxis()

    severities = [a.severity for a in alerts]
    unique_sev, sev_counts = np.unique(severities, return_counts=True)
    sev_colors = {
        "Extreme": "#F44336", "Severe": "#FF9800",
        "Moderate": "#FFC107", "Minor": "#4CAF50",
        "Unknown": "#9E9E9E",
    }
    colors = [sev_colors.get(s, "#9E9E9E") for s in unique_sev]
    ax2.bar(unique_sev, sev_counts, color=colors, edgecolor="white")
    ax2.set_ylabel("Count")
    ax2.set_title("Alert Severity Distribution")

    fig.suptitle(f"Live NWS Weather Alerts - {timestamp}",
                 fontsize=13, fontweight="bold")
    plt.tight_layout()
    path = os.path.join(FIG_DIR, "live_weather_alerts_map.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


def fig_risk_timeline(risk_points: List[RiskPoint], alert: NWSAlert) -> None:
    """Plot risk score over time as traveler approaches alert area."""
    if not risk_points:
        return

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 7), sharex=True,
                                    gridspec_kw={"height_ratios": [3, 1]})

    minutes = [rp.minute for rp in risk_points]
    scores = [rp.risk_score for rp in risk_points]
    distances = [rp.distance_to_alert_mi for rp in risk_points]

    colors = [TIER_COLORS.get(rp.tier, "#666") for rp in risk_points]
    ax1.plot(minutes, scores, "k-", lw=1.5, alpha=0.5)
    ax1.scatter(minutes, scores, c=colors, s=60, zorder=3,
                edgecolors="white")

    ax1.axhspan(0, 0.25, alpha=0.08, color="#4CAF50")
    ax1.axhspan(0.25, 0.50, alpha=0.08, color="#FFC107")
    ax1.axhspan(0.50, 0.75, alpha=0.08, color="#FF9800")
    ax1.axhspan(0.75, 1.0, alpha=0.08, color="#F44336")

    for y, label, color in [(0.125, "MONITORING", "#4CAF50"),
                             (0.375, "ADVISORY", "#FFC107"),
                             (0.625, "ACTION REQ.", "#FF9800"),
                             (0.875, "DANGER", "#F44336")]:
        ax1.text(max(minutes) + 2, y, label, va="center", fontsize=7,
                 color=color, fontweight="bold")

    ax1.set_ylabel("Risk Score (R)")
    ax1.set_ylim(0, 1.05)
    ax1.set_title(f"WeatherWise Risk Score - Simulated Approach to "
                  f"{alert.event_type}\n{alert.area_desc[:80]}",
                  fontsize=11)

    ax2.plot(minutes, distances, "o-", color="#1565C0", lw=1.5, markersize=4)
    ax2.set_xlabel("Time (minutes)")
    ax2.set_ylabel("Distance (mi)")
    ax2.set_title("Distance to Alert Center", fontsize=10)
    ax2.invert_yaxis()

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "live_risk_timeline.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Simulated alerts fallback
# ---------------------------------------------------------------------------

def generate_simulated_alerts() -> List[NWSAlert]:
    """Generate plausible test alerts when NWS returns none."""
    return [
        NWSAlert(
            event_type="Tornado Warning",
            severity="Extreme",
            headline="Tornado Warning for Laurel County, KY",
            description="A severe thunderstorm capable of producing a "
                        "tornado was located near London, moving northeast.",
            onset="2025-05-16T14:30:00-04:00",
            expires="2025-05-16T15:15:00-04:00",
            area_desc="Laurel County, KY",
            centroid=(37.13, -84.08),
        ),
        NWSAlert(
            event_type="Severe Thunderstorm Warning",
            severity="Severe",
            headline="Severe Thunderstorm Warning for Knox County, KY",
            description="A severe thunderstorm was located over Barbourville, "
                        "producing 60 mph winds and quarter-size hail.",
            onset="2025-05-16T14:00:00-04:00",
            expires="2025-05-16T15:00:00-04:00",
            area_desc="Knox County, KY",
            centroid=(36.87, -83.89),
        ),
        NWSAlert(
            event_type="Flash Flood Warning",
            severity="Severe",
            headline="Flash Flood Warning for Whitley County, KY",
            description="Flash flooding is occurring along Laurel Creek "
                        "due to excessive rainfall rates of 3 inches per hour.",
            onset="2025-05-16T13:45:00-04:00",
            expires="2025-05-16T16:45:00-04:00",
            area_desc="Whitley County, KY",
            centroid=(36.77, -84.14),
        ),
    ]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("\n" + "=" * 72)
    print("  WeatherWise -- Live NWS Weather Integration Test")
    print("  Evaluation Report,Section V-D: Real-Time Data Integration")
    print("=" * 72)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    print(f"\n  Timestamp: {timestamp}")

    # Check backend
    backend_ok = check_backend()
    if backend_ok:
        print("  Backend is running at localhost:8080")
    else:
        print("  Backend not running. Will save NWS alert snapshot only.")

    # Fetch live alerts
    target_states = ["KY", "TN", "NC", "TX", "OK"]
    print(f"\n  Fetching active NWS alerts for: {', '.join(target_states)}")

    alerts = fetch_alerts_for_states(target_states)
    print(f"  Found {len(alerts)} active alerts")

    used_simulated = False
    if not alerts:
        print("  No active alerts found. Using simulated test alerts.")
        alerts = generate_simulated_alerts()
        used_simulated = True

    # Print alert summary
    print(f"\n  {'Event Type':<35s} {'Severity':<12s} {'Area'}")
    print("  " + "-" * 80)
    for alert in alerts[:15]:
        print(f"  {alert.event_type:<35s} {alert.severity:<12s} "
              f"{alert.area_desc[:40]}")

    # Find most severe alert for simulation
    severe_alerts = [a for a in alerts if a.severity_coefficient >= 0.60]
    if not severe_alerts:
        severe_alerts = alerts[:3]

    target_alert = max(severe_alerts, key=lambda a: a.severity_coefficient)
    print(f"\n  Simulating traveler approach to: {target_alert.event_type}")
    print(f"  Area: {target_alert.area_desc}")
    print(f"  Severity coefficient: {target_alert.severity_coefficient:.2f}")

    # Simulate traveler route
    risk_points = simulate_traveler_route(target_alert)

    if risk_points:
        print(f"\n  {'Min':>5s} {'Distance':>10s} {'Risk':>8s} {'Tier':<20s}")
        print("  " + "-" * 50)
        for rp in risk_points:
            print(f"  {rp.minute:>5d} {rp.distance_to_alert_mi:>9.1f} mi "
                  f"{rp.risk_score:>7.3f} {rp.tier}")

        max_risk = max(rp.risk_score for rp in risk_points)
        min_dist = min(rp.distance_to_alert_mi for rp in risk_points)
        danger_points = [rp for rp in risk_points
                         if rp.tier == "IMMEDIATE_DANGER"]
        action_points = [rp for rp in risk_points
                         if rp.tier in ("ACTION_REQUIRED", "IMMEDIATE_DANGER")]

        first_advisory = next(
            (rp for rp in risk_points if rp.tier != "MONITORING"), None)
        advisory_lead_min = (risk_points[-1].minute - first_advisory.minute
                             if first_advisory else 0)

        print(f"\n  --- Simulation Summary ---")
        print(f"  Peak risk score:     {max_risk:.3f}")
        print(f"  Closest approach:    {min_dist:.1f} mi")
        print(f"  Danger duration:     {len(danger_points) * 5} min")
        print(f"  Action+ duration:    {len(action_points) * 5} min")
        print(f"  Advisory lead time:  {advisory_lead_min} min")

    # If backend is running, also query it
    backend_risk_results = []
    if backend_ok and risk_points:
        print("\n  Querying backend for risk scores ...")
        for rp in risk_points[::4]:  # Every 4th point
            result = query_backend_risk(rp.lat, rp.lon)
            if result:
                backend_risk_results.append({
                    "lat": rp.lat, "lon": rp.lon,
                    "local_risk": rp.risk_score,
                    "backend_risk": result.get("riskScore"),
                    "backend_tier": result.get("alertTier"),
                })
        if backend_risk_results:
            print(f"  Got {len(backend_risk_results)} backend risk scores")

    # Generate figures
    print("\n  Generating figures ...")
    fig_alert_summary(alerts, timestamp)
    if risk_points:
        fig_risk_timeline(risk_points, target_alert)

    # Save JSON results
    json_results = {
        "timestamp": timestamp,
        "data_source": "simulated" if used_simulated else "live_nws",
        "backend_running": backend_ok,
        "states_queried": target_states,
        "total_alerts": len(alerts),
        "alert_types": {},
        "target_alert": {
            "event_type": target_alert.event_type,
            "severity": target_alert.severity,
            "area": target_alert.area_desc,
            "severity_coefficient": target_alert.severity_coefficient,
        },
        "simulation": {
            "points": len(risk_points),
            "peak_risk": max(rp.risk_score for rp in risk_points) if risk_points else 0,
            "min_distance_mi": min(rp.distance_to_alert_mi for rp in risk_points) if risk_points else 0,
            "risk_timeline": [
                {"minute": rp.minute, "risk": rp.risk_score,
                 "tier": rp.tier, "distance_mi": rp.distance_to_alert_mi}
                for rp in risk_points
            ],
        },
    }

    # Alert type counts
    event_types = [a.event_type for a in alerts]
    unique_types, counts = np.unique(event_types, return_counts=True)
    json_results["alert_types"] = {
        t: int(c) for t, c in zip(unique_types, counts)
    }

    if backend_risk_results:
        json_results["backend_risk_comparison"] = backend_risk_results

    json_path = os.path.join(RESULTS_DIR, "live_weather_results.json")
    with open(json_path, "w") as f:
        json.dump(json_results, f, indent=2)
    print(f"  Results -> {json_path}")

    print(f"\n  All figures saved to: {FIG_DIR}")
    print("  Live weather test complete.\n")


if __name__ == "__main__":
    main()
