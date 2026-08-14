package com.weatherwise.service;

import com.weatherwise.algorithm.GeometricIntersection;
import com.weatherwise.algorithm.SafeRouteOptimizer;
import com.weatherwise.algorithm.TravelerRiskScorer;
import com.weatherwise.entity.RiskAssessmentLogEntity;
import com.weatherwise.entity.SafeLocationEntity;
import com.weatherwise.entity.StormCellEntity;
import com.weatherwise.entity.TravelerSessionEntity;
import com.weatherwise.entity.WeatherAlertEntity;
import com.weatherwise.model.*;
import com.weatherwise.repository.SafeLocationRepository;
import com.weatherwise.repository.StormCellRepository;
import com.weatherwise.resolver.StormCellResolver;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

@Service
@Slf4j
public class RiskScoringService {

    private static final double MILES_TO_METERS = 1609.344;
    private static final double DEFAULT_RADIUS_MILES = 50.0;

    private final TravelerRiskScorer riskScorer;
    private final SafeRouteOptimizer routeOptimizer;
    private final StormCellRepository stormCellRepository;
    private final SafeLocationRepository safeLocationRepository;
    private final RiskLogBuffer riskLogBuffer;
    private final StormCellResolver stormCellResolver;
    private final NWSAlertService nwsAlertService;
    private final MLPredictionService mlPredictionService;
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    public RiskScoringService(TravelerRiskScorer riskScorer,
                              SafeRouteOptimizer routeOptimizer,
                              StormCellRepository stormCellRepository,
                              SafeLocationRepository safeLocationRepository,
                              RiskLogBuffer riskLogBuffer,
                              StormCellResolver stormCellResolver,
                              NWSAlertService nwsAlertService,
                              MLPredictionService mlPredictionService) {
        this.riskScorer = riskScorer;
        this.routeOptimizer = routeOptimizer;
        this.stormCellRepository = stormCellRepository;
        this.safeLocationRepository = safeLocationRepository;
        this.riskLogBuffer = riskLogBuffer;
        this.stormCellResolver = stormCellResolver;
        this.nwsAlertService = nwsAlertService;
        this.mlPredictionService = mlPredictionService;
    }

    public RiskAssessment computeFullRisk(double lat, double lon, double heading,
                                          double speedMph, TravelerSessionEntity session) {
        TravelerPosition position = TravelerPosition.builder()
                .lat(lat).lon(lon)
                .heading(heading).speedMph(speedMph)
                .timestamp(Instant.now().toString())
                .build();

        double radiusMeters = DEFAULT_RADIUS_MILES * MILES_TO_METERS;

        // Get storms from DB
        List<StormCellEntity> stormEntities = stormCellRepository.findActiveStormsWithinRadius(
                lat, lon, radiusMeters);
        List<StormCell> storms = stormEntities.stream()
                .map(stormCellResolver::toModel).toList();

        // Get safe locations
        List<SafeLocationEntity> safeEntities = safeLocationRepository.findNearestSafeLocations(
                lat, lon, radiusMeters);
        List<SafeLocation> safeLocations = safeEntities.stream()
                .map(e -> toSafeLocationModel(e, lat, lon)).toList();

        // Fetch NWS alerts (read-through cache backed by the DB)
        List<WeatherAlertEntity> activeAlerts = List.of();
        try {
            activeAlerts = nwsAlertService.getActiveAlerts(lat, lon, DEFAULT_RADIUS_MILES);
        } catch (Exception e) {
            log.debug("NWS fetch skipped: {}", e.getMessage());
        }

        // Determine nighttime
        int hour = Instant.now().atZone(ZoneId.of("America/New_York")).getHour();
        boolean isNighttime = hour >= 20 || hour < 6;

        // Compute base risk
        RiskAssessment risk = riskScorer.computeRisk(position, storms, safeLocations, isNighttime);

        // ML enhancement
        try {
            MLPredictionService.MLPrediction mlPrediction = mlPredictionService.predict(
                    lat, lon, Instant.now().atZone(ZoneId.of("America/New_York")).getMonthValue(),
                    hour, isNighttime, 0.0, 0.0);

            if (mlPrediction != null && mlPrediction.confidence() > 0.7) {
                double mlMultiplier = 1.0;
                if ("TORNADO".equals(mlPrediction.hazardType()) && mlPrediction.probability() > 0.6) {
                    mlMultiplier = 1.2;
                } else if ("FLASH_FLOOD".equals(mlPrediction.hazardType()) && mlPrediction.probability() > 0.6) {
                    mlMultiplier = 1.15;
                }
                if (mlMultiplier > 1.0) {
                    double adjustedScore = Math.min(100.0, risk.getOverallScore() * mlMultiplier);
                    risk.setOverallScore(adjustedScore);
                }
            }
        } catch (Exception e) {
            log.debug("ML prediction skipped: {}", e.getMessage());
        }

        // An active NWS warning polygon containing the position sets a floor —
        // a live warning must never be reported below its tier.
        applyAlertFloor(risk, activeAlerts, lat, lon);

        // Log asynchronously — batched inserts, never on the hot path
        if (session != null) {
            riskLogBuffer.offer(RiskAssessmentLogEntity.builder()
                    .travelerSession(session)
                    .overallScore(risk.getOverallScore())
                    .tier(risk.getTier())
                    .timeToIntersectionMinutes(risk.getTimeToIntersectionMinutes())
                    .recommendedAction(risk.getRecommendedAction())
                    .hazardType(risk.getHazardType())
                    .alertMessage(risk.getAlertMessage())
                    .computedAt(Instant.now())
                    .build());
        }

        return risk;
    }

    private void applyAlertFloor(RiskAssessment risk, List<WeatherAlertEntity> alerts,
                                 double lat, double lon) {
        if (alerts.isEmpty()) {
            return;
        }
        Point position = geometryFactory.createPoint(
                new org.locationtech.jts.geom.Coordinate(lon, lat));
        boolean inTornado = false;
        boolean inAny = false;
        for (WeatherAlertEntity alert : alerts) {
            if (alert.getPolygon() != null && alert.getPolygon().contains(position)) {
                inAny = true;
                if (alert.getHazardType() == HazardType.TORNADO) {
                    inTornado = true;
                }
            }
        }
        if (inTornado && risk.getOverallScore() < 70.0) {
            risk.setOverallScore(70.0);
            risk.setTier(AlertTier.IMMEDIATE_DANGER);
            risk.setHazardType(HazardType.TORNADO);
            risk.setAlertMessage(
                    "Active NWS tornado warning covers your location. Seek sturdy shelter immediately.");
        } else if (inAny && risk.getOverallScore() < 35.0) {
            risk.setOverallScore(35.0);
            if (risk.getTier() == AlertTier.MONITORING || risk.getTier() == AlertTier.ADVISORY) {
                risk.setTier(AlertTier.ACTION_REQUIRED);
            }
        }
    }

    private SafeLocation toSafeLocationModel(SafeLocationEntity entity, double fromLat, double fromLon) {
        double dist = GeometricIntersection.haversineDistance(
                fromLat, fromLon, entity.getLocation().getY(), entity.getLocation().getX());
        return SafeLocation.builder()
                .name(entity.getName())
                .locationType(entity.getLocationType())
                .lat(entity.getLocation().getY())
                .lon(entity.getLocation().getX())
                .distanceMiles(Math.round(dist * 10.0) / 10.0)
                .hasIndoorShelter(entity.getHasIndoorShelter())
                .exitNumber(entity.getExitNumber())
                .build();
    }
}
