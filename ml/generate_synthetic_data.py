"""
WeatherWise — Synthetic Storm Events Data Generator
=====================================================
Generates 10,000 realistic synthetic training records modeled after the
NOAA Storm Events Database format.  Distributions for event type, geography,
seasonality, magnitude, and casualties are calibrated against published
NOAA/SPC climatologies so downstream ML models train on plausible patterns.

Usage:
    python generate_synthetic_data.py
Output:
    ml/data/synthetic_storm_events.csv
"""

import os
import random
import datetime
import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SEED = 42
NUM_RECORDS = 10_000
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "synthetic_storm_events.csv")

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

EVENT_TYPES = [
    "Tornado",
    "Thunderstorm Wind",
    "Flash Flood",
    "Hail",
    "Winter Storm",
    "Hurricane",
    "Wildfire",
]
EVENT_WEIGHTS = [0.15, 0.25, 0.20, 0.15, 0.10, 0.10, 0.05]

# EF scale weights (EF0 most common, EF5 extremely rare)
EF_SCALES = ["EF0", "EF1", "EF2", "EF3", "EF4", "EF5"]
EF_WEIGHTS = [0.35, 0.30, 0.18, 0.10, 0.05, 0.02]

# US states with abbreviations
STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming",
}

# Approximate geographic bounding boxes  (lat_min, lat_max, lon_min, lon_max)
STATE_COORDS = {
    "AL": (30.2, 35.0, -88.5, -84.9), "AK": (54.0, 71.4, -170.0, -130.0),
    "AZ": (31.3, 37.0, -114.8, -109.0), "AR": (33.0, 36.5, -94.6, -89.6),
    "CA": (32.5, 42.0, -124.4, -114.1), "CO": (37.0, 41.0, -109.1, -102.0),
    "CT": (41.0, 42.1, -73.7, -71.8), "DE": (38.5, 39.8, -75.8, -75.0),
    "FL": (24.5, 31.0, -87.6, -80.0), "GA": (30.4, 35.0, -85.6, -80.8),
    "HI": (18.9, 22.2, -160.2, -154.8), "ID": (42.0, 49.0, -117.2, -111.0),
    "IL": (37.0, 42.5, -91.5, -87.5), "IN": (37.8, 41.8, -88.1, -84.8),
    "IA": (40.4, 43.5, -96.6, -90.1), "KS": (37.0, 40.0, -102.1, -94.6),
    "KY": (36.5, 39.1, -89.6, -81.9), "LA": (29.0, 33.0, -94.0, -89.0),
    "ME": (43.1, 47.5, -71.1, -66.9), "MD": (38.0, 39.7, -79.5, -75.0),
    "MA": (41.2, 42.9, -73.5, -69.9), "MI": (41.7, 48.3, -90.4, -82.4),
    "MN": (43.5, 49.4, -97.2, -89.5), "MS": (30.2, 35.0, -91.7, -88.1),
    "MO": (36.0, 40.6, -95.8, -89.1), "MT": (44.4, 49.0, -116.0, -104.0),
    "NE": (40.0, 43.0, -104.1, -95.3), "NV": (35.0, 42.0, -120.0, -114.0),
    "NH": (42.7, 45.3, -72.6, -70.7), "NJ": (38.9, 41.4, -75.6, -73.9),
    "NM": (31.3, 37.0, -109.1, -103.0), "NY": (40.5, 45.0, -79.8, -71.9),
    "NC": (33.8, 36.6, -84.3, -75.5), "ND": (45.9, 49.0, -104.1, -96.6),
    "OH": (38.4, 42.0, -84.8, -80.5), "OK": (33.6, 37.0, -103.0, -94.4),
    "OR": (42.0, 46.3, -124.6, -116.5), "PA": (39.7, 42.3, -80.5, -74.7),
    "RI": (41.1, 42.0, -71.9, -71.1), "SC": (32.0, 35.2, -83.4, -78.5),
    "SD": (42.5, 46.0, -104.1, -96.4), "TN": (35.0, 36.7, -90.3, -81.6),
    "TX": (25.8, 36.5, -106.6, -93.5), "UT": (37.0, 42.0, -114.1, -109.0),
    "VT": (42.7, 45.0, -73.4, -71.5), "VA": (36.5, 39.5, -83.7, -75.2),
    "WA": (45.5, 49.0, -124.8, -116.9), "WV": (37.2, 40.6, -82.6, -77.7),
    "WI": (42.5, 47.1, -92.9, -86.3), "WY": (41.0, 45.0, -111.1, -104.1),
}

