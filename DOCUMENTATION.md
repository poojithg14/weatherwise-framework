# WeatherWise: AI-Enhanced Framework for Real-Time Multi-Hazard Severe Weather Alerting and Dynamic Rerouting for Highway Travelers

## Complete Project Documentation

---

## Table of Contents

1. [What is WeatherWise?](#1-what-is-weatherwise)
2. [Why Are We Building This?](#2-why-are-we-building-this)
3. [System Architecture](#3-system-architecture)
4. [Backend Design](#4-backend-design)
5. [Machine Learning Pipeline](#5-machine-learning-pipeline)
6. [Frontend Design](#6-frontend-design)
7. [Evaluation Framework](#7-evaluation-framework)
8. [Data Flow](#8-data-flow)
9. [How to Run](#9-how-to-run)
10. [File Structure](#10-file-structure)

---

## 1. What is WeatherWise?

WeatherWise is a real-time severe weather alerting and dynamic rerouting system designed specifically for **highway travelers**. It answers a simple but life-critical question:

> "Does this storm threaten MY specific route, WHEN will it arrive, and WHAT should I do about it?"

The system continuously monitors a traveler's GPS position against active storm cells, computes geometric storm-path intersection probabilities, and generates **personalized four-tier alerts** (Monitoring, Advisory, Action Required, Immediate Danger) with specific exit recommendations and shelter locations.

### What Makes It Different from Existing Systems

| Feature | WEA (Wireless Emergency Alerts) | Weather Apps (AccuWeather, etc.) | WeatherWise |
|---------|--------------------------------|----------------------------------|-------------|
| Route-specific alerts | No (county-level) | No (location-pinned) | Yes |
| Storm trajectory analysis | No | No | Yes |
| Dynamic rerouting | No | No | Yes |
| Shelter/exit guidance | No | No | Yes |
| Highway traveler focus | No | No | Yes |
| Requires special hardware | No | No | No |

### Core Capabilities

1. **GraphQL Data Fusion** - Consolidates weather alerts, storm cell tracking, safe location queries, and route risk assessments into single-request transactions
2. **XGBoost Multi-Hazard Classifier** - Trained on 315,217 NOAA Storm Events records to classify six hazard types using pre-event features only
3. **CWAM-Adapted Risk Scoring** - Composite risk algorithm adapted from MIT Lincoln Laboratory's Convective Weather Avoidance Model (aviation) to highway vehicles
4. **Four-Tier Alert System** - Graduated alerts from passive monitoring to immediate danger with tier-appropriate audio, visual, and action guidance

---

## 2. Why Are We Building This?

### The Problem

On May 16, 2025, an EF-4 tornado struck London, Kentucky, crossing Interstate 75 and killing 19 people. The lead author was driving on I-75 that evening and received Wireless Emergency Alerts (WEA) that said "Tornado Warning in this area" --- but those alerts provided:

- **No information** about the storm's trajectory relative to the highway
- **No estimate** of when or where the storm would cross the route
- **No guidance** on which exits to take or where to find shelter

A highway traveler moving at 70 mph receives the **same generic message** as a resident in their basement --- despite facing a fundamentally different risk profile: exposed, mobile, unfamiliar with local shelter options, and navigating at speeds that change their relationship to the threat every minute.

### The Gap

- Weather-related crashes account for ~21% of all U.S. vehicle crashes (~5,000 fatalities/year)
- Average NWS tornado warning lead time is 14-16 minutes --- at 70 mph, that's under 20 miles of travel
- WEA messages are county-level, binary (warn/no-warn), and lack route-specific context
- Commercial weather apps show weather data as passive overlays without analyzing the user's trajectory relative to approaching threats
- No existing consumer application provides real-time storm-trajectory-relative analysis for moving highway travelers

### Our Solution

WeatherWise bridges this gap by adapting MIT Lincoln Lab's CWAM (originally for aviation corridor analysis) to highway travel, combining:
- ML-based hazard classification
- Geometric storm-path intersection analysis
- Personalized four-tier alerts with specific rerouting guidance

---

## 3. System Architecture

WeatherWise implements a **four-layer architecture** designed for low-latency, real-time severe weather alerting:

```
+------------------------------------------------------------------+
|                      FRONTEND LAYER                               |
|  React 18 + Vite 5 + Leaflet 1.9 + Apollo Client 3.9            |
|  - Interactive map with storm cells, routes, shelters             |
|  - Risk gauge + alert banners + audio alerts                      |
|  - Demo mode (7 scenarios) + Real mode (GPS tracking)             |
+----------------------------+-------------------------------------+
                             |
                      GraphQL (HTTP + WebSocket)
                             |
+----------------------------v-------------------------------------+
|                      API LAYER                                    |
|  Spring Boot 3.3.5 + Netflix DGS 9.1.2 (GraphQL)                |
|  - 5 Queries: travelerSafety, activeAlerts, safeLocations,       |
|               alternateRoutes, stormCells                         |
|  - 3 Mutations: startTrip, updatePosition, endTrip               |
|  - 1 Subscription: riskUpdates (WebSocket, 5-sec push)           |
+----------------------------+-------------------------------------+
                             |
+----------------------------v-------------------------------------+
|                   BACKEND SERVICES LAYER                          |
|  - TravelerRiskScorer: 5-factor composite risk algorithm          |
|  - SafeRouteOptimizer: A* pathfinding avoiding hazard corridors   |
|  - GeometricIntersection: Haversine, point-in-polygon, ray-cast  |
|  - NWSAlertService: Live NWS API integration + caching            |
|  - MLPredictionService: Flask ML service client                   |
|  - RouteService: OSRM routing integration                         |
|  - TripSessionService: Trip lifecycle management                  |
+----------------------------+-------------------------------------+
                             |
+----------------------------v-------------------------------------+
|                   DATA & ML LAYER                                 |
|  - PostgreSQL 15 + PostGIS (JPA entities with JTS geometries)     |
|  - Flask ML Service (XGBoost model, /predict endpoint)            |
|  - NOAA Storm Events (315,217 records, 2020-2025)                 |
|  - DataSeeder: I-75 corridor mock data (London KY tornado)        |
+------------------------------------------------------------------+
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18, Vite 5, Leaflet 1.9, Apollo Client 3.9, TailwindCSS 3.4 | SPA with interactive map |
| API | Spring Boot 3.3.5, Netflix DGS 9.1.2 | GraphQL endpoint |
| Backend | Java 17, Lombok | Risk scoring, routing, services |
| ML | Python 3.11, XGBoost 2.0, scikit-learn 1.3, Flask 3.0 | Hazard classification |
| Data | PostgreSQL, Hibernate Spatial (JTS) | Geospatial persistence |
| External | NWS API, OSRM | Weather data, route computation |

---

## 4. Backend Design

### 4.1 Package Structure

```
backend/src/main/java/com/weatherwise/
├── algorithm/           # Core algorithms (risk scoring, routing, geometry)
│   ├── TravelerRiskScorer.java      (636 lines) - CWAM-adapted risk engine
│   ├── SafeRouteOptimizer.java      (584 lines) - A* pathfinding
│   └── GeometricIntersection.java   (334 lines) - Haversine, point-in-polygon
├── config/              # Spring configuration
│   ├── AppConfig.java               - RestTemplate bean
│   ├── CorsConfig.java              - CORS for localhost:5173
│   ├── DataSeeder.java    (365 lines) - I-75 corridor seed data
│   └── WebSocketConfig.java         - WebSocket support
├── entity/              # JPA entities (PostgreSQL tables)
│   ├── StormCellEntity.java         - Storm cells with JTS Point geometry
│   ├── WeatherAlertEntity.java      - NWS alerts with JTS Polygon
│   ├── SafeLocationEntity.java      - Shelters/exits with JTS Point
│   ├── RoadSegmentEntity.java       - Highway segments with JTS LineString
│   ├── TravelerSessionEntity.java   - Active trip sessions
│   └── RiskAssessmentLogEntity.java - Risk assessment audit trail
├── model/               # Domain models (GraphQL-mapped, Lombok @Data @Builder)
│   ├── HazardType.java              - TORNADO, HURRICANE, FLASH_FLOOD, etc.
│   ├── AlertTier.java               - MONITORING, ADVISORY, ACTION_REQUIRED, IMMEDIATE_DANGER
│   ├── ActionType.java              - CONTINUE_MONITORING, REROUTE, EXIT_TO_SHELTER, etc.
│   ├── RiskAssessment.java          - Composite risk result object
│   ├── StormCell.java               - Storm cell with predicted path polygons
│   └── ... (Coordinate, SafeLocation, AlternateRoute, etc.)
├── repository/          # Spring Data JPA interfaces with PostGIS queries
│   ├── StormCellRepository.java     - ST_DWithin spatial queries
│   ├── WeatherAlertRepository.java  - ST_Contains point-in-polygon
│   ├── SafeLocationRepository.java  - Nearest-location queries
│   └── ... (RoadSegment, TravelerSession, RiskAssessmentLog)
├── resolver/            # Netflix DGS GraphQL resolvers
│   ├── TravelerSafetyResolver.java  - travelerSafety query
│   ├── StormCellResolver.java       - stormCells query + entity-to-model conversion
│   ├── WeatherAlertResolver.java    - activeAlerts query
│   ├── SafeLocationResolver.java    - safeLocations query (with shelter prioritization)
│   ├── AlternateRouteResolver.java  - alternateRoutes query (A* routing)
│   ├── TripResolver.java            - startTrip/updatePosition/endTrip mutations
│   ├── RiskUpdatesSubscriptionResolver.java - WebSocket subscription
│   └── MockDataProvider.java        - Static demo data (Louisville tornado scenario)
└── service/             # Business logic services
    ├── RiskScoringService.java      - Full pipeline (storms + alerts + ML enhancement)
    ├── NWSAlertService.java         - Live NWS API client with 60s cache
    ├── MLPredictionService.java     - Flask ML service client
    ├── RouteService.java            - OSRM routing client with 5-min cache
    └── TripSessionService.java      - Trip lifecycle (start, update, end)
```

### 4.2 Core Algorithm: Composite Risk Score

The heart of WeatherWise is the **TravelerRiskScorer**, which adapts MIT Lincoln Lab's CWAM from aviation to highway vehicles. It computes a composite risk score as a weighted sum of five normalized sub-scores:

```
R = 0.25 * PROXIMITY + 0.30 * INTERSECTION + 0.20 * SEVERITY + 0.15 * EXPOSURE + 0.10 * ESCAPE_OPTIONS
```

#### Sub-Score Definitions

**1. Proximity (weight = 0.25)**
How close is the nearest hazard?

```
P = max(0, 1 - log10(distance + 1) / log10(51))
```

- Uses Haversine great-circle distance to nearest storm polygon boundary
- Logarithmic decay: high sensitivity close up (< 1 mile = ~1.0), smoothly approaches 0 at 50 miles
- Checks both storm center and all predicted path polygon boundaries

**2. Intersection Probability (weight = 0.30) --- Highest weight**
Will the storm cross my route?

```
I = 1.0                          if intersection within 15 min
I = 1.0 - (t_cross - 15) / 45   if 15 < t_cross < 60 min
I = 0.0                          if no intersection within 60 min
```

This is the most important factor because trajectory-relative position is more predictive than raw distance. A storm 10 miles away moving parallel poses far less risk than a storm 30 miles away heading directly toward the route.

**How it works:**
- Projects the traveler's position forward at 5-minute intervals for 60 minutes using heading + speed
- Projects each storm polygon forward using the storm's velocity vector
- Tests if the projected traveler position falls inside any projected storm polygon (ray-casting point-in-polygon)
- Returns the earliest intersection time

**3. Severity (weight = 0.20)**
How dangerous is this type of hazard?

| Hazard Type | Score | Rationale |
|-------------|-------|-----------|
| TORNADO | 1.00 | EF3+ direct life threat |
| HURRICANE | 0.95 | Cat 3+ direct life threat |
| FLASH_FLOOD | 0.80 | #1 cause of weather deaths |
| SEVERE_THUNDERSTORM | 0.75 | Large hail, damaging wind |
| WILDFIRE_SMOKE | 0.70 | Near-zero visibility risk |
| WINTER_STORM | 0.55 | Reduced traction, visibility |

**4. Exposure (weight = 0.15)**
How long will I be inside the hazard zone if I take no action?

```
E = min(1.0, minutes_inside_hazard / 30)
```

- Projects traveler forward at 1-minute intervals for 60 minutes
- Counts how many intervals fall inside any storm polygon
- Normalized by 30 minutes (> 30 min exposure caps at 1.0)

**5. Escape Options (weight = 0.10)**
How many safe exits are nearby?

| Condition | Score |
|-----------|-------|
| 3+ exits within 5 miles | 0.1 (low risk) |
| 1-2 exits within 5 miles | 0.3 |
| Exits within 10 miles only | 0.6 |
| Exits within 15 miles only | 0.9 |
| Nothing within 15 miles | 1.0 (high risk) |

#### Nighttime Adjustment

If nighttime (8 PM - 6 AM), INTERSECTION and SEVERITY sub-scores are multiplied by 1.15 (capped at 1.0) to reflect increased risk from reduced visibility and slower reaction times.

### 4.3 Four-Tier Alert System

The composite score maps to four alert tiers:

| Tier | Score Range | Color | Audio | Action |
|------|------------|-------|-------|--------|
| MONITORING | R < 0.25 | Green | None | Continue driving, system is watching |
| ADVISORY | 0.25 <= R < 0.50 | Yellow | Gentle chime | Review exits ahead |
| ACTION_REQUIRED | 0.50 <= R < 0.75 | Orange | Alert tone + speech | Take specific exit, reroute |
| IMMEDIATE_DANGER | R >= 0.75 | Red | Siren pattern + speech | EXIT NOW or shelter in vehicle |

#### Action Decision Matrix

```
MONITORING/ADVISORY --> CONTINUE_MONITORING (keep driving, system monitors)

ACTION_REQUIRED:
  + Safe exit within 5 mi with clear route --> REROUTE
  + Safe location nearby but route blocked --> EXIT_TO_SHELTER
  + Nothing nearby                        --> PULL_OVER

IMMEDIATE_DANGER:
  + Exit within 2 mi --> EXIT_TO_SHELTER ("Go inside to interior room immediately")
  + No exit          --> EMERGENCY_SHELTER_IN_VEHICLE ("Seatbelt ON. Head below windows.")
```

### 4.4 Safe Route Optimizer (A* Pathfinding)

The SafeRouteOptimizer finds the safest highway route that avoids predicted storm corridors:

**Graph Structure:**
- Nodes = highway exits/waypoints (lat, lon, name, isShelter flag)
- Edges = road segments (distance, speed limit, weather danger score)

**Cost Function:**
```
g(n) = sum(distance / speedLimit * 60 + 10000 * weatherDanger)
h(n) = haversineDistance / 70 * 60  (optimistic driving time estimate)
f(n) = g(n) + h(n)
```

The DANGER_PENALTY of 10,000 makes hazard avoidance extremely high priority --- the algorithm will take a much longer safe route over a short dangerous one.

**Weather Danger Scoring per Edge:**
- 1.0 if the road segment intersects a predicted hazard corridor polygon
- 0.3 if within 5 miles of a hazard but doesn't directly intersect
- 0.0 if clear

### 4.5 GraphQL Schema

```graphql
# --- Queries (5) ---
travelerSafety(lat, lon, heading, speedMph) --> RiskAssessment
activeAlerts(lat, lon, radiusMiles)          --> [WeatherAlert]
safeLocations(lat, lon, radiusMiles)         --> [SafeLocation]
alternateRoutes(from, to, avoidHazards)      --> [AlternateRoute]
stormCells(lat, lon, radiusMiles)            --> [StormCell]

# --- Mutations (3) ---
startTrip(from, to)                    --> TripSession (sessionId, route, ETA)
updatePosition(sessionId, lat, lon...) --> RiskAssessment (real-time risk)
endTrip(sessionId)                     --> TripSummary (stats)

# --- Subscription (1) ---
riskUpdates(lat, lon, heading, speedMph) --> RiskAssessment (WebSocket, every 5s)
```

A single GraphQL query can request ALL data types simultaneously:
```graphql
{
  travelerSafety(lat: 37.09, lon: -84.08, heading: 180, speedMph: 70) {
    overallScore
    tier
    alertMessage
    recommendedAction
    hazardSpecificGuidance
  }
  activeAlerts(lat: 37.09, lon: -84.08, radiusMiles: 50) {
    id type severity
  }
  stormCells(lat: 37.09, lon: -84.08, radiusMiles: 50) {
    id lat lon hazardType velocityX velocityY
  }
  safeLocations(lat: 37.09, lon: -84.08, radiusMiles: 50) {
    name distanceMiles exitNumber hasIndoorShelter
  }
}
```

This consolidation reduces what would be 5 separate REST calls into 1 GraphQL request, achieving a **72.9% mean latency reduction** (2.0 ms vs 7.3 ms, measured over 1,000 iterations).

### 4.6 External Service Integration

| Service | Purpose | Fallback |
|---------|---------|----------|
| NWS API (api.weather.gov) | Live weather alerts, GeoJSON parsing | Cached alerts in DB, then seeded data |
| OSRM (project-osrm.org) | Real highway route computation | Straight-line route with Haversine distance |
| ML Service (localhost:5000) | XGBoost hazard classification | NWS severity-based scoring only |

All external services have graceful degradation --- the system never crashes if a service is unavailable.

---

## 5. Machine Learning Pipeline

### 5.1 Overview

The ML pipeline trains a multi-hazard classifier to predict severe weather event types from pre-event atmospheric and geographic features. This classification enhances the risk scoring engine with probabilistic hazard identification.

```
NOAA Storm Events DB (315,217 records, 2020-2025)
         |
    download_noaa_data.py (download + clean + synthetic fallback)
         |
    train_model.py (feature engineering + model training + evaluation)
         |
    models/weatherwise_model.joblib (serialized XGBoost classifier)
         |
    ml_service.py (Flask REST API serving predictions)
         |
    Backend MLPredictionService.java (Java client)
```

### 5.2 Data Source

**NOAA Storm Events Database** --- catalogs significant weather events reported by NWS forecast offices across all U.S. states and territories.

- **315,217 records** from 2020-2025
- Raw data: 51 columns per record (event type, location, time, magnitude, damage)
- Downloaded from NOAA bulk CSV archives with smart retry logic
- Synthetic fallback: if download fails, generates realistic synthetic data calibrated to real distributions

### 5.3 Six Hazard Classes

| Class | Records | % | Mapped From |
|-------|---------|---|-------------|
| Severe Thunderstorm | 197,706 | 62.7% | Thunderstorm Wind, Hail, Lightning, Strong Wind, High Wind |
| Winter Storm | 58,443 | 18.5% | Winter Storm, Blizzard, Ice Storm, Heavy Snow, Winter Weather |
| Flash Flood | 45,351 | 14.4% | Flash Flood, Flood |
| Tornado | 9,404 | 3.0% | Tornado |
| Wildfire | 2,190 | 0.7% | Wildfire |
| Hurricane | 2,123 | 0.7% | Hurricane, Tropical Storm, Tropical Depression |

Class imbalance (93:1 ratio) handled via inverse-frequency sample weighting during training.

### 5.4 Feature Engineering (20 Features)

**Critical Design Decision: NO post-event data leakage.** All features represent information available BEFORE or DURING the event, never outcomes.

**Excluded (would cause leakage):** deaths, injuries, property damage, crop damage, tornado F-scale

**Temporal Features (6):**
- month_sin, month_cos --- cyclical encoding: sin(2pi * month/12), cos(2pi * month/12)
- hour_sin, hour_cos --- cyclical encoding: sin(2pi * hour/24), cos(2pi * hour/24)
- is_nighttime --- binary (hour in [21-24, 0-5])
- season --- categorical (0=winter, 1=spring, 2=summer, 3=fall)

**Geographic Features (6):**
- latitude, longitude
- lat_lon_interaction (lat * lon)
- lat_squared, lon_squared (non-linear geographic effects)
- state_encoded (LabelEncoder)

**Real-Time Feature (1):**
- magnitude --- Doppler radar measurement (wind speed in kts or hail diameter in inches)

**Synthetic Radar-Proxy Features (7):**

These 7 features are generated from Gaussian distributions calibrated to published observational ranges, NOT from real NEXRAD radar data:

| Feature | Tornado | Flash Flood | Winter Storm | Unit |
|---------|---------|-------------|--------------|------|
| CAPE | N(3500, 800) | N(2000, 600) | N(200, 100) | J/kg |
| Wind Shear | N(55, 15) | N(20, 10) | N(35, 10) | kts |
| VIL | N(50, 15) | N(35, 10) | N(15, 8) | kg/m2 |
| Rotation | N(0.70, 0.15) | N(0.10, 0.05) | N(0.05, 0.03) | - |
| Echo Top | N(14, 2) | N(10, 2) | N(7, 2) | km |
| Surface Pressure | N(1000, 8) | N(1008, 5) | N(1020, 8) | hPa |
| Dewpoint Depression | N(5, 3) | N(3, 2) | N(12, 5) | C |

**Important caveat:** Because these features are sampled from class-conditional distributions, they contain idealized class-separating signal. The reported F1 = 0.996 is an upper bound; production performance on real radar data would be lower.

### 5.5 Model Training & Results

Three models compared:

| Model | Accuracy | Weighted F1 | Macro F1 | 5-Fold CV |
|-------|----------|-------------|----------|-----------|
| **XGBoost** | **0.996** | **0.996** | **0.957** | **0.9960 +/- 0.0003** |
| Random Forest | 0.991 | 0.991 | 0.941 | 0.992 +/- 0.001 |
| Logistic Regression | 0.976 | 0.977 | 0.857 | 0.976 +/- 0.002 |

**XGBoost Hyperparameters** (tuned via RandomizedSearchCV, 30 iterations):
- n_estimators: 100-500
- max_depth: 4-10
- learning_rate: 0.01-0.30
- subsample: 0.6-1.0
- colsample_bytree: 0.6-1.0

### 5.6 Ablation Study

| Configuration | Weighted F1 | Change | Impact |
|---------------|------------|--------|--------|
| All 20 features (baseline) | 0.996 | --- | --- |
| w/o Magnitude | 0.953 | -0.043 | **Critical** |
| w/o ALL Radar (7 features) | 0.972 | -0.024 | **High** |
| w/o Rotation | 0.992 | -0.004 | Moderate |
| w/o Temporal/Spatial/CAPE/Shear/VIL | 0.994-0.995 | -0.001 to -0.002 | Low |

Magnitude is the single most important feature (63% of XGBoost's total gain).

### 5.7 ML Service (Flask API)

The trained model is served via a Flask REST API:

```
POST /predict
{
  "latitude": 37.09, "longitude": -84.08,
  "month": 5, "hour": 23, "state": "KY",
  "rotation": 0.7, "vil": 50
}

Response:
{
  "hazard_type": "TORNADO",
  "probability": 0.85,
  "severity_estimate": "EF1-EF2",
  "confidence": 0.87,
  "contributing_factors": ["High rotation", "High CAPE"]
}
```

The backend's `RiskScoringService` calls this endpoint and applies a risk multiplier (1.2x for high-confidence tornado predictions) to enhance the base risk score.

---

## 6. Frontend Design

### 6.1 Overview

React 18 single-page application with two operating modes:

- **Demo Mode** --- 7 pre-configured severe weather scenarios with scripted timelines
- **Real Mode** --- GPS tracking with live backend risk assessment every 10 seconds

### 6.2 Page Structure

```
App.jsx (React Router)
├── / --> HomePage.jsx         (Trip initialization)
├── /trip --> TripPage.jsx     (Active trip monitoring)
└── /summary --> SummaryPage.jsx  (Post-trip statistics)
```

### 6.3 Component Architecture

```
TripPage.jsx (Main trip view)
├── WeatherMap.jsx (Full-screen Leaflet map)
│   ├── RouteLayer.jsx        (Completed/safe/danger route segments)
│   ├── StormCellLayer.jsx    (Storm cells with predicted paths)
│   ├── TravelerMarker.jsx    (Blue arrow with pulse ring)
│   └── Shelter markers       (Green home icons)
├── DangerOverlay.jsx         (Pulsing red border when IMMEDIATE_DANGER)
├── AlertBanner.jsx           (Tier-specific alert with action buttons)
├── RiskGauge.jsx             (Circular progress meter, 0-100%)
└── InfoPanel.jsx             (Elapsed time, hazards, shelters, routes)

HomePage.jsx
├── DemoModeToggle.jsx        (Switch between demo/real modes)
├── ScenarioSelector.jsx      (7 demo scenario cards)
└── LocationInput.jsx         (Geocoding search via Nominatim)
```

### 6.4 Seven Demo Scenarios

| # | Scenario | Hazard | Region | Key Features |
|---|----------|--------|--------|--------------|
| 1 | London KY Tornado | TORNADO | I-75, KY | EF-4 crossing highway, 13 timeline events, full tier escalation |
| 2 | Hurricane Helene | HURRICANE | I-40, NC | Remnant flooding, wide-area impact |
| 3 | TX Flash Flood | FLASH_FLOOD | I-35, TX | Hill Country flooding, rapid onset |
| 4 | Winter Storm Elliott | BLIZZARD | I-90, NY | Blizzard conditions, reduced visibility |
| 5 | OR Wildfire Smoke | WILDFIRE | I-5, OR | Smoke hazard, near-zero visibility |
| 6 | Multi-Hazard | MULTIPLE | Coastal | Simultaneous tornado + flash flood |
| 7 | All Clear | NONE | General | Baseline normal conditions |

Each scenario includes scripted timeline events that trigger alert escalations, storm cell appearances, shelter recommendations, and route changes at specific minute marks during the simulated trip.

### 6.5 Demo Mode Data Flow

```
1. User selects scenario on HomePage
2. Navigate to /trip with scenario data
3. useTripSimulation hook starts 1-second interval (1 sec = 1 min travel)
4. Each tick:
   a. Advance position along route (interpolated by distance)
   b. Find active timeline event (last event where minutesMark <= currentMinute)
   c. Update state: tier, riskScore, stormCells, shelters, alternateRoute
5. useAudioAlerts plays tier-appropriate sounds on tier change
6. UI components render from shared state
7. Trip ends when route distance is covered
```

### 6.6 Real Mode Data Flow

```
1. User enters origin/destination on HomePage
2. Fetch routes from OSRM (up to 3 alternatives)
3. User selects route, navigates to /trip
4. On mount: START_TRIP mutation --> backend returns sessionId + route
5. GPS tracking: navigator.geolocation.watchPosition every 5 seconds
6. Every 10 seconds: UPDATE_POSITION mutation with current lat/lon/heading/speed
7. Backend computes risk --> returns RiskAssessment
8. UI updates with real risk data (tier, score, storms, shelters)
9. On "End Trip": END_TRIP mutation --> navigate to /summary with stats
```

### 6.7 Alert Experience

**MONITORING (Green):**
- Subtle green text: "All clear. Monitoring conditions along your route."
- No audio

**ADVISORY (Yellow):**
- Yellow banner with message about developing weather
- Gentle 440 Hz chime

**ACTION_REQUIRED (Orange):**
- Orange banner: "Tornado-producing storm will cross your route in ~20 minutes"
- Action button: "REROUTE" or "EXIT HIGHWAY"
- Shelter card: nearest exit with indoor shelter
- Alternate route card: distance, ETA, safety score
- 660 Hz + 880 Hz tones, then speech synthesis reads the alert

**IMMEDIATE_DANGER (Red):**
- Full-screen pulsing red border overlay
- Red banner: "TORNADO DANGER. EXIT NOW at Pilot Travel Center (0.8 mi)"
- Action button: "TAKE COVER" or "SEEK SHELTER"
- Alarm loop: 6 alternating 440/880 Hz pulses every 30 seconds
- Speech synthesis reads the alert at max urgency

---

## 7. Evaluation Framework

### 7.1 Methodology Transparency

A core principle: every metric is explicitly categorized as **Measured** or **Estimated**.

| Category | Metric | Confidence |
|----------|--------|------------|
| **Measured** | ML classification (F1, AUC, per-class) | High |
| **Measured** | GraphQL latency (1,000 iterations) | High (localhost) |
| **Measured** | NWS API integration (live queries) | High |
| **Estimated** | Lead time advantage (Monte Carlo) | Medium |

### 7.2 Evaluation Scripts

| Script | Purpose | Method |
|--------|---------|--------|
| `train_model.py` | ML model training + evaluation | 5-fold CV, ablation, 7 figures |
| `historical_simulation.py` | Lead time estimation for 5 events | Monte Carlo (n=1000/event) |
| `real_benchmark.py` | GraphQL latency benchmarking | 1,000 iterations + concurrency scaling |
| `live_weather_test.py` | Live NWS API integration test | Real-time alert retrieval + parsing |
| `generate_paper_figures.py` | 7 architectural/design figures | matplotlib at 300 DPI |
| `run_all.py` | Master orchestrator | Runs all above scripts in sequence |

### 7.3 Key Results

**GraphQL Performance (Measured):**

| Metric | Combined Query | 5 Separate Queries | Reduction |
|--------|---------------|-------------------|-----------|
| Mean latency | 2.0 ms | 7.3 ms | 72.9% |
| P95 latency | 3.0 ms | 11.8 ms | 74.6% |
| P99 latency | 6.9 ms | 29.2 ms | 76.4% |
| Payload size | 0.9 KB | 1.5 KB | 40.0% |
| 100 concurrent users | 23.7 ms | 236.7 ms | 90.0% |

**Lead Time Advantage (Estimated, Monte Carlo):**

| Event | WeatherWise | NWS/WEA | Advantage | 95% CI |
|-------|-------------|---------|-----------|--------|
| London KY EF-4 Tornado | 36.9 min | 40 min | -3.1 min | [27, 46] |
| Hurricane Helene | 44.3 min | 30 min | +14.3 min | [28, 60] |
| TX Flash Flood | 35.2 min | 15 min | +20.2 min | [21, 49] |
| Winter Storm Elliott | 60.0 min | 30 min | +30.0 min | [42, 80] |
| OR Wildfire Smoke | 39.8 min | 5 min | +34.8 min | [20, 60] |
| **Average** | **43.2 min** | **24.0 min** | **+19.2 min** | --- |

Note: For the London KY event, the NWS provided ~40 min lead time (well above average). WeatherWise's advantage there is **information quality** (route-specific trajectory + exit guidance), not lead time.

---

## 8. Data Flow

### 8.1 Complete System Data Flow

```
                    ┌──────────────────┐
                    │  NWS API         │
                    │ api.weather.gov  │
                    └────────┬─────────┘
                             │ GeoJSON alerts
                             v
┌──────────────┐    ┌────────────────────┐    ┌──────────────┐
│ OSRM Router  │--->│   Spring Boot      │<---│ Flask ML     │
│ Route Engine │    │   Backend          │    │ Service      │
└──────────────┘    │                    │    │ /predict     │
                    │  ┌──────────────┐  │    └──────────────┘
                    │  │Risk Scorer   │  │
                    │  │(CWAM-adapted)│  │
                    │  └──────────────┘  │
                    │  ┌──────────────┐  │
                    │  │A* Router     │  │
                    │  │(Safe routes) │  │
                    │  └──────────────┘  │
                    │  ┌──────────────┐  │
                    │  │DGS GraphQL   │  │
                    │  │Resolvers     │  │
                    │  └──────┬───────┘  │
                    └─────────┼──────────┘
                              │ GraphQL (HTTP + WebSocket)
                              v
                    ┌──────────────────────┐
                    │  React Frontend      │
                    │  ┌────────────────┐  │
                    │  │ Leaflet Map    │  │  - Storm cells
                    │  │ Route layers   │  │  - Route segments (safe/danger)
                    │  │ Shelter markers│  │  - Traveler position
                    │  └────────────────┘  │
                    │  ┌────────────────┐  │
                    │  │ Alert Banner   │  │  - Tier-specific actions
                    │  │ Risk Gauge     │  │  - Shelter/route suggestions
                    │  │ Audio Alerts   │  │  - Siren/speech for danger
                    │  └────────────────┘  │
                    └──────────────────────┘
```

### 8.2 Risk Assessment Pipeline (per 10-second cycle)

```
1. GPS position update (lat, lon, heading, speed)
2. Fetch active storms within 50-mile radius (PostGIS ST_DWithin)
3. Fetch safe locations within 50-mile radius
4. Fetch NWS alerts (cached 60 seconds)
5. For EACH storm cell:
   a. Compute PROXIMITY: log-decay of Haversine distance to nearest polygon edge
   b. Compute INTERSECTION: forward-project both traveler & storm at 5-min steps
   c. Compute SEVERITY: categorical hazard-type coefficient
   d. Compute EXPOSURE: count minutes traveler stays inside hazard polygon
   e. Compute ESCAPE_OPTIONS: count safe exits within 5/10/15 mile bands
   f. Apply nighttime multiplier (1.15x on INTERSECTION and SEVERITY)
   g. Composite = 0.25P + 0.30I + 0.20S + 0.15E + 0.10O
6. Select WORST storm (highest composite score)
7. Optional: ML enhancement (1.2x for high-confidence tornado prediction)
8. Map score to tier: <0.25=MONITORING, <0.50=ADVISORY, <0.75=ACTION, >=0.75=DANGER
9. Determine action: CONTINUE/REROUTE/EXIT/PULL_OVER/SHELTER_IN_VEHICLE
10. Generate human-readable alert message with hazard-specific guidance
11. Log assessment to DB (audit trail)
12. Return RiskAssessment to frontend via GraphQL
```

---

## 9. How to Run

### Prerequisites

- Java 17 (Temurin 17.0.6+)
- Node.js 18+
- Python 3.11+
- PostgreSQL 15 (optional --- app runs with seeded data)

### Backend

```bash
cd backend
bash mvnw spring-boot:run
# Runs on http://localhost:8080
# GraphiQL UI: http://localhost:8080/graphiql
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### ML Service

```bash
cd ml
pip install -r requirements.txt
python download_noaa_data.py    # Download NOAA data (or generate synthetic)
python train_model.py           # Train XGBoost model
python ml_service.py            # Start Flask API on port 5000
```

### Run Evaluation Suite

```bash
cd evaluation
pip install -r requirements.txt
python run_all.py               # Runs all evaluations
# Or individually:
python historical_simulation.py
python real_benchmark.py        # Requires backend running
python live_weather_test.py     # Requires internet
```

### Run Tests

```bash
cd backend
bash mvnw test
# 39 tests: 19 GeometricIntersection + 8 TravelerRiskScorer + 5 EndToEnd + 7 SafeRouteOptimizer
```

---

## 10. File Structure

```
weatherwise-framework/
├── backend/                              # Java Spring Boot backend
│   ├── pom.xml                           # Maven config (SB 3.3.5, DGS 9.1.2)
│   ├── mvnw, mvnw.cmd                   # Maven wrapper
│   └── src/
│       ├── main/
│       │   ├── java/com/weatherwise/
│       │   │   ├── WeatherwiseApplication.java    # Entry point
│       │   │   ├── algorithm/
│       │   │   │   ├── TravelerRiskScorer.java     # 5-factor risk engine (636 lines)
│       │   │   │   ├── SafeRouteOptimizer.java     # A* pathfinding (584 lines)
│       │   │   │   └── GeometricIntersection.java  # Haversine, point-in-polygon (334 lines)
│       │   │   ├── config/
│       │   │   │   ├── AppConfig.java              # RestTemplate bean
│       │   │   │   ├── CorsConfig.java             # CORS for frontend
│       │   │   │   ├── DataSeeder.java             # I-75 seed data (365 lines)
│       │   │   │   └── WebSocketConfig.java        # WebSocket support
│       │   │   ├── entity/                         # 6 JPA entities
│       │   │   ├── model/                          # 12 domain models + enums
│       │   │   ├── repository/                     # 6 Spring Data JPA repos
│       │   │   ├── resolver/                       # 8 DGS GraphQL resolvers
│       │   │   └── service/                        # 5 business services
│       │   └── resources/
│       │       ├── application.yml                 # Server + DB + API config
│       │       └── schema/schema.graphqls          # GraphQL schema (145 lines)
│       └── test/                                   # 39 unit + integration tests
│
├── frontend/                              # React SPA
│   ├── package.json                       # Dependencies (React, Apollo, Leaflet)
│   ├── vite.config.js                     # Vite config with GraphQL proxy
│   └── src/
│       ├── main.jsx                       # Entry (ApolloProvider + BrowserRouter)
│       ├── App.jsx                        # Routes (/, /trip, /summary)
│       ├── index.css                      # Dark theme + animations (219 lines)
│       ├── components/
│       │   ├── WeatherMap.jsx             # Leaflet map container
│       │   ├── AlertBanner.jsx            # Tier-specific alert UI
│       │   ├── RiskGauge.jsx              # Circular risk meter
│       │   ├── InfoPanel.jsx              # Trip telemetry sidebar
│       │   ├── DangerOverlay.jsx          # Pulsing red border
│       │   ├── StormCellLayer.jsx         # Storm visualization
│       │   ├── LocationInput.jsx          # Geocoding search
│       │   ├── ScenarioSelector.jsx       # Demo scenario picker
│       │   ├── DemoModeToggle.jsx         # Demo/real switch
│       │   └── Map/
│       │       ├── RouteLayer.jsx         # Multi-segment route
│       │       └── TravelerMarker.jsx     # Animated traveler icon
│       ├── pages/
│       │   ├── HomePage.jsx               # Trip initialization
│       │   ├── TripPage.jsx               # Active trip monitoring (320 lines)
│       │   └── SummaryPage.jsx            # Post-trip stats
│       ├── scenarios/                     # 7 demo scenario data files
│       ├── hooks/
│       │   ├── useTripSimulation.js       # Demo mode simulation (198 lines)
│       │   ├── useAudioAlerts.js          # Multi-tier sounds (82 lines)
│       │   └── useGeocoding.js            # Location search
│       ├── graphql/
│       │   ├── client.js                  # Apollo Client config
│       │   └── queries.js                 # GraphQL operations
│       └── utils/
│           ├── routing.js                 # OSRM route fetching
│           └── geocoding.js               # Nominatim integration
│
├── ml/                                    # Machine Learning pipeline
│   ├── requirements.txt                   # Pinned dependencies
│   ├── train_model.py                     # Training pipeline (776 lines)
│   ├── ml_service.py                      # Flask prediction API (374 lines)
│   ├── download_noaa_data.py              # NOAA data download (846 lines)
│   ├── generate_synthetic_data.py         # Synthetic data gen (411 lines)
│   ├── data/                              # NOAA CSV data
│   ├── models/                            # Trained model artifacts (.joblib)
│   ├── figures/                           # ML evaluation plots
│   └── results/                           # JSON metrics
│
├── evaluation/                            # Evaluation suite
│   ├── requirements.txt                   # Dependencies
│   ├── run_all.py                         # Master orchestrator (233 lines)
│   ├── historical_simulation.py           # Lead time Monte Carlo (724 lines)
│   ├── real_benchmark.py                  # GraphQL benchmarking (665 lines)
│   ├── live_weather_test.py               # Live NWS integration (620 lines)
│   ├── generate_paper_figures.py          # Design figures (574 lines)
│   ├── figures/                           # All evaluation figures
│   └── results/                           # JSON results
│
└── paper/                                 # IEEE Access LaTeX paper
    └── weatherwise_ieee_access.tex        # Main paper (916 lines)
```

---

## Summary

WeatherWise is a complete, working framework that demonstrates how existing weather data (NWS alerts, storm cell tracking) can be transformed into **route-specific, actionable safety guidance** for highway travelers. The system combines:

1. **CWAM-adapted risk scoring** (5-factor composite algorithm)
2. **XGBoost hazard classification** (trained on 315K real NOAA records)
3. **GraphQL data fusion** (72.9% latency reduction over REST)
4. **A* safe routing** (hazard-avoiding pathfinding)
5. **Four-tier graduated alerts** (MONITORING through IMMEDIATE_DANGER)
6. **Rich interactive UI** (Leaflet maps, audio alerts, shelter guidance)
7. **Comprehensive evaluation** (measured + estimated metrics with full transparency)

The key insight: existing weather alerts tell travelers THAT danger exists, but not WHETHER it threatens THEIR specific route, WHEN it will arrive, or WHAT they should do about it. WeatherWise fills that gap.
