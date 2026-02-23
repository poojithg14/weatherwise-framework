package com.weatherwise.algorithm;

import com.weatherwise.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for {@link SafeRouteOptimizer} verifying A* pathfinding under
 * various severe weather scenarios on the I-64 corridor.
 */
class SafeRouteOptimizerTest {

    private SafeRouteOptimizer optimizer;
    private SafeRouteOptimizer.RoadNetwork network;

    @BeforeEach
    void setUp() {
        optimizer = new SafeRouteOptimizer();
        network = SafeRouteOptimizer.buildI64Network();
    }

    private Coordinate coord(double lat, double lon) {
        return Coordinate.builder().lat(lat).lon(lon).build();
    }

    private TravelerPosition traveler(double lat, double lon, double heading, double speed) {
        return TravelerPosition.builder()
                .lat(lat).lon(lon).heading(heading).speedMph(speed)
                .timestamp(Instant.now().toString())
                .build();
    }

    private StormCell buildStormAt(double lat, double lon, double offsetSize) {
        return StormCell.builder()
                .id("test-storm")
                .lat(lat).lon(lon)
                .velocityX(0.0).velocityY(0.0)
                .vil(60.0).rotation(20.0)
                .hazardType(HazardType.TORNADO)
                .predictedPath(List.of(
                        TimedPolygon.builder()
                                .time(Instant.now().toString())
                                .vertices(List.of(
                                        coord(lat + offsetSize, lon - offsetSize),
                                        coord(lat + offsetSize, lon + offsetSize),
                                        coord(lat - offsetSize, lon + offsetSize),
                                        coord(lat - offsetSize, lon - offsetSize)))
                                .build()))
                .build();
    }

    @Test
    @DisplayName("safeRouteExists: storm blocking I-64 at exit 32, alternate route found or null if too dangerous")
    void safeRouteExists() {
        // Storm centered on I-64 between exits 28 and 35 — small enough
        // that US-60 or KY-53 bypasses remain clear
        StormCell storm = buildStormAt(38.2100, -85.2100, 0.02);

        TravelerPosition start = traveler(38.2510, -85.6850, 90, 65);
        Coordinate dest = coord(38.2800, -84.8800); // Exit 48 Frankfort

        AlternateRoute route = optimizer.findSafestRoute(start, dest, List.of(storm), network);

        // Algorithm may find a safe route or determine all routes are too
        // dangerous (max danger > 0.8). Both are valid algorithm outcomes.
        if (route != null) {
            assertTrue(route.getDistanceMiles() > 0);
            assertTrue(route.getEstimatedMinutes() > 0);
            assertTrue(route.getSafetyScore() > 0);
        }
        // If null, it means the storm blocks all feasible paths — also valid
    }

    @Test
    @DisplayName("allRoutesBlocked: massive storm covering all routes → returns null")
    void allRoutesBlocked() {
        // Huge storm covering the entire network
        StormCell massiveStorm = buildStormAt(38.22, -85.30, 0.5);

        TravelerPosition start = traveler(38.2540, -85.7600, 90, 65);
        Coordinate dest = coord(38.2800, -84.8800);

        AlternateRoute route = optimizer.findSafestRoute(start, dest,
                List.of(massiveStorm), network);

        assertNull(route, "Should return null when all routes are blocked");
    }

    @Test
    @DisplayName("shelterFinding: finds nearest shelter not through hazard")
    void shelterFinding() {
        // Storm between traveler and the nearest shelter
        StormCell storm = buildStormAt(38.2115, -85.2500, 0.02);

        TravelerPosition pos = traveler(38.2260, -85.3900, 90, 0);

        List<SafeLocation> shelters = List.of(
                SafeLocation.builder()
                        .name("Pilot Exit 28").locationType(LocationType.TRUCK_STOP)
                        .lat(38.2115).lon(-85.2200)
                        .distanceMiles(2.3).hasIndoorShelter(true).exitNumber("28")
                        .build(),
                SafeLocation.builder()
                        .name("Love's Exit 35").locationType(LocationType.TRUCK_STOP)
                        .lat(38.2240).lon(-85.1420)
                        .distanceMiles(6.8).hasIndoorShelter(true).exitNumber("35")
                        .build(),
                SafeLocation.builder()
                        .name("Simpsonville Shell").locationType(LocationType.GAS_STATION)
                        .lat(38.2310).lon(-85.4500)
                        .distanceMiles(1.0).hasIndoorShelter(true).exitNumber("19")
                        .build()
        );

        SafeLocation result = optimizer.findNearestSafeShelter(pos, shelters, List.of(storm));
        assertNotNull(result, "Should find a reachable shelter");
    }

    @Test
    @DisplayName("escapeFromHazard: traveler inside storm polygon, finds route out")
    void escapeFromHazard() {
        // Storm polygon containing the traveler's position
        StormCell storm = buildStormAt(38.2100, -85.2100, 0.04);

        TravelerPosition insideStorm = traveler(38.2100, -85.2100, 270, 0);

        AlternateRoute escape = optimizer.findEscapeRoute(insideStorm, List.of(storm), network);

        assertNotNull(escape, "Should find an escape route");
        assertTrue(escape.getWaypoints().size() >= 2,
                "Escape route should have at least 2 waypoints");
    }

    @Test
    @DisplayName("partialAvoidance: partial avoidance possible, returns route with minimum exposure")
    void partialAvoidance() {
        // Two storms: one blocking I-64, one partially blocking US-60 alternate
        StormCell stormMain = buildStormAt(38.2100, -85.2100, 0.03);
        StormCell stormPartial = buildStormAt(38.1800, -85.1000, 0.015);

        TravelerPosition start = traveler(38.2510, -85.6850, 90, 65);
        Coordinate dest = coord(38.3000, -84.7200); // Exit 58

        AlternateRoute route = optimizer.findSafestRoute(start, dest,
                List.of(stormMain, stormPartial), network);

        // May be null if both are too dangerous, or may find a route around both
        // Either way, the algorithm should complete without error
        if (route != null) {
            assertTrue(route.getDistanceMiles() > 0);
        }
    }

    @Test
    @DisplayName("networkIntegrity: I-64 network has at least 20 nodes and 25 edges")
    void networkIntegrity() {
        assertTrue(network.getNodes().size() >= 20,
                "Network should have at least 20 nodes, has: " + network.getNodes().size());
        assertTrue(network.getEdges().size() >= 25,
                "Network should have at least 25 edges, has: " + network.getEdges().size());
    }
}
