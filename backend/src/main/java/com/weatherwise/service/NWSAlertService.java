package com.weatherwise.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weatherwise.entity.TravelerSessionEntity;
import com.weatherwise.entity.WeatherAlertEntity;
import com.weatherwise.model.HazardType;
import com.weatherwise.repository.TravelerSessionRepository;
import com.weatherwise.repository.WeatherAlertRepository;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class NWSAlertService {

    private static final int SRID = 4326;
    private static final long CACHE_TTL_MS = 60_000;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final WeatherAlertRepository alertRepository;
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), SRID);

    @Value("${nws.api.base-url}")
    private String nwsBaseUrl;

    @Value("${nws.api.user-agent}")
    private String userAgent;

    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    private final TravelerSessionRepository sessionRepository;

    public NWSAlertService(RestTemplate restTemplate, ObjectMapper objectMapper,
                           WeatherAlertRepository alertRepository,
                           TravelerSessionRepository sessionRepository) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
        this.alertRepository = alertRepository;
        this.sessionRepository = sessionRepository;
    }

    public List<WeatherAlertEntity> getActiveAlerts(double lat, double lon, double radiusMiles) {
        maybeRefresh(lat, lon);
        double radiusMeters = radiusMiles * 1609.344;
        return alertRepository.findActiveAlertsWithinRadius(lat, lon, radiusMeters);
    }

    /** Fetch from NWS at most once per TTL per grid cell, persisting what comes back. */
    private void maybeRefresh(double lat, double lon) {
        String cacheKey = String.format("%.2f,%.2f", lat, lon);
        CacheEntry cached = cache.get(cacheKey);
        if (cached != null && System.currentTimeMillis() - cached.timestamp < CACHE_TTL_MS) {
            return;
        }
        try {
            List<WeatherAlertEntity> fetched = fetchFromNWS(lat, lon);
            persist(fetched);
            cache.put(cacheKey, new CacheEntry(fetched, System.currentTimeMillis()));
        } catch (Exception e) {
            log.warn("NWS refresh failed, serving persisted alerts: {}", e.getMessage());
        }
    }

    /** Upsert by NWS alert id so repeated polls never duplicate rows. */
    private void persist(List<WeatherAlertEntity> fetched) {
        for (WeatherAlertEntity alert : fetched) {
            try {
                alertRepository.findByAlertId(alert.getAlertId()).ifPresentOrElse(existing -> {
                    existing.setSeverity(alert.getSeverity());
                    existing.setPolygon(alert.getPolygon());
                    existing.setEffectiveTime(alert.getEffectiveTime());
                    existing.setExpirationTime(alert.getExpirationTime());
                    existing.setActive(true);
                    alertRepository.save(existing);
                }, () -> alertRepository.save(alert));
            } catch (Exception e) {
                log.debug("Failed to persist alert {}: {}", alert.getAlertId(), e.getMessage());
            }
        }
    }

    /** Keep alerts fresh for every active trip and retire expired ones. */
    @Scheduled(fixedDelayString = "${nws.poll-interval-ms:60000}")
    public void refreshActiveRegions() {
        try {
            for (TravelerSessionEntity session : sessionRepository.findByActiveTrue()) {
                Point location = session.getLastKnownLocation();
                if (location != null) {
                    maybeRefresh(location.getY(), location.getX());
                }
            }
            Instant now = Instant.now();
            List<WeatherAlertEntity> stale = new ArrayList<>();
            for (WeatherAlertEntity alert : alertRepository.findByActiveTrue()) {
                if (alert.getExpirationTime() != null && alert.getExpirationTime().isBefore(now)) {
                    alert.setActive(false);
                    stale.add(alert);
                }
            }
            if (!stale.isEmpty()) {
                alertRepository.saveAll(stale);
                log.info("Deactivated {} expired NWS alerts", stale.size());
            }
        } catch (Exception e) {
            log.warn("Scheduled NWS refresh failed: {}", e.getMessage());
        }
    }

    private List<WeatherAlertEntity> fetchFromNWS(double lat, double lon) {
        String url = String.format("%s/alerts/active?point=%.4f,%.4f", nwsBaseUrl, lat, lon);
        log.info("Fetching NWS alerts: {}", url);

        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", userAgent);
        headers.setAccept(List.of(MediaType.parseMediaType("application/geo+json")));
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, entity, String.class);

        if (response.getStatusCode() == HttpStatus.NOT_FOUND || response.getBody() == null) {
            return Collections.emptyList();
        }

        return parseGeoJson(response.getBody());
    }

    private List<WeatherAlertEntity> parseGeoJson(String json) {
        List<WeatherAlertEntity> alerts = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode features = root.path("features");
            if (!features.isArray()) return alerts;

            for (JsonNode feature : features) {
                try {
                    JsonNode props = feature.path("properties");
                    String alertId = props.path("id").asText("NWS-" + UUID.randomUUID());
                    String event = props.path("event").asText("");
                    String severity = props.path("severity").asText("Unknown");
                    String effective = props.path("effective").asText();
                    String expires = props.path("expires").asText();

                    HazardType hazardType = mapEventToHazardType(event);
                    if (hazardType == null) continue;

                    Polygon polygon = extractPolygon(feature);
                    if (polygon == null) continue;

                    WeatherAlertEntity alert = WeatherAlertEntity.builder()
                            .alertId(alertId)
                            .hazardType(hazardType)
                            .severity(severity)
                            .polygon(polygon)
                            .effectiveTime(parseInstant(effective))
                            .expirationTime(parseInstant(expires))
                            .active(true)
                            .build();
                    alerts.add(alert);
                } catch (Exception e) {
                    log.debug("Skipping alert feature: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("Failed to parse NWS GeoJSON: {}", e.getMessage());
        }
        return alerts;
    }

    private Polygon extractPolygon(JsonNode feature) {
        JsonNode geometry = feature.path("geometry");
        if (geometry.isMissingNode() || geometry.isNull()) {
            // Try properties.affectedZones or UGC polygon
            return null;
        }
        String type = geometry.path("type").asText();
        JsonNode coordinates = geometry.path("coordinates");

        if ("Polygon".equals(type) && coordinates.isArray() && !coordinates.isEmpty()) {
            JsonNode ring = coordinates.get(0);
            if (ring.isArray() && ring.size() >= 4) {
                Coordinate[] coords = new Coordinate[ring.size()];
                for (int i = 0; i < ring.size(); i++) {
                    JsonNode pt = ring.get(i);
                    coords[i] = new Coordinate(pt.get(0).asDouble(), pt.get(1).asDouble());
                }
                // Ensure closed ring
                if (!coords[0].equals2D(coords[coords.length - 1])) {
                    coords = Arrays.copyOf(coords, coords.length + 1);
                    coords[coords.length - 1] = new Coordinate(coords[0].x, coords[0].y);
                }
                return geometryFactory.createPolygon(coords);
            }
        }
        return null;
    }

    private HazardType mapEventToHazardType(String event) {
        if (event == null) return null;
        String lower = event.toLowerCase();
        if (lower.contains("tornado")) return HazardType.TORNADO;
        if (lower.contains("hurricane") || lower.contains("tropical")) return HazardType.HURRICANE;
        if (lower.contains("flash flood") || lower.contains("flood")) return HazardType.FLASH_FLOOD;
        if (lower.contains("thunderstorm") || lower.contains("hail") || lower.contains("wind")) return HazardType.SEVERE_THUNDERSTORM;
        if (lower.contains("winter") || lower.contains("blizzard") || lower.contains("ice") || lower.contains("snow")) return HazardType.WINTER_STORM;
        if (lower.contains("fire") || lower.contains("smoke")) return HazardType.WILDFIRE_SMOKE;
        return null;
    }

    private Instant parseInstant(String time) {
        try {
            return Instant.parse(time);
        } catch (Exception e) {
            return Instant.now();
        }
    }

    private record CacheEntry(List<WeatherAlertEntity> alerts, long timestamp) {}
}
