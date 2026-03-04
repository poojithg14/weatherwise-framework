package com.weatherwise.integration;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * End-to-end integration tests that start the full Spring Boot application
 * and execute GraphQL queries against the real algorithm pipeline.
 *
 * Coordinates are centered on the I-75 corridor near London, KY where the
 * seeded May 16, 2025 EF-4 tornado scenario takes place.
 */
@SpringBootTest
class EndToEndTest {

    // London, KY area — near seeded storm and safe location data on I-75
    private static final double TEST_LAT = 37.09;
    private static final double TEST_LON = -84.08;

    @Autowired
    private DgsQueryExecutor dgsQueryExecutor;

    @Test
    @DisplayName("travelerSafety query returns valid risk assessment with real algorithm")
    void travelerSafetyReturnsValidRisk() {
        String query = """
                {
                    travelerSafety(lat: %s, lon: %s, heading: 180, speedMph: 70) {
                        overallScore
                        tier
                        alertMessage
                        recommendedAction
                        hazardSpecificGuidance
                    }
                }
                """.formatted(TEST_LAT, TEST_LON);

        Map<String, Object> result = dgsQueryExecutor.executeAndExtractJsonPathAsObject(
                query, "data.travelerSafety", Map.class);

        assertNotNull(result);

        // Verify score is a valid number in range
        Number score = (Number) result.get("overallScore");
        assertNotNull(score, "overallScore should not be null");
        assertTrue(score.doubleValue() >= 0 && score.doubleValue() <= 100,
                "Score should be 0-100, was: " + score);

        // Verify tier is a valid enum value
        String tier = (String) result.get("tier");
        assertNotNull(tier, "tier should not be null");
        assertTrue(tier.equals("MONITORING") || tier.equals("ADVISORY")
                        || tier.equals("ACTION_REQUIRED") || tier.equals("IMMEDIATE_DANGER"),
                "Tier should be a valid AlertTier, was: " + tier);

        // Verify alert message is non-empty
        String alertMessage = (String) result.get("alertMessage");
        assertNotNull(alertMessage, "alertMessage should not be null");
        assertFalse(alertMessage.isBlank(), "alertMessage should not be blank");

        // Verify recommended action is valid
        String action = (String) result.get("recommendedAction");
        assertNotNull(action, "recommendedAction should not be null");
    }

    @Test
    @DisplayName("activeAlerts query returns at least 1 alert")
    void activeAlertsReturnsAlerts() {
        String query = """
                {
                    activeAlerts(lat: %s, lon: %s, radiusMiles: 50) {
                        id
                        type
                        severity
                        effectiveTime
                        expirationTime
                    }
                }
                """.formatted(TEST_LAT, TEST_LON);

        List<Map<String, Object>> alerts = dgsQueryExecutor.executeAndExtractJsonPathAsObject(
                query, "data.activeAlerts", List.class);

        assertNotNull(alerts);
        assertFalse(alerts.isEmpty(), "Should return at least 1 weather alert");

        // Verify first alert has required fields
        Map<String, Object> first = alerts.get(0);
        assertNotNull(first.get("id"));
        assertNotNull(first.get("type"));
        assertNotNull(first.get("severity"));
    }

    @Test
    @DisplayName("safeLocations query returns locations sorted by distance")
    void safeLocationsReturnsSortedByDistance() {
        String query = """
                {
                    safeLocations(lat: %s, lon: %s, radiusMiles: 50) {
                        name
                        locationType
                        distanceMiles
                        hasIndoorShelter
                    }
                }
                """.formatted(TEST_LAT, TEST_LON);

        List<Map<String, Object>> locations = dgsQueryExecutor.executeAndExtractJsonPathAsObject(
                query, "data.safeLocations", List.class);

        assertNotNull(locations);
        assertFalse(locations.isEmpty(), "Should return at least 1 safe location");

        // Verify sorted by distance (allowing for safest-first reordering of first element)
        if (locations.size() > 2) {
            double prevDist = ((Number) locations.get(1).get("distanceMiles")).doubleValue();
            for (int i = 2; i < locations.size(); i++) {
                double dist = ((Number) locations.get(i).get("distanceMiles")).doubleValue();
                assertTrue(dist >= prevDist,
                        "Locations should be sorted by distance, but " + dist + " < " + prevDist);
                prevDist = dist;
            }
        }
    }

    @Test
    @DisplayName("stormCells query returns storm data")
    void stormCellsReturnsData() {
        String query = """
                {
                    stormCells(lat: %s, lon: %s, radiusMiles: 50) {
                        id
                        lat
                        lon
                        hazardType
                        velocityX
                        velocityY
                    }
                }
                """.formatted(TEST_LAT, TEST_LON);

        List<Map<String, Object>> storms = dgsQueryExecutor.executeAndExtractJsonPathAsObject(
                query, "data.stormCells", List.class);

        assertNotNull(storms);
        assertFalse(storms.isEmpty(), "Should return at least 1 storm cell");
    }

    @Test
    @DisplayName("alternateRoutes query returns route options")
    void alternateRoutesReturnsRoutes() {
        // Route from north of London to south of London on I-75
        String query = """
                {
                    alternateRoutes(
                        fromLat: 37.13, fromLon: -84.08,
                        toLat: 36.97, toLon: -84.11,
                        avoidHazards: true
                    ) {
                        distanceMiles
                        estimatedMinutes
                        safetyScore
                    }
                }
                """;

        List<Map<String, Object>> routes = dgsQueryExecutor.executeAndExtractJsonPathAsObject(
                query, "data.alternateRoutes", List.class);

        assertNotNull(routes);
        assertFalse(routes.isEmpty(), "Should return at least 1 alternate route");

        Map<String, Object> first = routes.get(0);
        assertTrue(((Number) first.get("distanceMiles")).doubleValue() > 0);
        assertTrue(((Number) first.get("estimatedMinutes")).doubleValue() > 0);
    }
}
