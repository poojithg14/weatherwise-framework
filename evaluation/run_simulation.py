#!/usr/bin/env python3
"""
WeatherWise -- Automated 20-Trip Interactive Simulation
========================================================
Runs up to 20 concurrent trips against the WeatherWise backend:
  - 4 rotating corridor trips (always occupied, cycle through 24 US highways)
  - Up to 16 weather-chasing trips spawned from live NWS severe alerts

Interactive controls (stdin):
  s            - status: show all active trips
  c <trip_id>  - cancel: end a specific trip
  a <index>    - add: start a trip on corridor #<index>
  w            - weather: immediate NWS scan + spawn trips
  p            - pause: hold all trips in place
  r            - resume: resume all trips
  q            - quit: end all trips, export data, generate figures
  Ctrl+C       - same as q

Usage:
    python run_simulation.py --backend-url http://localhost:8080/graphql

Generates:
    evaluation/figures/simulation_risk_heatmap.png
    evaluation/figures/simulation_tier_distribution.png
    evaluation/figures/simulation_aggregate_summary.png
    evaluation/results/simulation_results.json

Authors: WeatherWise Research Team
"""

from __future__ import annotations

import argparse
import json
import math
import os
import select
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

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
    "User-Agent": "WeatherWise-Simulation (weatherwise@research.edu)",
    "Accept": "application/geo+json",
}

MAX_TRIPS = 20
MAX_TRIP_DURATION_S = 45 * 60  # 45 minutes
POSITION_UPDATE_INTERVAL_S = 10
POSITION_TICK_INTERVAL_S = 5
NWS_POLL_INTERVAL_S = 120  # 2 minutes
CORRIDOR_SLOTS = 4

SEVERE_EVENT_TYPES = {
    "Tornado Warning",
    "Severe Thunderstorm Warning",
    "Flash Flood Warning",
    "Hurricane Warning",
    "Winter Storm Warning",
    "Blizzard Warning",
}

# ---------------------------------------------------------------------------
# Corridor pool (24 US highway corridors)
# ---------------------------------------------------------------------------

@dataclass
class Corridor:
    index: int
    name: str
    from_lat: float
    from_lon: float
    to_lat: float
    to_lon: float
    speed_mph: int


CORRIDORS = [
    Corridor(1,  "I-75: Lexington KY -> Knoxville TN",   38.04, -84.50, 35.96, -83.92, 70),
    Corridor(2,  "I-75: London KY -> Williamsburg KY",    37.09, -84.08, 36.74, -84.16, 65),
    Corridor(3,  "I-95: Richmond VA -> Raleigh NC",       37.54, -77.43, 35.78, -78.64, 70),
    Corridor(4,  "I-10: Houston TX -> San Antonio TX",    29.76, -95.37, 29.42, -98.49, 75),
    Corridor(5,  "I-40: Nashville TN -> Knoxville TN",    36.16, -86.78, 35.96, -83.92, 70),
    Corridor(6,  "I-5: Portland OR -> Salem OR",          45.51, -122.68, 44.94, -123.03, 65),
    Corridor(7,  "I-35: Dallas TX -> Austin TX",          32.78, -96.80, 30.27, -97.74, 75),
    Corridor(8,  "I-90: Buffalo NY -> Syracuse NY",       42.89, -78.88, 43.05, -76.15, 65),
    Corridor(9,  "I-65: Nashville TN -> Birmingham AL",   36.16, -86.78, 33.52, -86.80, 70),
    Corridor(10, "I-80: Omaha NE -> Des Moines IA",      41.26, -95.94, 41.59, -93.62, 75),
    Corridor(11, "I-20: Atlanta GA -> Birmingham AL",     33.75, -84.39, 33.52, -86.80, 70),
    Corridor(12, "I-70: Indianapolis IN -> Columbus OH",  39.77, -86.16, 39.96, -82.99, 70),
    Corridor(13, "I-64: Louisville KY -> Lexington KY",   38.25, -85.76, 38.04, -84.50, 70),
    Corridor(14, "I-85: Charlotte NC -> Greenville SC",   35.23, -80.84, 34.85, -82.40, 70),
    Corridor(15, "I-44: Tulsa OK -> Oklahoma City OK",    36.15, -95.99, 35.47, -97.52, 75),
    Corridor(16, "I-55: Memphis TN -> Jackson MS",        35.15, -90.05, 32.30, -90.18, 70),
    Corridor(17, "I-81: Roanoke VA -> Bristol VA",        37.27, -79.94, 36.60, -82.19, 65),
    Corridor(18, "I-25: Denver CO -> Colorado Springs CO", 39.74, -104.99, 38.83, -104.82, 75),
    Corridor(19, "I-15: Salt Lake City UT -> Provo UT",   40.76, -111.89, 40.23, -111.66, 70),
    Corridor(20, "US-25: London KY local",                37.13, -84.09, 37.04, -84.11, 45),
    Corridor(21, "KY-80: East-West",                      37.09, -84.09, 37.05, -83.75, 55),
    Corridor(22, "I-95: Jacksonville FL -> Savannah GA",  30.33, -81.66, 32.08, -81.09, 70),
    Corridor(23, "I-10: Pensacola FL -> Mobile AL",       30.44, -87.22, 30.69, -88.04, 70),
    Corridor(24, "I-94: Milwaukee WI -> Chicago IL",      43.04, -87.91, 41.88, -87.63, 65),
]

