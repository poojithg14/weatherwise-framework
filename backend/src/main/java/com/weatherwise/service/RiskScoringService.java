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
import com.weatherwise.repository.RiskAssessmentLogRepository;
import com.weatherwise.repository.SafeLocationRepository;
import com.weatherwise.repository.StormCellRepository;
import com.weatherwise.resolver.StormCellResolver;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

@Service
@Slf4j
public class RiskScoringService {

    private static final double MILES_TO_METERS = 1609.344;

    @Value("${weatherwise.risk.storm-radius-miles:50.0}")
    private double stormRadiusMiles;

    private final TravelerRiskScorer riskScorer;
    private final SafeRouteOptimizer routeOptimizer;
    private final StormCellRepository stormCellRepository;
    private final SafeLocationRepository safeLocationRepository;
    private final RiskAssessmentLogRepository riskLogRepository;
    private final StormCellResolver stormCellResolver;
    private final NWSAlertService nwsAlertService;
    private final MLPredictionService mlPredictionService;

    public RiskScoringService(TravelerRiskScorer riskScorer,
                              SafeRouteOptimizer routeOptimizer,
                              StormCellRepository stormCellRepository,
                              SafeLocationRepository safeLocationRepository,
                              RiskAssessmentLogRepository riskLogRepository,
                              StormCellResolver stormCellResolver,
                              NWSAlertService nwsAlertService,
                              MLPredictionService mlPredictionService) {
        this.riskScorer = riskScorer;
        this.routeOptimizer = routeOptimizer;
        this.stormCellRepository = stormCellRepository;
        this.safeLocationRepository = safeLocationRepository;
        this.riskLogRepository = riskLogRepository;
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

        double radiusMeters = stormRadiusMiles * MILES_TO_METERS;

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

        // Fetch live NWS alerts and merge into storms list
        try {
            List<WeatherAlertEntity> liveAlerts = nwsAlertService.getActiveAlerts(lat, lon, stormRadiusMiles);
            for (WeatherAlertEntity alert : liveAlerts) {
                String stormId = "nws-" + alert.getAlertId();
                boolean alreadyPresent = storms.stream().anyMatch(s -> stormId.equals(s.getId()));
                if (!alreadyPresent && alert.getPolygon() != null) {
                    org.locationtech.jts.geom.Point centroid = alert.getPolygon().getCentroid();
                    storms = new java.util.ArrayList<>(storms);
                    storms.add(StormCell.builder()
                            .id(stormId)
                            .lat(centroid.getY())
                            .lon(centroid.getX())
                            .velocityX(10.0)
                            .velocityY(10.0)
                            .vil(40.0)
                            .rotation(0.0)
                            .hazardType(alert.getHazardType())
                            .build());
                }
            }
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

        // Log to DB if session exists
        if (session != null) {
            try {
                riskLogRepository.save(RiskAssessmentLogEntity.builder()
                        .travelerSession(session)
                        .overallScore(risk.getOverallScore())
                        .tier(risk.getTier())
                        .timeToIntersectionMinutes(risk.getTimeToIntersectionMinutes())
                        .recommendedAction(risk.getRecommendedAction())
                        .hazardType(risk.getHazardType())
                        .alertMessage(risk.getAlertMessage())
                        .computedAt(Instant.now())
                        .build());
            } catch (Exception e) {
                log.warn("Failed to log risk assessment: {}", e.getMessage());
            }
        }

        return risk;
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