# ---------------------------------------------------------------------------
# Per-event-type state affinity weights  (higher = more likely)
# ---------------------------------------------------------------------------
TORNADO_STATES = {
    "OK": 8, "TX": 8, "KS": 7, "AL": 6, "MS": 6, "AR": 5, "MO": 5,
    "TN": 5, "IL": 4, "IN": 4, "IA": 4, "NE": 4, "GA": 3, "LA": 3,
    "OH": 3, "KY": 3, "SD": 3, "NC": 2, "SC": 2, "FL": 2, "MN": 2,
    "WI": 2, "MI": 2, "CO": 2, "VA": 1, "PA": 1, "NY": 1, "ND": 1,
}

HURRICANE_STATES = {
    "FL": 10, "TX": 8, "LA": 8, "NC": 6, "SC": 5, "AL": 4, "MS": 4,
    "GA": 3, "VA": 2, "NY": 1, "NJ": 1, "CT": 1, "MA": 1, "HI": 2,
}

WINTER_STORM_STATES = {
    "MN": 8, "WI": 7, "MI": 7, "NY": 6, "ME": 6, "VT": 6, "NH": 6,
    "MA": 5, "CT": 5, "PA": 5, "OH": 4, "IN": 4, "IL": 4, "IA": 4,
    "ND": 5, "SD": 5, "NE": 4, "CO": 5, "MT": 5, "WY": 5, "ID": 4,
    "WA": 3, "OR": 3, "WV": 3, "VA": 2, "MD": 2, "NJ": 2, "RI": 2,
    "MO": 2, "KS": 2, "KY": 2,
}

WILDFIRE_STATES = {
    "CA": 10, "OR": 6, "WA": 5, "MT": 5, "CO": 5, "AZ": 4, "NM": 4,
    "ID": 4, "NV": 3, "TX": 3, "UT": 3, "WY": 3, "OK": 2, "FL": 2,
    "GA": 1, "NC": 1, "TN": 1,
}

# Thunderstorm wind / hail / flash flood are broadly distributed
GENERAL_SEVERE_STATES = {
    "TX": 6, "OK": 5, "KS": 5, "NE": 4, "IA": 4, "MO": 4, "IL": 4,
    "IN": 3, "OH": 3, "AR": 3, "MS": 3, "AL": 3, "GA": 3, "TN": 3,
    "KY": 3, "CO": 3, "SD": 3, "MN": 3, "WI": 2, "MI": 2, "PA": 2,
    "NY": 2, "NC": 2, "SC": 2, "VA": 2, "FL": 2, "LA": 2, "NM": 1,
    "AZ": 1, "WV": 1, "MD": 1, "NJ": 1, "CT": 1, "MA": 1, "ND": 2,
}

# Monthly distribution weights per event type  (index 0 = Jan … 11 = Dec)
MONTH_WEIGHTS = {
    "Tornado":            [1, 2, 5, 9, 10, 8, 5, 3, 2, 2, 3, 1],
    "Thunderstorm Wind":  [1, 1, 3, 6, 9, 10, 10, 8, 5, 3, 2, 1],
    "Flash Flood":        [1, 1, 3, 5, 7, 9, 10, 9, 7, 5, 2, 1],
    "Hail":               [1, 1, 4, 8, 10, 10, 7, 5, 3, 2, 1, 1],
    "Winter Storm":       [10, 9, 7, 3, 1, 0, 0, 0, 0, 1, 5, 9],
    "Hurricane":          [0, 0, 0, 0, 0, 2, 3, 7, 10, 8, 3, 0],
    "Wildfire":           [1, 1, 2, 3, 4, 6, 8, 9, 10, 7, 3, 1],
}

# Flood causes for flash-flood events
FLOOD_CAUSES = [
    "Heavy Rain", "Heavy Rain / Burn Area",
    "Ice Jam", "Dam / Levee Break", "Planned Dam Release",
]
FLOOD_CAUSE_WEIGHTS = [0.70, 0.10, 0.08, 0.07, 0.05]