# ---------------------------------------------------------------------------
# Haversine
# ---------------------------------------------------------------------------

def haversine_miles(lat1, lon1, lat2, lon2):
    R = 3959.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def interpolate_position(from_lat, from_lon, to_lat, to_lon,
                          fraction: float) -> Tuple[float, float]:
    """Linear interpolation between two points."""
    lat = from_lat + fraction * (to_lat - from_lat)
    lon = from_lon + fraction * (to_lon - from_lon)
    return lat, lon


def compute_heading(from_lat, from_lon, to_lat, to_lon) -> float:
    """Compute bearing in degrees from point A to B."""
    dlon = math.radians(to_lon - from_lon)
    lat1 = math.radians(from_lat)
    lat2 = math.radians(to_lat)
    x = math.sin(dlon) * math.cos(lat2)
    y = (math.cos(lat1) * math.sin(lat2) -
         math.sin(lat1) * math.cos(lat2) * math.cos(dlon))
    return (math.degrees(math.atan2(x, y)) + 360) % 360


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class RiskEntry:
    elapsed_s: int
    lat: float
    lon: float
    overall_score: float
    tier: str
    alert_message: str
    hazard_type: Optional[str]
    recommended_action: str


@dataclass
class TripData:
    id: str
    name: str
    corridor_name: str
    from_lat: float
    from_lon: float
    to_lat: float
    to_lon: float
    speed_mph: int
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    session_id: Optional[str] = None
    risk_timeline: List[RiskEntry] = field(default_factory=list)
    summary: Optional[dict] = None
    trip_type: str = "corridor"  # "corridor" or "weather"
    weather_event: Optional[str] = None
    cancelled: bool = False
    completed: bool = False
    current_lat: float = 0.0
    current_lon: float = 0.0


# ---------------------------------------------------------------------------
# GraphQL helpers
# ---------------------------------------------------------------------------

def gql_start_trip(backend_url: str, from_lat: float, from_lon: float,
                   to_lat: float, to_lon: float) -> dict | None:
    query = """
    mutation StartTrip($fromLat: Float!, $fromLon: Float!, $toLat: Float!, $toLon: Float!) {
      startTrip(fromLat: $fromLat, fromLon: $fromLon, toLat: $toLat, toLon: $toLon) {
        sessionId route { lat lon } estimatedDistanceMiles estimatedTimeMinutes
      }
    }
    """
    try:
        r = requests.post(backend_url, json={
            "query": query,
            "variables": {
                "fromLat": from_lat, "fromLon": from_lon,
                "toLat": to_lat, "toLon": to_lon,
            },
        }, timeout=15)
        if r.status_code == 200:
            return r.json().get("data", {}).get("startTrip")
    except Exception:
        pass
    return None


def gql_update_position(backend_url: str, session_id: str,
                         lat: float, lon: float,
                         heading: float, speed_mph: float) -> dict | None:
    query = """
    mutation UpdatePos($sid: ID!, $lat: Float!, $lon: Float!, $h: Float!, $s: Float!) {
      updatePosition(sessionId: $sid, lat: $lat, lon: $lon, heading: $h, speedMph: $s) {
        overallScore tier recommendedAction alertMessage hazardType
      }
    }
    """
    try:
        r = requests.post(backend_url, json={
            "query": query,
            "variables": {
                "sid": session_id,
                "lat": lat, "lon": lon,
                "h": heading, "s": speed_mph,
            },
        }, timeout=10)
        if r.status_code == 200:
            return r.json().get("data", {}).get("updatePosition")
    except Exception:
        pass
    return None


