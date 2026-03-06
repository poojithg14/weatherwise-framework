package com.weatherwise.service;

import com.weatherwise.entity.StormCellEntity;
import com.weatherwise.entity.TravelerSessionEntity;
import com.weatherwise.entity.WeatherAlertEntity;
import com.weatherwise.model.HazardType;
import com.weatherwise.repository.StormCellRepository;
import com.weatherwise.repository.TravelerSessionRepository;
import com.weatherwise.repository.WeatherAlertRepository;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@Slf4j
public class AlertIngestionService {

    private static final int SRID = 4326;
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), SRID);

    private final NWSAlertService nwsAlertService;
    private final WeatherAlertRepository weatherAlertRepository;
    private final StormCellRepository stormCellRepository;
    private final TravelerSessionRepository travelerSessionRepository;

    @Value("${weatherwise.ingestion.radius-miles:75.0}")
    private double radiusMiles;

    @Value("${weatherwise.ingestion.corridors:37.09,-84.08;38.04,-84.50;37.75,-84.29}")
    private String corridorPoints;

    public AlertIngestionService(NWSAlertService nwsAlertService,
                                 WeatherAlertRepository weatherAlertRepository,
                                 StormCellRepository stormCellRepository,
                                 TravelerSessionRepository travelerSessionRepository) {
        this.nwsAlertService = nwsAlertService;
        this.weatherAlertRepository = weatherAlertRepository;
        this.stormCellRepository = stormCellRepository;
        this.travelerSessionRepository = travelerSessionRepository;
    }

    /**
     * Poll NWS for active alerts every 2 minutes.
     * Persists new alerts and creates corresponding storm cells.
     */
    @Transactional
    @Scheduled(fixedDelay = 120_000, initialDelay = 30_000)
    public void ingestAlerts() {
        log.info("Starting NWS alert ingestion cycle...");
        Set<String> pollingLocations = gatherPollingLocations();
        int newAlerts = 0;
        int newStorms = 0;

        for (String locKey : pollingLocations) {
            String[] parts = locKey.split(",");
            double lat = Double.parseDouble(parts[0]);
            double lon = Double.parseDouble(parts[1]);

            try {
                List<WeatherAlertEntity> fetched = nwsAlertService.getActiveAlerts(lat, lon, radiusMiles);
                for (WeatherAlertEntity alert : fetched) {
                    // Skip if already persisted
                    if (weatherAlertRepository.findByAlertId(alert.getAlertId()).isPresent()) {
                        continue;
                    }

                    // Persist the alert
                    weatherAlertRepository.save(alert);
                    newAlerts++;

                    // Convert to storm cell
                    String stormId = "nws-" + alert.getAlertId();
                    if (stormCellRepository.findByStormId(stormId).isEmpty()) {
                        StormCellEntity storm = convertAlertToStorm(alert, stormId);
                        stormCellRepository.save(storm);
                        newStorms++;
                    }
                }
            } catch (Exception e) {
                log.debug("NWS fetch failed for ({}, {}): {}", lat, lon, e.getMessage());
            }
        }

        log.info("Ingestion complete: {} new alerts, {} new storm cells", newAlerts, newStorms);
    }

    /**
     * Expire stale alerts and storms every 5 minutes.
     */
    @Transactional
    @Scheduled(fixedDelay = 300_000, initialDelay = 60_000)
    public void expireStaleData() {
        Instant now = Instant.now();
        int expiredAlerts = 0;
        int expiredStorms = 0;

        for (WeatherAlertEntity alert : weatherAlertRepository.findByActiveTrue()) {
            if (alert.getExpirationTime().isBefore(now)) {
                alert.setActive(false);
                weatherAlertRepository.save(alert);
                expiredAlerts++;
            }
        }

        for (StormCellEntity storm : stormCellRepository.findByActiveTrue()) {
            if (storm.getExpiresAt().isBefore(now)) {
                storm.setActive(false);
                stormCellRepository.save(storm);
                expiredStorms++;
            }
        }

        if (expiredAlerts > 0 || expiredStorms > 0) {
            log.info("Expired {} alerts and {} storm cells", expiredAlerts, expiredStorms);
        }
    }

    private Set<String> gatherPollingLocations() {
        Set<String> locations = new HashSet<>();

        // Add configured corridor points
        if (corridorPoints != null && !corridorPoints.isBlank()) {
            for (String point : corridorPoints.split(";")) {
                String trimmed = point.trim();
                if (!trimmed.isEmpty()) {
                    locations.add(trimmed);
                }
            }
        }

        // Add active traveler session locations
        try {
            for (TravelerSessionEntity session : travelerSessionRepository.findByActiveTrue()) {
                Point loc = session.getLastKnownLocation();
                if (loc != null) {
                    locations.add(String.format("%.2f,%.2f", loc.getY(), loc.getX()));
                }
            }
        } catch (Exception e) {
            log.debug("Could not fetch traveler sessions: {}", e.getMessage());
        }

        return locations;
    }

    private StormCellEntity convertAlertToStorm(WeatherAlertEntity alert, String stormId) {
        // Derive center from polygon centroid
        org.locationtech.jts.geom.Point centroid = alert.getPolygon().getCentroid();
        Point stormCenter = geometryFactory.createPoint(new Coordinate(centroid.getX(), centroid.getY()));

        // Default kinematics based on hazard type
        double vx, vy, vil, rotation;
        switch (alert.getHazardType()) {
            case TORNADO -> { vx = 20.0; vy = 18.0; vil = 65.0; rotation = 25.0; }
            case SEVERE_THUNDERSTORM -> { vx = 15.0; vy = 12.0; vil = 45.0; rotation = 5.0; }
            case FLASH_FLOOD -> { vx = 0.0; vy = 0.0; vil = 50.0; rotation = 0.0; }
            case WINTER_STORM -> { vx = 10.0; vy = 8.0; vil = 20.0; rotation = 0.0; }
            case HURRICANE -> { vx = 12.0; vy = 10.0; vil = 55.0; rotation = 15.0; }
            case WILDFIRE_SMOKE -> { vx = 8.0; vy = 5.0; vil = 0.0; rotation = 0.0; }
            default -> { vx = 10.0; vy = 10.0; vil = 30.0; rotation = 0.0; }
        }

        // Build predicted path from polygon shifted by velocity
        String predictedPathJson = buildPredictedPath(alert.getPolygon(), vx, vy);

        Instant expiresAt = alert.getExpirationTime() != null
                ? alert.getExpirationTime()
                : Instant.now().plus(2, ChronoUnit.HOURS);

        return StormCellEntity.builder()
                .stormId(stormId)
                .location(stormCenter)
                .velocityX(vx)
                .velocityY(vy)
                .vil(vil)
                .rotation(rotation)
                .hazardType(alert.getHazardType())
                .predictedPathJson(predictedPathJson)
                .active(true)
                .createdAt(Instant.now())
                .expiresAt(expiresAt)
                .build();
    }

    private String buildPredictedPath(Polygon polygon, double vx, double vy) {
        // Shift polygon centroid by velocity increments (15-min, 30-min, 45-min)
        org.locationtech.jts.geom.Point centroid = polygon.getCentroid();
        double baseLat = centroid.getY();
        double baseLon = centroid.getX();

        // Approximate: 1 degree lat ≈ 69 miles, 1 degree lon ≈ 55 miles at 37°N
        double latPerMin = (vy / 60.0) / 69.0;
        double lonPerMin = (vx / 60.0) / 55.0;

        Instant now = Instant.now();
        StringBuilder sb = new StringBuilder("[");
        int[] offsets = {15, 30, 45};
        for (int i = 0; i < offsets.length; i++) {
            double shiftLat = latPerMin * offsets[i];
            double shiftLon = lonPerMin * offsets[i];
            Instant time = now.plus(offsets[i], ChronoUnit.MINUTES);

            // Create shifted polygon vertices from original polygon envelope
            Envelope env = polygon.getEnvelopeInternal();
            double halfW = (env.getMaxX() - env.getMinX()) / 2;
            double halfH = (env.getMaxY() - env.getMinY()) / 2;
            double cLat = baseLat + shiftLat;
            double cLon = baseLon + shiftLon;

            if (i > 0) sb.append(",");
            sb.append(String.format("""
                    {"time":"%s","vertices":[{"lat":%.4f,"lon":%.4f},{"lat":%.4f,"lon":%.4f},{"lat":%.4f,"lon":%.4f},{"lat":%.4f,"lon":%.4f}]}""",
                    time,
                    cLat + halfH, cLon - halfW,
                    cLat + halfH, cLon + halfW,
                    cLat - halfH, cLon + halfW,
                    cLat - halfH, cLon - halfW));
        }
        sb.append("]");
        return sb.toString();
    }
}
