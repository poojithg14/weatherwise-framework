# WeatherWise - AI-Enhanced Multi-Hazard Severe Weather Alert & Rerouting Framework

An AI-powered system that provides personalized, trajectory-aware severe weather alerts and dynamic safe-route recommendations for highway travelers. Translates aviation convective weather avoidance concepts (CWAM) to ground transportation.

## Architecture

WeatherWise is built as a four-layer system:

```
Layer 1: Data Ingestion
  NWS Alert Poller → GPS Telemetry → Road Network DB (PostGIS)

Layer 2: GraphQL Fusion Layer (Netflix DGS / Spring Boot)
  Single endpoint serving all weather + routing + risk data
  WebSocket subscriptions for real-time risk updates

Layer 3: AI Engine
  XGBoost Hazard Classifier → 5-Component Risk Scorer → A* Safe Route Optimizer

Layer 4: Alert & Rerouting (React PWA)
  4-Tier Alert System (Monitoring → Advisory → Action Required → Immediate Danger)
  Dynamic map with storm tracking, safe locations, alternate routes
```

### Core Algorithm

The risk scoring engine adapts MIT Lincoln Lab's CWAM from aviation to highway vehicles. Five orthogonal sub-scores are combined as a weighted sum:

```
R = 0.25*PROXIMITY + 0.30*INTERSECTION + 0.20*SEVERITY + 0.15*EXPOSURE + 0.10*ESCAPE_OPTIONS
```

- **PROXIMITY**: Logarithmic decay of distance to nearest hazard corridor
- **INTERSECTION**: Forward-projection collision detection at 5-min intervals
- **SEVERITY**: Categorical hazard danger mapping (tornado=1.0, flash flood=0.85, etc.)
- **EXPOSURE**: Estimated minutes inside hazard corridor without evasive action
- **ESCAPE_OPTIONS**: Inverse availability of nearby safe exits

Tier mapping: R < 0.3 = ADVISORY, 0.3-0.7 = ACTION_REQUIRED, >= 0.7 = IMMEDIATE_DANGER

## Project Structure

```
weatherwise-framework/
├── backend/                    # Java 17 / Spring Boot 3.3 + GraphQL (Netflix DGS)
│   ├── src/main/java/com/weatherwise/
│   │   ├── algorithm/          # Core risk scoring & route optimization
│   │   ├── entity/             # JPA entities (PostGIS geometries)
│   │   ├── repository/         # Spatial repositories
│   │   ├── service/            # NWS ingestion, risk scoring, routing, ML client
│   │   ├── resolver/           # GraphQL DGS resolvers
│   │   └── config/             # Spring configuration
│   └── src/main/resources/schema/schema.graphqls
├── frontend/                   # React 18 + Vite + Leaflet + Tailwind CSS
├── ml/                         # Python ML pipeline (XGBoost) + Flask serving
│   ├── download_noaa_data.py   # Real NOAA storm-events training data
│   ├── train_model.py
│   └── ml_service.py           # Prediction service on :5000
├── evaluation/                 # Evaluation harness
└── run_all_tests.sh
```

## Prerequisites

- Java 17+ (OpenJDK recommended)
- Maven 3.9+ (or use the included Maven wrapper)
- Node.js 18+ and npm
- Python 3.9+
- **PostgreSQL 14+ with the PostGIS extension** (backend requirement)

```bash
createdb weatherwise
psql weatherwise -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
```

Database connection is configured via environment variables `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` (see `backend/src/main/resources/application.yml` for defaults).

## Setup & Run

### Backend (Spring Boot + GraphQL)

```bash
cd backend
bash mvnw spring-boot:run          # Linux/Mac
mvnw.cmd spring-boot:run           # Windows CMD
```

The GraphQL endpoint will be available at `http://localhost:8080/graphql`.
GraphiQL IDE is available at `http://localhost:8080/graphiql` (dev profile only).

### ML Prediction Service

```bash
cd ml
pip install -r requirements.txt
python download_noaa_data.py       # fetch NOAA storm events training data
python train_model.py              # trains and writes all model artifacts to ml/models/
python ml_service.py               # serves predictions on :5000
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173`. The scenario player works standalone with mock data — no backend required.

### Run All Tests

```bash
bash run_all_tests.sh
```

## GraphQL API Examples

### Query: Traveler Risk Assessment

```graphql
{
  travelerSafety(lat: 38.25, lon: -85.76, heading: 270, speedMph: 70) {
    overallScore
    tier
    timeToIntersectionMinutes
    recommendedAction
    hazardType
    alertMessage
    hazardSpecificGuidance
  }
}
```

### Query: Active Weather Alerts

```graphql
{
  activeAlerts(lat: 38.25, lon: -85.76, radiusMiles: 50) {
    id
    type
    severity
    polygon { lat lon }
    effectiveTime
    expirationTime
  }
}
```

### Subscription: Real-Time Risk Updates

```graphql
subscription {
  riskUpdates(lat: 38.25, lon: -85.76, heading: 270, speedMph: 70) {
    overallScore
    tier
    alertMessage
    recommendedAction
  }
}
```

## Case Study (Demo Scenario)

The mock data simulates a tornado event near Louisville, KY on I-64. A tornado-warned supercell tracks NE at 35 mph across Shelby and Oldham counties, crossing I-64 between exits 28 and 35. The demo walks through:

1. Early detection lead time ahead of the warning polygon reaching the route
2. Automatic reroute recommendation via US-60 south or I-71/KY-53 north
3. Escalating alert tiers as the tornado approaches
4. Specific safe shelter recommendations along the corridor

## Disclaimer

WeatherWise is a research project provided for informational purposes only.
It is **not** a substitute for official warnings from the National Weather
Service or directions from local authorities. Weather data, risk scores, and
route recommendations may be incomplete, delayed, or wrong — never rely on
this software for life-safety decisions, and never interact with it while
driving. Map data © OpenStreetMap contributors; weather data courtesy of
NOAA/NWS (this project is not affiliated with or endorsed by NOAA).

## License

Apache License 2.0 — see [LICENSE](LICENSE).