def gql_end_trip(backend_url: str, session_id: str) -> dict | None:
    query = """
    mutation EndTrip($sid: ID!) {
      endTrip(sessionId: $sid) {
        totalDistanceMiles totalTimeMinutes maxRiskScore alertsReceived actionsRecommended
      }
    }
    """
    try:
        r = requests.post(backend_url, json={
            "query": query,
            "variables": {"sid": session_id},
        }, timeout=10)
        if r.status_code == 200:
            return r.json().get("data", {}).get("endTrip")
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# NWS weather scanning
# ---------------------------------------------------------------------------

def fetch_severe_alerts() -> List[dict]:
    """Fetch all active severe weather alerts from NWS for entire US."""
    url = f"{NWS_API_BASE}/alerts/active"
    params = {"status": "actual", "message_type": "alert"}
    try:
        resp = requests.get(url, headers=NWS_HEADERS,
                            params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  [NWS] Fetch failed: {e}")
        return []

    severe = []
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        event_type = props.get("event", "Unknown")
        if event_type not in SEVERE_EVENT_TYPES:
            continue

        geom = feature.get("geometry")
        centroid = None
        if geom and geom.get("type") == "Polygon":
            coords = geom["coordinates"][0] if geom.get("coordinates") else []
            if coords:
                lats = [c[1] for c in coords]
                lons = [c[0] for c in coords]
                centroid = (float(np.mean(lats)), float(np.mean(lons)))

        if centroid:
            severe.append({
                "event_type": event_type,
                "headline": props.get("headline", ""),
                "area": props.get("areaDesc", ""),
                "centroid": centroid,
                "id": props.get("id", ""),
            })

    return severe


# ---------------------------------------------------------------------------
# Simulation engine
# ---------------------------------------------------------------------------

class SimulationEngine:
    def __init__(self, backend_url: str):
        self.backend_url = backend_url
        self.lock = threading.Lock()
        self.trips: Dict[str, TripData] = {}
        self.completed_trips: List[TripData] = []
        self.trip_counter = 0
        self.corridor_round_robin = 0
        self.active_corridors: set = set()  # corridor indices currently in use
        self.seen_weather_ids: set = set()
        self.paused = False
        self.running = True
        self.executor = ThreadPoolExecutor(max_workers=MAX_TRIPS + 4)

    def _next_trip_id(self) -> str:
        self.trip_counter += 1
        return f"trip-{self.trip_counter:03d}"

    def _pick_next_corridor(self) -> Optional[Corridor]:
        """Round-robin through corridors, skip if already in use."""
        start = self.corridor_round_robin
        for _ in range(len(CORRIDORS)):
            idx = self.corridor_round_robin % len(CORRIDORS)
            self.corridor_round_robin += 1
            c = CORRIDORS[idx]
            if c.index not in self.active_corridors:
                return c
        return None

    def active_count(self) -> int:
        with self.lock:
            return len(self.trips)

    def start_corridor_trip(self, corridor: Optional[Corridor] = None) -> Optional[str]:
        """Start a trip on a corridor. Returns trip ID or None."""
        if corridor is None:
            with self.lock:
                corridor = self._pick_next_corridor()
        if corridor is None:
            return None

        trip_id = self._next_trip_id()
        trip = TripData(
            id=trip_id,
            name=f"Corridor {corridor.name}",
            corridor_name=corridor.name,
            from_lat=corridor.from_lat,
            from_lon=corridor.from_lon,
            to_lat=corridor.to_lat,
            to_lon=corridor.to_lon,
            speed_mph=corridor.speed_mph,
            trip_type="corridor",
            current_lat=corridor.from_lat,
            current_lon=corridor.from_lon,
        )

        # Start trip on backend
        result = gql_start_trip(
            self.backend_url,
            corridor.from_lat, corridor.from_lon,
            corridor.to_lat, corridor.to_lon,
        )
        if not result or not result.get("sessionId"):
            print(f"  [WARN] startTrip failed for {corridor.name}")
            return None

        trip.session_id = result["sessionId"]
        trip.start_time = datetime.now(timezone.utc).isoformat()

        with self.lock:
            self.trips[trip_id] = trip
            self.active_corridors.add(corridor.index)

        # Launch execution thread
        self.executor.submit(self._run_trip, trip_id, corridor.index)
        print(f"  [START] {trip_id}: {corridor.name} (session={trip.session_id[:8]}...)")
        return trip_id

    def start_weather_trip(self, centroid: Tuple[float, float],
                            event_type: str, headline: str) -> Optional[str]:
        """Start a weather-chasing trip near a severe weather event."""
        if self.active_count() >= MAX_TRIPS:
            return None

        center_lat, center_lon = centroid
        from_lat = center_lat + 0.5
        to_lat = center_lat - 0.5

        trip_id = self._next_trip_id()
        trip = TripData(
            id=trip_id,
            name=f"Weather: {event_type}",
            corridor_name=f"Weather ({headline[:40]})",
            from_lat=from_lat,
            from_lon=center_lon,
            to_lat=to_lat,
            to_lon=center_lon,
            speed_mph=65,
            trip_type="weather",
            weather_event=event_type,
            current_lat=from_lat,
            current_lon=center_lon,
        )

        result = gql_start_trip(
            self.backend_url, from_lat, center_lon, to_lat, center_lon,
        )
        if not result or not result.get("sessionId"):
            print(f"  [WARN] startTrip failed for weather trip near ({center_lat:.2f}, {center_lon:.2f})")
            return None

        trip.session_id = result["sessionId"]
        trip.start_time = datetime.now(timezone.utc).isoformat()

        with self.lock:
            self.trips[trip_id] = trip

        self.executor.submit(self._run_trip, trip_id, None)
        print(f"  [WEATHER] {trip_id}: {event_type} near ({center_lat:.2f}, {center_lon:.2f})")
        return trip_id

    def _run_trip(self, trip_id: str, corridor_index: Optional[int]):
        """Execute a trip: advance along waypoints, update position, collect risk."""
        with self.lock:
            trip = self.trips.get(trip_id)
        if not trip:
            return

        total_dist = haversine_miles(
            trip.from_lat, trip.from_lon, trip.to_lat, trip.to_lon)
        speed_mi_per_s = trip.speed_mph / 3600.0
        total_time_s = total_dist / speed_mi_per_s if speed_mi_per_s > 0 else 600

        heading = compute_heading(
            trip.from_lat, trip.from_lon, trip.to_lat, trip.to_lon)

        elapsed = 0
        last_update = -POSITION_UPDATE_INTERVAL_S  # force immediate first update

        while self.running and not trip.cancelled:
            if self.paused:
                time.sleep(1)
                continue

            fraction = min(1.0, elapsed / total_time_s)
            lat, lon = interpolate_position(
                trip.from_lat, trip.from_lon,
                trip.to_lat, trip.to_lon, fraction)

            trip.current_lat = lat
            trip.current_lon = lon

            # Send position update every POSITION_UPDATE_INTERVAL_S
            if elapsed - last_update >= POSITION_UPDATE_INTERVAL_S:
                result = gql_update_position(
                    self.backend_url, trip.session_id,
                    lat, lon, heading, float(trip.speed_mph))
                if result:
                    entry = RiskEntry(
                        elapsed_s=elapsed,
                        lat=round(lat, 4),
                        lon=round(lon, 4),
                        overall_score=result.get("overallScore", 0.0),
                        tier=result.get("tier", "MONITORING"),
                        alert_message=result.get("alertMessage", ""),
                        hazard_type=result.get("hazardType"),
                        recommended_action=result.get("recommendedAction", ""),
                    )
                    trip.risk_timeline.append(entry)
                last_update = elapsed

            # Check completion
            if fraction >= 1.0 or elapsed >= MAX_TRIP_DURATION_S:
                break

            time.sleep(POSITION_TICK_INTERVAL_S)
            elapsed += POSITION_TICK_INTERVAL_S

        # End trip
        summary = gql_end_trip(self.backend_url, trip.session_id)
        trip.summary = summary
        trip.end_time = datetime.now(timezone.utc).isoformat()
        trip.completed = True

        with self.lock:
            self.trips.pop(trip_id, None)
            self.completed_trips.append(trip)
            if corridor_index is not None:
                self.active_corridors.discard(corridor_index)

        status = "CANCELLED" if trip.cancelled else "COMPLETED"
        print(f"  [{status}] {trip_id}: {trip.corridor_name}")

        # If this was a corridor slot trip, start the next one
        if corridor_index is not None and not trip.cancelled and self.running:
            self._fill_corridor_slot()

    def _fill_corridor_slot(self):
        """Fill an empty corridor slot with the next available corridor."""
        corridor_count = sum(
            1 for t in self.trips.values() if t.trip_type == "corridor")
        if corridor_count < CORRIDOR_SLOTS:
            self.start_corridor_trip()

    def cancel_trip(self, trip_id: str) -> bool:
        """Cancel a specific trip."""
        with self.lock:
            trip = self.trips.get(trip_id)
        if trip:
            trip.cancelled = True
            print(f"  [CANCEL] Requesting cancel for {trip_id}")
            return True
        return False

    def scan_weather_and_spawn(self):
        """Poll NWS for severe weather and spawn trips."""
        print("  [NWS] Scanning for severe weather ...")
        alerts = fetch_severe_alerts()
        new_count = 0

        for alert in alerts:
            alert_id = alert["id"]
            if alert_id in self.seen_weather_ids:
                continue
            self.seen_weather_ids.add(alert_id)

            if self.active_count() >= MAX_TRIPS:
                break

            tid = self.start_weather_trip(
                alert["centroid"], alert["event_type"], alert["headline"])
            if tid:
                new_count += 1

        print(f"  [NWS] Found {len(alerts)} severe alerts, spawned {new_count} new trips")

    def get_status(self) -> str:
        """Return a formatted status string."""
        lines = []
        with self.lock:
            trips = list(self.trips.values())
        lines.append(f"\n  Active trips: {len(trips)}  |  "
                     f"Completed: {len(self.completed_trips)}  |  "
                     f"Paused: {self.paused}")
        lines.append(f"  {'ID':<12s} {'Type':<10s} {'Corridor':<40s} "
                     f"{'Lat':>8s} {'Lon':>10s} {'Score':>6s} {'Tier':<20s}")
        lines.append("  " + "-" * 108)
        for t in trips:
            last_score = ""
            last_tier = ""
            if t.risk_timeline:
                last = t.risk_timeline[-1]
                last_score = f"{last.overall_score:.3f}"
                last_tier = last.tier
            lines.append(
                f"  {t.id:<12s} {t.trip_type:<10s} {t.corridor_name[:40]:<40s} "
                f"{t.current_lat:>8.4f} {t.current_lon:>10.4f} "
                f"{last_score:>6s} {last_tier:<20s}")
        return "\n".join(lines)

    def shutdown(self):
        """End all trips and shut down."""
        self.running = False
        with self.lock:
            for trip in self.trips.values():
                trip.cancelled = True
        # Wait for threads to finish
        self.executor.shutdown(wait=True, cancel_futures=False)

    def all_trip_data(self) -> List[TripData]:
        """Return all completed trip data."""
        with self.lock:
            # Include any still-active trips
            active = list(self.trips.values())
        return self.completed_trips + active


# ---------------------------------------------------------------------------
# Figure generators
# ---------------------------------------------------------------------------

def fig_risk_heatmap(trips: List[TripData]) -> None:
    """Heatmap: trips x time, colored by risk score."""
    trips_with_data = [t for t in trips if t.risk_timeline]
    if not trips_with_data:
        return

    max_points = max(len(t.risk_timeline) for t in trips_with_data)
    data = np.full((len(trips_with_data), max_points), np.nan)
    labels = []

    for i, trip in enumerate(trips_with_data):
        labels.append(f"{trip.id}")
        for j, entry in enumerate(trip.risk_timeline):
            data[i, j] = entry.overall_score

    fig, ax = plt.subplots(figsize=(14, max(4, len(trips_with_data) * 0.4 + 2)))
    im = ax.imshow(data, aspect="auto", cmap="RdYlGn_r", vmin=0, vmax=1,
                   interpolation="nearest")
    ax.set_yticks(range(len(labels)))
    ax.set_yticklabels(labels, fontsize=7)
    ax.set_xlabel("Position Update #")
    ax.set_ylabel("Trip")
    ax.set_title("WeatherWise Simulation - Risk Score Heatmap")
    plt.colorbar(im, ax=ax, label="Risk Score")

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "simulation_risk_heatmap.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


def fig_tier_distribution(trips: List[TripData]) -> None:
    """Stacked bar chart: tier % per trip."""
    trips_with_data = [t for t in trips if t.risk_timeline]
    if not trips_with_data:
        return

    tiers = ["MONITORING", "ADVISORY", "ACTION_REQUIRED", "IMMEDIATE_DANGER"]
    tier_colors = ["#4CAF50", "#FFC107", "#FF9800", "#F44336"]

    labels = []
    tier_pcts = {t: [] for t in tiers}

    for trip in trips_with_data:
        labels.append(trip.id)
        total = len(trip.risk_timeline)
        for tier in tiers:
            count = sum(1 for e in trip.risk_timeline if e.tier == tier)
            tier_pcts[tier].append(count / total * 100 if total else 0)

    fig, ax = plt.subplots(figsize=(max(8, len(labels) * 0.5 + 2), 6))
    x = np.arange(len(labels))
    bottom = np.zeros(len(labels))

    for tier, color in zip(tiers, tier_colors):
        values = tier_pcts[tier]
        ax.bar(x, values, bottom=bottom, label=tier, color=color,
               edgecolor="white", width=0.7)
        bottom += np.array(values)

    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=45, ha="right", fontsize=7)
    ax.set_ylabel("Percentage (%)")
    ax.set_title("WeatherWise Simulation - Tier Distribution per Trip")
    ax.legend(loc="upper right", fontsize=8)
    ax.set_ylim(0, 105)

    plt.tight_layout()
    path = os.path.join(FIG_DIR, "simulation_tier_distribution.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


def fig_aggregate_summary(trips: List[TripData], stats: dict) -> None:
    """Multi-panel aggregate summary."""
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))

    # Panel 1: Risk score distribution across all updates
    all_scores = []
    for trip in trips:
        all_scores.extend(e.overall_score for e in trip.risk_timeline)

    if all_scores:
        ax1 = axes[0]
        ax1.hist(all_scores, bins=20, color="#1565C0", edgecolor="white",
                 alpha=0.8)
        ax1.axvline(np.mean(all_scores), color="#F44336", lw=2,
                    label=f"Mean={np.mean(all_scores):.3f}")
        ax1.set_xlabel("Risk Score")
        ax1.set_ylabel("Count")
        ax1.set_title("Overall Risk Score Distribution")
        ax1.legend()

    # Panel 2: Tier breakdown pie
    tier_counts = {"MONITORING": 0, "ADVISORY": 0,
                   "ACTION_REQUIRED": 0, "IMMEDIATE_DANGER": 0}
    for trip in trips:
        for e in trip.risk_timeline:
            if e.tier in tier_counts:
                tier_counts[e.tier] += 1

    ax2 = axes[1]
    labels_pie = list(tier_counts.keys())
    sizes = list(tier_counts.values())
    colors_pie = ["#4CAF50", "#FFC107", "#FF9800", "#F44336"]
    if sum(sizes) > 0:
        ax2.pie(sizes, labels=labels_pie, colors=colors_pie,
                autopct="%1.1f%%", startangle=140, textprops={"fontsize": 8})
    ax2.set_title("Tier Distribution (All Updates)")

    # Panel 3: Stats table
    ax3 = axes[2]
    ax3.axis("off")
    table_data = [
        ["Total trips", str(stats.get("total_trips", 0))],
        ["Corridor trips", str(stats.get("corridor_trips", 0))],
        ["Weather trips", str(stats.get("weather_trips", 0))],
        ["Mean risk score", f"{stats.get('mean_risk', 0):.3f}"],
        ["Max risk score", f"{stats.get('max_risk', 0):.3f}"],
        ["% ADVISORY+", f"{stats.get('pct_advisory_plus', 0):.1f}%"],
        ["% ACTION_REQ+", f"{stats.get('pct_action_plus', 0):.1f}%"],
        ["% DANGER", f"{stats.get('pct_danger', 0):.1f}%"],
        ["Corridors used", str(stats.get("corridors_used", 0))],
    ]
    table = ax3.table(cellText=table_data, colLabels=["Metric", "Value"],
                      cellLoc="center", loc="center",
                      colColours=["#E3F2FD", "#E3F2FD"])
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1.0, 1.6)
    ax3.set_title("Aggregate Statistics")

    fig.suptitle("WeatherWise Simulation - Aggregate Summary",
                 fontsize=13, fontweight="bold")
    plt.tight_layout()
    path = os.path.join(FIG_DIR, "simulation_aggregate_summary.png")
    fig.savefig(path, dpi=DPI, bbox_inches="tight")
    plt.close(fig)
    print(f"  Saved: {path}")


