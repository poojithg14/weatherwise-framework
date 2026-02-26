package com.weatherwise.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.weatherwise.model.Coordinate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class RouteService {

    private static final long CACHE_TTL_MS = 300_000; // 5 minutes

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${osrm.api.url}")
    private String osrmBaseUrl;

    private final Map<String, RouteCacheEntry> cache = new ConcurrentHashMap<>();

    public RouteService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public RouteResult getRoute(double fromLat, double fromLon, double toLat, double toLon) {
        String cacheKey = String.format("%.4f,%.4f->%.4f,%.4f", fromLat, fromLon, toLat, toLon);
        RouteCacheEntry cached = cache.get(cacheKey);
        if (cached != null && System.currentTimeMillis() - cached.timestamp < CACHE_TTL_MS) {
            return cached.result;
        }

        try {
            RouteResult result = fetchFromOSRM(fromLat, fromLon, toLat, toLon);
            cache.put(cacheKey, new RouteCacheEntry(result, System.currentTimeMillis()));
            return result;
        } catch (Exception e) {
            log.warn("OSRM route fetch failed, returning straight line: {}", e.getMessage());
            return buildStraightLine(fromLat, fromLon, toLat, toLon);
        }
    }

    private RouteResult fetchFromOSRM(double fromLat, double fromLon, double toLat, double toLon) {
        String url = String.format(
                "%s/route/v1/driving/%.6f,%.6f;%.6f,%.6f?overview=full&geometries=geojson&steps=true",
                osrmBaseUrl, fromLon, fromLat, toLon, toLat);
        log.info("Fetching OSRM route: {}", url);

        String response = restTemplate.getForObject(url, String.class);
        return parseOSRMResponse(response);
    }

    private RouteResult parseOSRMResponse(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode routes = root.path("routes");
            if (!routes.isArray() || routes.isEmpty()) {
                throw new RuntimeException("No routes returned from OSRM");
            }

            JsonNode route = routes.get(0);
            double distanceMeters = route.path("distance").asDouble();
            double durationSeconds = route.path("duration").asDouble();

            JsonNode geometry = route.path("geometry").path("coordinates");
            List<Coordinate> waypoints = new ArrayList<>();
            if (geometry.isArray()) {
                for (JsonNode coord : geometry) {
                    waypoints.add(Coordinate.builder()
                            .lon(coord.get(0).asDouble())
                            .lat(coord.get(1).asDouble())
                            .build());
                }
            }

            return new RouteResult(
                    waypoints,
                    distanceMeters / 1609.344,
                    durationSeconds / 60.0
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse OSRM response", e);
        }
    }

    private RouteResult buildStraightLine(double fromLat, double fromLon, double toLat, double toLon) {
        List<Coordinate> waypoints = List.of(
                Coordinate.builder().lat(fromLat).lon(fromLon).build(),
                Coordinate.builder().lat(toLat).lon(toLon).build()
        );
        double distMiles = haversine(fromLat, fromLon, toLat, toLon);
        return new RouteResult(waypoints, distMiles, distMiles / 65.0 * 60.0);
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double R = 3958.8;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    public record RouteResult(List<Coordinate> waypoints, double distanceMiles, double estimatedMinutes) {}
    private record RouteCacheEntry(RouteResult result, long timestamp) {}
}
