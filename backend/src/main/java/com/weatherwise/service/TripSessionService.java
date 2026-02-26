package com.weatherwise.service;

import com.weatherwise.entity.RiskAssessmentLogEntity;
import com.weatherwise.entity.TravelerSessionEntity;
import com.weatherwise.model.Coordinate;
import com.weatherwise.model.RiskAssessment;
import com.weatherwise.repository.RiskAssessmentLogRepository;
import com.weatherwise.repository.TravelerSessionRepository;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class TripSessionService {

    private final TravelerSessionRepository sessionRepository;
    private final RiskAssessmentLogRepository riskLogRepository;
    private final RouteService routeService;
    private final RiskScoringService riskScoringService;
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), 4326);

    public TripSessionService(TravelerSessionRepository sessionRepository,
                              RiskAssessmentLogRepository riskLogRepository,
                              RouteService routeService,
                              RiskScoringService riskScoringService) {
        this.sessionRepository = sessionRepository;
        this.riskLogRepository = riskLogRepository;
        this.routeService = routeService;
        this.riskScoringService = riskScoringService;
    }

    public TripResult startTrip(double fromLat, double fromLon, double toLat, double toLon) {
        // Create session
        TravelerSessionEntity session = TravelerSessionEntity.builder()
                .sessionToken(UUID.randomUUID().toString())
                .lastKnownLocation(geometryFactory.createPoint(
                        new org.locationtech.jts.geom.Coordinate(fromLon, fromLat)))
                .heading(0.0)
                .speedMph(0.0)
                .lastUpdated(Instant.now())
                .active(true)
                .build();
        session = sessionRepository.save(session);

        // Fetch route
        RouteService.RouteResult route = routeService.getRoute(fromLat, fromLon, toLat, toLon);

        return new TripResult(
                session.getId().toString(),
                route.waypoints(),
                route.distanceMiles(),
                route.estimatedMinutes()
        );
    }

    public RiskAssessment updatePosition(String sessionId, double lat, double lon,
                                         double heading, double speedMph) {
        TravelerSessionEntity session = sessionRepository.findById(UUID.fromString(sessionId))
                .orElseThrow(() -> new RuntimeException("Session not found: " + sessionId));

        session.setLastKnownLocation(geometryFactory.createPoint(
                new org.locationtech.jts.geom.Coordinate(lon, lat)));
        session.setHeading(heading);
        session.setSpeedMph(speedMph);
        session.setLastUpdated(Instant.now());
        sessionRepository.save(session);

        return riskScoringService.computeFullRisk(lat, lon, heading, speedMph, session);
    }

    public TripSummaryResult endTrip(String sessionId) {
        TravelerSessionEntity session = sessionRepository.findById(UUID.fromString(sessionId))
                .orElseThrow(() -> new RuntimeException("Session not found: " + sessionId));

        session.setActive(false);
        sessionRepository.save(session);

        List<RiskAssessmentLogEntity> logs = riskLogRepository
                .findByTravelerSessionIdOrderByComputedAtDesc(session.getId());

        double maxRisk = logs.stream()
                .mapToDouble(RiskAssessmentLogEntity::getOverallScore)
                .max().orElse(0.0);

        List<String> actions = logs.stream()
                .map(l -> l.getRecommendedAction().name())
                .distinct().toList();

        return new TripSummaryResult(0.0, 0.0, maxRisk, logs.size(), actions);
    }

    public record TripResult(String sessionId, List<Coordinate> waypoints,
                              double distanceMiles, double estimatedMinutes) {}

    public record TripSummaryResult(double totalDistanceMiles, double totalTimeMinutes,
                                     double maxRiskScore, int alertsReceived,
                                     List<String> actionsRecommended) {}
}