# County-zone placeholder names
COUNTY_NAMES = [
    "CENTRAL", "NORTHERN", "SOUTHERN", "EASTERN", "WESTERN",
    "DOWNTOWN", "METRO", "LAKE", "RIVER", "MOUNTAIN",
    "VALLEY", "PLAINS", "COASTAL", "RIDGE", "BASIN",
    "HIGHLAND", "CREEK", "PARK", "GROVE", "HILL",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _weighted_choice(options: dict, rng: np.random.Generator) -> str:
    """Pick a key from *options* with values as weights."""
    keys = list(options.keys())
    weights = np.array([options[k] for k in keys], dtype=float)
    weights /= weights.sum()
    return rng.choice(keys, p=weights)


def _pick_state(event_type: str, rng: np.random.Generator) -> str:
    """Select a state based on event-type affinity weights."""
    affinity = {
        "Tornado": TORNADO_STATES,
        "Hurricane": HURRICANE_STATES,
        "Winter Storm": WINTER_STORM_STATES,
        "Wildfire": WILDFIRE_STATES,
    }
    pool = affinity.get(event_type, GENERAL_SEVERE_STATES)
    return _weighted_choice(pool, rng)


def _pick_month(event_type: str, rng: np.random.Generator) -> int:
    """Return 1-indexed month obeying seasonal patterns."""
    weights = np.array(MONTH_WEIGHTS[event_type], dtype=float)
    weights /= weights.sum()
    return int(rng.choice(range(1, 13), p=weights))


def _random_coords(state: str, rng: np.random.Generator):
    """Return (lat, lon) within the state bounding box."""
    bbox = STATE_COORDS.get(state)
    if bbox is None:
        # Fallback to continental US center
        return round(rng.uniform(30.0, 45.0), 4), round(rng.uniform(-105.0, -80.0), 4)
    lat = round(rng.uniform(bbox[0], bbox[1]), 4)
    lon = round(rng.uniform(bbox[2], bbox[3]), 4)
    return lat, lon


def _format_damage(value: float) -> str:
    """Convert numeric damage to string like '25K' or '1.5M'."""
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"{value / 1_000:.0f}K"
    return f"{value:.0f}"


def _generate_damage(event_type: str, ef_scale: str, rng: np.random.Generator) -> float:
    """Generate a plausible property-damage dollar figure."""
    if event_type == "Tornado":
        scale_multipliers = {"EF0": 5e3, "EF1": 50e3, "EF2": 500e3,
                             "EF3": 5e6, "EF4": 50e6, "EF5": 200e6}
        base = scale_multipliers.get(ef_scale, 10e3)
        return float(rng.lognormal(np.log(base), 0.8))
    base_map = {
        "Thunderstorm Wind": 15e3,
        "Flash Flood": 100e3,
        "Hail": 20e3,
        "Winter Storm": 50e3,
        "Hurricane": 5e6,
        "Wildfire": 1e6,
    }
    base = base_map.get(event_type, 10e3)
    return float(rng.lognormal(np.log(base), 1.0))


def _generate_magnitude(event_type: str, rng: np.random.Generator) -> float:
    """Generate a magnitude value appropriate for the event type."""
    if event_type == "Thunderstorm Wind":
        # Wind speed in knots, 50-130
        return round(rng.lognormal(np.log(60), 0.25), 1)
    if event_type == "Hail":
        # Hail diameter in inches, 0.75-4.5
        return round(rng.lognormal(np.log(1.0), 0.4), 2)
    if event_type == "Hurricane":
        # Sustained wind in knots, 64-160+
        return round(rng.uniform(64, 160), 1)
    if event_type == "Wildfire":
        # Acres burned (rough proxy), 100-500000
        return round(rng.lognormal(np.log(5000), 1.2), 0)
    if event_type == "Winter Storm":
        # Snowfall inches
        return round(rng.lognormal(np.log(8), 0.5), 1)
    if event_type == "Flash Flood":
        # Rainfall inches
        return round(rng.lognormal(np.log(3), 0.4), 1)
    # Tornado — magnitude is captured via EF scale; return 0
    return 0.0


def _generate_casualties(event_type: str, ef_scale: str, rng: np.random.Generator):
    """Return (deaths, injuries) based on event severity."""
    # Most events have zero casualties
    if rng.random() > 0.12:
        return 0, 0
    death_rate = {"Tornado": 0.08, "Hurricane": 0.06, "Flash Flood": 0.07,
                  "Wildfire": 0.04, "Winter Storm": 0.03,
                  "Thunderstorm Wind": 0.02, "Hail": 0.005}
    injury_rate = {"Tornado": 0.20, "Hurricane": 0.15, "Flash Flood": 0.10,
                   "Wildfire": 0.08, "Winter Storm": 0.05,
                   "Thunderstorm Wind": 0.06, "Hail": 0.03}
    dr = death_rate.get(event_type, 0.01)
    ir = injury_rate.get(event_type, 0.03)
    # EF-scale amplifier for tornadoes
    if event_type == "Tornado":
        ef_num = int(ef_scale[-1])
        dr *= (1 + ef_num * 1.5)
        ir *= (1 + ef_num * 1.2)
    deaths = int(rng.poisson(dr * 10))
    injuries = int(rng.poisson(ir * 15))
    return deaths, injuries


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------

def generate_dataset(num_records: int = NUM_RECORDS, seed: int = SEED) -> pd.DataFrame:
    """Build the synthetic storm-events DataFrame."""
    rng = np.random.default_rng(seed)
    random.seed(seed)

    rows = []
    for _ in range(num_records):
        # Event type
        event_type = rng.choice(EVENT_TYPES, p=EVENT_WEIGHTS)

        # State
        state_abbr = _pick_state(event_type, rng)
        state_name = STATES[state_abbr]

        # Month (seasonal)
        month = _pick_month(event_type, rng)
        month_name = MONTH_NAMES[month - 1]

        # Day and year
        year = int(rng.choice(range(2010, 2025)))
        max_day = 28 if month == 2 else (30 if month in (4, 6, 9, 11) else 31)
        day = int(rng.integers(1, max_day + 1))

        # Time (HHMM, 24-hr)
        if event_type in ("Tornado", "Thunderstorm Wind", "Hail"):
            # Peak afternoon/evening
            _hw = np.array([1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4,
                 5, 6, 7, 8, 9, 9, 8, 6, 4, 3, 2, 1], dtype=float)
            hour = int(rng.choice(range(24), p=_hw / _hw.sum()))
        elif event_type == "Flash Flood":
            _hw = np.array([2, 2, 2, 2, 1, 1, 1, 2, 3, 3, 4, 5,
                 5, 6, 7, 7, 7, 6, 5, 4, 4, 3, 3, 2], dtype=float)
            hour = int(rng.choice(range(24), p=_hw / _hw.sum()))
        else:
            hour = int(rng.integers(0, 24))
        minute = int(rng.integers(0, 60))
        begin_time = f"{hour:02d}{minute:02d}"

        begin_yearmonth = f"{year}{month:02d}"

        # Coordinates
        begin_lat, begin_lon = _random_coords(state_abbr, rng)
        # End coordinates near begin for most events
        lat_offset = rng.normal(0, 0.15)
        lon_offset = rng.normal(0, 0.15)
        if event_type == "Tornado":
            lat_offset = rng.normal(0.05, 0.1)
            lon_offset = rng.normal(0.05, 0.1)
        end_lat = round(begin_lat + lat_offset, 4)
        end_lon = round(begin_lon + lon_offset, 4)

        # EF scale (tornado only)
        ef_scale = ""
        if event_type == "Tornado":
            ef_weights_norm = np.array(EF_WEIGHTS, dtype=float)
            ef_weights_norm /= ef_weights_norm.sum()
            ef_scale = rng.choice(EF_SCALES, p=ef_weights_norm)

        # Magnitude
        magnitude = _generate_magnitude(event_type, rng)

        # Damage
        damage_val = _generate_damage(event_type, ef_scale, rng)
        damage_property = _format_damage(damage_val)

        # Casualties
        deaths, injuries = _generate_casualties(event_type, ef_scale, rng)

        # Flood cause (flash flood only)
        flood_cause = ""
        if event_type == "Flash Flood":
            flood_cause = rng.choice(FLOOD_CAUSES, p=FLOOD_CAUSE_WEIGHTS)

        # County / zone name
        cz_name = rng.choice(COUNTY_NAMES)

        rows.append({
            "BEGIN_YEARMONTH": begin_yearmonth,
            "BEGIN_DAY": day,
            "BEGIN_TIME": begin_time,
            "STATE": state_name,
            "EVENT_TYPE": event_type,
            "CZ_NAME": cz_name,
            "BEGIN_LAT": begin_lat,
            "BEGIN_LON": begin_lon,
            "END_LAT": end_lat,
            "END_LON": end_lon,
            "TOR_F_SCALE": ef_scale,
            "MAGNITUDE": magnitude,
            "DEATHS_DIRECT": deaths,
            "INJURIES_DIRECT": injuries,
            "DAMAGE_PROPERTY": damage_property,
            "FLOOD_CAUSE": flood_cause,
            "MONTH_NAME": month_name,
        })

    df = pd.DataFrame(rows)
    return df


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    print("=" * 65)
    print("  WeatherWise — Synthetic Storm Events Data Generator")
    print("=" * 65)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    df = generate_dataset()

    df.to_csv(OUTPUT_PATH, index=False)
    print(f"\nGenerated {len(df):,} records -> {OUTPUT_PATH}")

    # Quick summary
    print("\nEvent-type distribution:")
    counts = df["EVENT_TYPE"].value_counts()
    for evt, cnt in counts.items():
        pct = cnt / len(df) * 100
        print(f"  {evt:<25s} {cnt:>5,}  ({pct:5.1f}%)")

    print(f"\nDate range : {df['BEGIN_YEARMONTH'].min()} – {df['BEGIN_YEARMONTH'].max()}")
    print(f"States     : {df['STATE'].nunique()}")
    print(f"Columns    : {list(df.columns)}")
    print("\nDone.")


if __name__ == "__main__":
    main()