# ---------------------------------------------------------------------------
# Output / export
# ---------------------------------------------------------------------------

def compute_aggregate_stats(trips: List[TripData]) -> dict:
    all_scores = []
    all_tiers = []
    corridors_used = set()

    for trip in trips:
        for e in trip.risk_timeline:
            all_scores.append(e.overall_score)
            all_tiers.append(e.tier)
        if trip.trip_type == "corridor":
            corridors_used.add(trip.corridor_name)

    total_updates = len(all_tiers)
    corridor_count = sum(1 for t in trips if t.trip_type == "corridor")
    weather_count = sum(1 for t in trips if t.trip_type == "weather")

    pct_adv = 0
    pct_act = 0
    pct_danger = 0
    if total_updates:
        advisory_plus = sum(1 for t in all_tiers if t != "MONITORING")
        action_plus = sum(1 for t in all_tiers
                          if t in ("ACTION_REQUIRED", "IMMEDIATE_DANGER"))
        danger = sum(1 for t in all_tiers if t == "IMMEDIATE_DANGER")
        pct_adv = advisory_plus / total_updates * 100
        pct_act = action_plus / total_updates * 100
        pct_danger = danger / total_updates * 100

    # Avg time-to-first-alert for weather trips
    first_alert_times = []
    for trip in trips:
        if trip.trip_type == "weather":
            for e in trip.risk_timeline:
                if e.tier != "MONITORING":
                    first_alert_times.append(e.elapsed_s)
                    break

    return {
        "total_trips": len(trips),
        "corridor_trips": corridor_count,
        "weather_trips": weather_count,
        "total_position_updates": total_updates,
        "mean_risk": float(np.mean(all_scores)) if all_scores else 0,
        "max_risk": float(np.max(all_scores)) if all_scores else 0,
        "pct_advisory_plus": pct_adv,
        "pct_action_plus": pct_act,
        "pct_danger": pct_danger,
        "corridors_used": len(corridors_used),
        "avg_time_to_first_alert_s": (
            float(np.mean(first_alert_times)) if first_alert_times else None),
        "tier_distribution": {
            tier: sum(1 for t in all_tiers if t == tier)
            for tier in ["MONITORING", "ADVISORY", "ACTION_REQUIRED", "IMMEDIATE_DANGER"]
        },
    }


