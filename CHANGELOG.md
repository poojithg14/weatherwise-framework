# Changelog

All notable changes to WeatherWise are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-06-01

### Added
- 4-layer pipeline: Data Ingestion, Risk Assessment, Alert Generation, User Interface
- XGBoost multi-hazard classifier (6 types: tornado, severe thunderstorm, flash flood, winter storm, hurricane, wildfire)
- 5-component risk scoring engine (proximity, intersection, severity, exposure, escape)
- 4-tier alert classification (CLEAR, WATCH, WARNING, CRITICAL)
- Real-time NWS alert ingestion with geospatial processing (PostGIS)
- GraphQL API with Netflix DGS (queries, mutations, subscriptions)
- WebSocket subscriptions for real-time risk push
- Dynamic rerouting via OSRM integration
- React 18 frontend with Leaflet map, audio alerts, danger overlays
- Simulation dashboard with 24 US highway corridors
- ML training pipeline with NOAA Storm Events data (315,217 records)
- Historical event evaluation framework (5 benchmark events)
- Docker Compose deployment (Spring Boot + PostGIS + ML + Frontend)
- Azure Container Apps deployment manifests
- GitHub Actions CI pipeline (backend, frontend, ML, Docker)
- Research & Technology showcase page
- Professional error boundary and 404 page

### Performance
- 99.57% ML classification accuracy (macro-F1: 97.82%)
- 1.97ms mean alert latency (72.9% reduction vs. baseline)
- 24.8 min mean lead time advantage over NWS public alerts

### Documentation
- Research paper: "WeatherWise: AI-Enhanced Framework for Real-Time Multi-Hazard Severe Weather Alerting and Dynamic Rerouting for Highway Travelers"
- Comprehensive technical documentation (DOCUMENTATION.md)
- Evaluation results with paper-quality figures (300 DPI)
