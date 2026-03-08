#!/usr/bin/env python3
"""
WeatherWise Evaluation Suite -- Live NWS Weather Integration Test
===================================================================
Queries the live NWS (National Weather Service) API to find active
weather alerts, then drives a traveler through the alert area using
the WeatherWise backend (startTrip -> updatePosition -> endTrip).

All risk scoring is done by the backend -- no local compute_risk_score.

If the backend is not running, saves an NWS alert snapshot only.
If NWS returns 0 alerts, that is reported as real data (no simulated
fallback).

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

    SEVERITY_COEFFICIENTS = {
        "Tornado Warning": 1.00,
        "Severe Thunderstorm Warning": 0.75,
        "Flash Flood Warning": 0.80,
        "Hurricane Warning": 0.95,
        "Winter Storm Warning": 0.55,
        "Blizzard Warning": 0.70,
    }

    @property
    def severity_coefficient(self) -> float:
        return self.SEVERITY_COEFFICIENTS.get(self.event_type, 0.30)


@dataclass
class RiskPoint:
    lat: float
    lon: float
    elapsed_s: int
    overall_score: float
    tier: str
    alert_message: str
    recommended_action: str
    hazard_type: Optional[str]


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
# Haversine for local route point generation
# ---------------------------------------------------------------------------

def haversine_miles(lat1, lon1, lat2, lon2):
    R = 3959.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = (np.sin(dlat/2)**2 +
         np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) *
         np.sin(dlon/2)**2)
    return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Backend integration -- all risk scoring via backend
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


def query_backend_risk(lat: float, lon: float, heading: float = 180.0,
                       speed_mph: float = 65.0) -> dict | None:
    """Query backend for traveler risk score via travelerSafety."""
    query = """
    query Risk($lat: Float!, $lon: Float!, $heading: Float!, $speedMph: Float!) {
      travelerSafety(lat: $lat, lon: $lon, heading: $heading, speedMph: $speedMph) {
        overallScore tier recommendedAction alertMessage hazardType
        hazardSpecificGuidance timeToIntersectionMinutes
      }
    }
    """
    try:
        r = requests.post(BACKEND_URL,
                          json={"query": query,
                                "variables": {"lat": lat, "lon": lon,
                                              "heading": heading,
                                              "speedMph": speed_mph}},
                          timeout=10)
        if r.status_code == 200:
            data = r.json().get("data", {}).get("travelerSafety")
            return data
    except Exception:
        pass
    return None


def simulate_via_backend(alert: NWSAlert, n_points: int = 20) -> List[RiskPoint]:
    """Run a trip through the backend: startTrip -> N x updatePosition -> endTrip.

    Generates route points approaching alert centroid, uses backend for all
    risk assessment.
    """
    if alert.centroid is None:
        return []

    center_lat, center_lon = alert.centroid
    start_lat = center_lat + 0.5
    start_lon = center_lon - 0.1
    end_lat = center_lat - 0.5
    end_lon = center_lon + 0.1

    # Start trip
    start_mutation = """
    mutation StartTrip($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!) {
      startTrip(fromLat: $fromLat, fromLon: $fromLon, toLat: $toLat, toLon: $toLon) {
        sessionId route { lat lon } estimatedDistanceMiles estimatedTimeMinutes
      }
    }
    """
    try:
        resp = requests.post(BACKEND_URL, json={
            "query": start_mutation,
            "variables": {
                "fromLat": start_lat, "fromLon": start_lon,
                "toLat": end_lat, "toLon": end_lon,
            },
        }, timeout=15)
        data = resp.json().get("data", {}).get("startTrip", {})
        session_id = data.get("sessionId")
        if not session_id:
            print("  WARNING: startTrip returned no sessionId")
            return []
    except Exception as e:
        print(f"  WARNING: startTrip failed: {e}")
        return []

    # Update position N times along the route
    update_mutation = """
    mutation UpdatePos($sessionId: ID!, $lat: Float!, $lon: Float!, $heading: Float!, $speedMph: Float!) {
      updatePosition(sessionId: $sessionId, lat: $lat, lon: $lon, heading: $heading, speedMph: $speedMph) {
        overallScore tier recommendedAction alertMessage hazardType
      }
    }
    """
    risk_points = []
    for i in range(n_points):
        t = i / max(n_points - 1, 1)
        lat = start_lat + t * (end_lat - start_lat)
        lon = start_lon + t * (end_lon - start_lon)
        heading = 180.0  # traveling south
        speed = 65.0
        elapsed_s = i * 30  # 30s between updates

        try:
            resp = requests.post(BACKEND_URL, json={
                "query": update_mutation,
                "variables": {
                    "sessionId": session_id,
                    "lat": lat, "lon": lon,
                    "heading": heading, "speedMph": speed,
                },
            }, timeout=10)
            rdata = resp.json().get("data", {}).get("updatePosition", {})

            rp = RiskPoint(
                lat=round(lat, 4), lon=round(lon, 4),
                elapsed_s=elapsed_s,
                overall_score=rdata.get("overallScore", 0.0),
                tier=rdata.get("tier", "MONITORING"),
                alert_message=rdata.get("alertMessage", ""),
                recommended_action=rdata.get("recommendedAction", ""),
                hazard_type=rdata.get("hazardType"),
            )
            risk_points.append(rp)
        except Exception as e:
            print(f"  WARNING: updatePosition #{i} failed: {e}")

        time.sleep(0.1)  # small delay between updates

    # End trip
    end_mutation = """
    mutation EndTrip($sessionId: ID!) {
      endTrip(sessionId: $sessionId) {
        totalDistanceMiles totalTimeMinutes maxRiskScore alertsReceived actionsRecommended
      }
    }
    """
    trip_summary = None
    try:
        resp = requests.post(BACKEND_URL, json={
            "query": end_mutation,
            "variables": {"sessionId": session_id},
        }, timeout=10)
        trip_summary = resp.json().get("data", {}).get("endTrip")
    except Exception as e:
        print(f"  WARNING: endTrip failed: {e}")

    return risk_points, trip_summary


# ---------------------------------------------------------------------------
# Figure generators
# ---------------------------------------------------------------------------

def fig_alert_summary(alerts: List[NWSAlert], timestamp: str,
                      alert_count: int) -> None:
    """Summary figure showing alert types and severities."""
    if not alerts:
        # Generate a "no alerts" figure
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, f"No active NWS alerts found\n{timestamp}",
                ha="center", va="center", fontsize=14, color="#666",
                transform=ax.transAxes)
        ax.set_title(f"Live NWS Weather Alerts - {timestamp}")
        plt.tight_layout()
        path = os.path.join(FIG_DIR, "live_weather_alerts_map.png")
        fig.savefig(path, dpi=DPI, bbox_inches="tight")
        plt.close(fig)
        print(f"  Saved: {path}")
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
    ax1.set_title(f"Active NWS Alerts ({alert_count} total)")
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

    fig, ax = plt.subplots(figsize=(10, 5))

    elapsed = [rp.elapsed_s for rp in risk_points]
    scores = [rp.overall_score for rp in risk_points]

    colors = [TIER_COLORS.get(rp.tier, "#666") for rp in risk_points]
    ax.plot(elapsed, scores, "k-", lw=1.5, alpha=0.5)
    ax.scatter(elapsed, scores, c=colors, s=60, zorder=3, edgecolors="white")

    ax.axhspan(0, 0.25, alpha=0.08, color="#4CAF50")
    ax.axhspan(0.25, 0.50, alpha=0.08, color="#FFC107")
    ax.axhspan(0.50, 0.75, alpha=0.08, color="#FF9800")
    ax.axhspan(0.75, 1.0, alpha=0.08, color="#F44336")

    for y, label, color in [(0.125, "MONITORING", "#4CAF50"),
                             (0.375, "ADVISORY", "#FFC107"),
                             (0.625, "ACTION REQ.", "#FF9800"),
                             (0.875, "DANGER", "#F44336")]:
        ax.text(max(elapsed) * 1.02, y, label, va="center", fontsize=7,
                color=color, fontweight="bold")

    ax.set_xlabel("Elapsed Time (seconds)")
    ax.set_ylabel("Risk Score (from backend)")
    ax.set_ylim(0, 1.05)
    ax.set_title(f"WeatherWise Backend Risk Score - Approach to "
                 f"{alert.event_type}\n{alert.area_desc[:80]}",
                 fontsize=11)

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "live_risk_timeline.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


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
    target_states = ["KY", "TN", "NC", "TX", "OK", "VA", "GA", "AL", "FL"]
    print(f"\n  Fetching active NWS alerts for: {', '.join(target_states)}")

    alerts = fetch_alerts_for_states(target_states)
    print(f"  Found {len(alerts)} active alerts")

    if not alerts:
        print("  No active alerts found. This is real data -- no simulated fallback.")
        print("  (If weather is calm, there may genuinely be zero active alerts.)")

    # Print alert summary
    if alerts:
        print(f"\n  {'Event Type':<35s} {'Severity':<12s} {'Area'}")
        print("  " + "-" * 80)
        for alert in alerts[:15]:
            print(f"  {alert.event_type:<35s} {alert.severity:<12s} "
                  f"{alert.area_desc[:40]}")

    # Find most severe alert for simulation
    risk_points = []
    trip_summary = None
    target_alert = None

    severe_alerts = [a for a in alerts if a.severity_coefficient >= 0.60]
    if not severe_alerts and alerts:
        severe_alerts = alerts[:3]

    if severe_alerts:
        target_alert = max(severe_alerts, key=lambda a: a.severity_coefficient)
        print(f"\n  Target alert for simulation: {target_alert.event_type}")
        print(f"  Area: {target_alert.area_desc}")
        print(f"  Severity coefficient: {target_alert.severity_coefficient:.2f}")

        if backend_ok and target_alert.centroid:
            print("\n  Running backend trip simulation (startTrip -> 20x updatePosition -> endTrip) ...")
            result = simulate_via_backend(target_alert, n_points=20)
            if result:
                risk_points, trip_summary = result

                if risk_points:
                    print(f"\n  {'Elapsed':>8s} {'Score':>8s} {'Tier':<20s} {'Action'}")
                    print("  " + "-" * 70)
                    for rp in risk_points:
                        print(f"  {rp.elapsed_s:>7d}s {rp.overall_score:>7.3f} "
                              f"{rp.tier:<20s} {rp.recommended_action[:30]}")

                    max_risk = max(rp.overall_score for rp in risk_points)
                    danger_pts = [rp for rp in risk_points
                                  if rp.tier == "IMMEDIATE_DANGER"]
                    action_pts = [rp for rp in risk_points
                                  if rp.tier in ("ACTION_REQUIRED", "IMMEDIATE_DANGER")]
                    first_alert = next(
                        (rp for rp in risk_points if rp.tier != "MONITORING"), None)

                    print(f"\n  --- Backend Simulation Summary ---")
                    print(f"  Peak risk score:     {max_risk:.3f}")
                    print(f"  Danger points:       {len(danger_pts)} / {len(risk_points)}")
                    print(f"  Action+ points:      {len(action_pts)} / {len(risk_points)}")
                    if first_alert:
                        print(f"  First alert at:      {first_alert.elapsed_s}s")

                if trip_summary:
                    print(f"\n  --- Trip Summary (from endTrip) ---")
                    print(f"  Distance:       {trip_summary.get('totalDistanceMiles', 0):.1f} mi")
                    print(f"  Time:           {trip_summary.get('totalTimeMinutes', 0):.1f} min")
                    print(f"  Max risk:       {trip_summary.get('maxRiskScore', 0):.3f}")
                    print(f"  Alerts:         {trip_summary.get('alertsReceived', 0)}")
                    print(f"  Actions:        {trip_summary.get('actionsRecommended', [])}")
        elif backend_ok:
            print("  Alert has no polygon geometry -- cannot simulate route.")
        else:
            print("  Backend not running -- skipping trip simulation.")
    elif not alerts:
        # Query backend risk at a few sample points even with no alerts
        if backend_ok:
            print("\n  No alerts, but querying backend risk at sample points ...")
            sample_points = [
                (37.07, -84.09, "London KY"),
                (36.16, -86.78, "Nashville TN"),
                (35.23, -80.84, "Charlotte NC"),
            ]
            for lat, lon, name in sample_points:
                result = query_backend_risk(lat, lon)
                if result:
                    print(f"    {name}: score={result.get('overallScore', 0):.3f}, "
                          f"tier={result.get('tier', '?')}")

    # Generate figures
    print("\n  Generating figures ...")
    fig_alert_summary(alerts, timestamp, len(alerts))
    if risk_points and target_alert:
        fig_risk_timeline(risk_points, target_alert)

    # Save JSON results
    json_results = {
        "timestamp": timestamp,
        "data_source": "live_nws",
        "backend_running": backend_ok,
        "states_queried": target_states,
        "total_alerts": len(alerts),
        "alert_types": {},
        "simulation": None,
    }

    if alerts:
        event_types = [a.event_type for a in alerts]
        unique_types, counts = np.unique(event_types, return_counts=True)
        json_results["alert_types"] = {
            t: int(c) for t, c in zip(unique_types, counts)
        }

    if target_alert:
        json_results["target_alert"] = {
            "event_type": target_alert.event_type,
            "severity": target_alert.severity,
            "area": target_alert.area_desc,
            "severity_coefficient": target_alert.severity_coefficient,
        }

    if risk_points:
        json_results["simulation"] = {
            "method": "backend (startTrip/updatePosition/endTrip)",
            "points": len(risk_points),
            "peak_risk": max(rp.overall_score for rp in risk_points),
            "risk_timeline": [
                {"elapsed_s": rp.elapsed_s, "score": rp.overall_score,
                 "tier": rp.tier, "action": rp.recommended_action}
                for rp in risk_points
            ],
        }
        if trip_summary:
            json_results["simulation"]["trip_summary"] = trip_summary

    json_path = os.path.join(RESULTS_DIR, "live_weather_results.json")
    with open(json_path, "w") as f:
        json.dump(json_results, f, indent=2)
    print(f"  Results -> {json_path}")

    print(f"\n  All figures saved to: {FIG_DIR}")
    print("  Live weather test complete.\n")


if __name__ == "__main__":
    main()