def export_results(trips: List[TripData], stats: dict):
    """Export JSON results."""
    trip_records = []
    for trip in trips:
        record = {
            "id": trip.id,
            "name": trip.name,
            "corridor": trip.corridor_name,
            "type": trip.trip_type,
            "from": {"lat": trip.from_lat, "lon": trip.from_lon},
            "to": {"lat": trip.to_lat, "lon": trip.to_lon},
            "speed_mph": trip.speed_mph,
            "start_time": trip.start_time,
            "end_time": trip.end_time,
            "cancelled": trip.cancelled,
            "weather_event": trip.weather_event,
            "risk_timeline": [
                {
                    "elapsed_s": e.elapsed_s,
                    "lat": e.lat, "lon": e.lon,
                    "overallScore": e.overall_score,
                    "tier": e.tier,
                    "alertMessage": e.alert_message,
                    "hazardType": e.hazard_type,
                    "recommendedAction": e.recommended_action,
                }
                for e in trip.risk_timeline
            ],
            "summary": trip.summary,
        }
        trip_records.append(record)

    output = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "aggregate": stats,
        "trips": trip_records,
    }

    json_path = os.path.join(RESULTS_DIR, "simulation_results.json")
    with open(json_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"  Results -> {json_path}")


# ---------------------------------------------------------------------------
# Input handling (cross-platform)
# ---------------------------------------------------------------------------

