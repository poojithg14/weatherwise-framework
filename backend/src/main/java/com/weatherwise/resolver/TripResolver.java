package com.weatherwise.resolver;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.InputArgument;
import com.weatherwise.model.Coordinate;
import com.weatherwise.model.RiskAssessment;
import com.weatherwise.service.TripSessionService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@DgsComponent
public class TripResolver {

    private final TripSessionService tripSessionService;

    public TripResolver(TripSessionService tripSessionService) {
        this.tripSessionService = tripSessionService;
    }

    @DgsMutation
    public Map<String, Object> startTrip(
            @InputArgument Double fromLat,
            @InputArgument Double fromLon,
            @InputArgument Double toLat,
            @InputArgument Double toLon) {

        validateCoordinate(fromLat, "fromLat");
        validateCoordinate(fromLon, "fromLon");
        validateCoordinate(toLat, "toLat");
        validateCoordinate(toLon, "toLon");

        TripSessionService.TripResult result = tripSessionService.startTrip(
                fromLat, fromLon, toLat, toLon);

        List<Map<String, Object>> waypoints = result.waypoints().stream()
                .map(w -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("lat", w.getLat());
                    m.put("lon", w.getLon());
                    return m;
                }).toList();

        Map<String, Object> response = new HashMap<>();
        response.put("sessionId", result.sessionId());
        response.put("route", waypoints);
        response.put("estimatedDistanceMiles", result.distanceMiles());
        response.put("estimatedTimeMinutes", result.estimatedMinutes());
        return response;
    }

    @DgsMutation
    public Map<String, Object> updatePosition(
            @InputArgument String sessionId,
            @InputArgument Double lat,
            @InputArgument Double lon,
            @InputArgument Double heading,
            @InputArgument Double speedMph) {

        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("sessionId is required");
        }
        validateCoordinate(lat, "lat");
        validateCoordinate(lon, "lon");
        if (heading == null || heading < 0 || heading > 360) {
            throw new IllegalArgumentException("heading must be between 0 and 360");
        }
        if (speedMph == null || speedMph < 0) {
            throw new IllegalArgumentException("speedMph must be >= 0");
        }

        RiskAssessment risk = tripSessionService.updatePosition(
                sessionId, lat, lon, heading, speedMph);

        Map<String, Object> response = new HashMap<>();
        response.put("overallScore", risk.getOverallScore());
        response.put("tier", risk.getTier().name());
        response.put("alertMessage", risk.getAlertMessage());
        response.put("recommendedAction", risk.getRecommendedAction() != null
                ? risk.getRecommendedAction().name() : "CONTINUE_MONITORING");
        response.put("hazardSpecificGuidance", risk.getHazardSpecificGuidance());
        response.put("timeToIntersectionMinutes", risk.getTimeToIntersectionMinutes());
        if (risk.getHazardType() != null) {
            response.put("hazardType", risk.getHazardType().name());
        }
        return response;
    }

    @DgsMutation
    public Map<String, Object> endTrip(@InputArgument String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("sessionId is required");
        }
        TripSessionService.TripSummaryResult summary = tripSessionService.endTrip(sessionId);

        Map<String, Object> response = new HashMap<>();
        response.put("totalDistanceMiles", summary.totalDistanceMiles());
        response.put("totalTimeMinutes", summary.totalTimeMinutes());
        response.put("maxRiskScore", summary.maxRiskScore());
        response.put("alertsReceived", summary.alertsReceived());
        response.put("actionsRecommended", summary.actionsRecommended());
        return response;
    }

    private void validateCoordinate(Double value, String name) {
        if (value == null) {
            throw new IllegalArgumentException(name + " is required");
        }
        if (name.contains("Lat") || name.equals("lat")) {
            if (value < -90 || value > 90) {
                throw new IllegalArgumentException(name + " must be between -90 and 90");
            }
        } else {
            if (value < -180 || value > 180) {
                throw new IllegalArgumentException(name + " must be between -180 and 180");
            }
        }
    }
}