def _input_available() -> bool:
    """Check if stdin has data available (non-blocking)."""
    if sys.platform == "win32":
        import msvcrt
        return msvcrt.kbhit()
    else:
        ready, _, _ = select.select([sys.stdin], [], [], 0)
        return bool(ready)


def _read_line() -> str:
    """Read a line from stdin."""
    if sys.platform == "win32":
        import msvcrt
        chars = []
        while msvcrt.kbhit():
            ch = msvcrt.getwch()
            if ch in ("\r", "\n"):
                break
            chars.append(ch)
        return "".join(chars).strip()
    else:
        return sys.stdin.readline().strip()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="WeatherWise 20-trip interactive simulation")
    parser.add_argument("--backend-url", default="http://localhost:8080/graphql",
                        help="GraphQL endpoint URL")
    args = parser.parse_args()

    print("\n" + "=" * 72)
    print("  WeatherWise -- Automated Trip Simulation")
    print("=" * 72)
    print(f"  Backend: {args.backend_url}")
    print(f"  Max concurrent trips: {MAX_TRIPS}")
    print(f"  Corridor slots: {CORRIDOR_SLOTS}")
    print(f"  NWS poll interval: {NWS_POLL_INTERVAL_S}s")

    # Check backend
    print("\n  Checking backend ...")
    try:
        r = requests.post(args.backend_url,
                          json={"query": "{ __typename }"},
                          timeout=5)
        if r.status_code != 200:
            print(f"  ERROR: Backend returned status {r.status_code}")
            return
    except Exception as e:
        print(f"  ERROR: Cannot reach backend: {e}")
        return
    print("  Backend is running.")

    engine = SimulationEngine(args.backend_url)

    print("\n  Controls:")
    print("    s            - status")
    print("    c <trip_id>  - cancel trip")
    print("    a <index>    - add corridor trip (1-24)")
    print("    w            - weather scan + spawn")
    print("    p            - pause all")
    print("    r            - resume all")
    print("    q            - quit")
    print()

    # Start initial 4 corridor trips
    print("  Starting 4 corridor trips ...")
    for _ in range(CORRIDOR_SLOTS):
        engine.start_corridor_trip()
        time.sleep(0.5)  # stagger starts slightly

    # Initial weather scan
    engine.scan_weather_and_spawn()

    last_nws_scan = time.time()

    try:
        while engine.running:
            # Periodic NWS scan
            now = time.time()
            if now - last_nws_scan >= NWS_POLL_INTERVAL_S:
                engine.scan_weather_and_spawn()
                last_nws_scan = now

            # Ensure corridor slots stay filled
            with engine.lock:
                corridor_active = sum(
                    1 for t in engine.trips.values() if t.trip_type == "corridor")
            while corridor_active < CORRIDOR_SLOTS and engine.running:
                tid = engine.start_corridor_trip()
                if tid is None:
                    break
                corridor_active += 1
                time.sleep(0.3)

            # Check for user input
            if _input_available():
                line = _read_line()
                if not line:
                    pass
                elif line.lower() == "s":
                    print(engine.get_status())
                elif line.lower().startswith("c "):
                    tid = line.split(None, 1)[1].strip()
                    if not engine.cancel_trip(tid):
                        print(f"  Trip '{tid}' not found among active trips.")
                elif line.lower().startswith("a "):
                    try:
                        idx = int(line.split(None, 1)[1].strip())
                        if 1 <= idx <= len(CORRIDORS):
                            corridor = CORRIDORS[idx - 1]
                            with engine.lock:
                                if corridor.index in engine.active_corridors:
                                    print(f"  Corridor #{idx} already in use.")
                                else:
                                    engine.start_corridor_trip(corridor)
                        else:
                            print(f"  Invalid corridor index. Use 1-{len(CORRIDORS)}.")
                    except ValueError:
                        print("  Usage: a <corridor_index>")
                elif line.lower() == "w":
                    engine.scan_weather_and_spawn()
                elif line.lower() == "p":
                    engine.paused = True
                    print("  PAUSED -- all trips holding position.")
                elif line.lower() == "r":
                    engine.paused = False
                    print("  RESUMED -- all trips moving.")
                elif line.lower() == "q":
                    break
                else:
                    print(f"  Unknown command: '{line}'. Use s/c/a/w/p/r/q.")

            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\n  Ctrl+C received. Shutting down ...")

    # Shutdown
    print("\n  Ending all trips ...")
    engine.shutdown()

    # Collect all data
    all_trips = engine.all_trip_data()
    stats = compute_aggregate_stats(all_trips)

    # Print summary
    print(f"\n{'=' * 72}")
    print("  SIMULATION RESULTS")
    print(f"{'=' * 72}")
    print(f"  Total trips:             {stats['total_trips']}")
    print(f"  Corridor trips:          {stats['corridor_trips']}")
    print(f"  Weather trips:           {stats['weather_trips']}")
    print(f"  Position updates:        {stats['total_position_updates']}")
    print(f"  Mean risk score:         {stats['mean_risk']:.3f}")
    print(f"  Max risk score:          {stats['max_risk']:.3f}")
    print(f"  % ADVISORY+:            {stats['pct_advisory_plus']:.1f}%")
    print(f"  % ACTION_REQUIRED+:     {stats['pct_action_plus']:.1f}%")
    print(f"  % IMMEDIATE_DANGER:     {stats['pct_danger']:.1f}%")
    print(f"  Corridors used:          {stats['corridors_used']}")
    if stats['avg_time_to_first_alert_s'] is not None:
        print(f"  Avg time-to-first-alert: {stats['avg_time_to_first_alert_s']:.0f}s")
    print(f"  Tier distribution:       {stats['tier_distribution']}")

    # Generate figures
    print("\n  Generating figures ...")
    fig_risk_heatmap(all_trips)
    fig_tier_distribution(all_trips)
    fig_aggregate_summary(all_trips, stats)

    # Export JSON
    export_results(all_trips, stats)

    print(f"\n  Figures saved to: {FIG_DIR}")
    print("  Simulation complete.\n")


if __name__ == "__main__":
    main()
