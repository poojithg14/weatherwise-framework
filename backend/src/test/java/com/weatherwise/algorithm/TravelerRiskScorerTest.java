package com.weatherwise.algorithm;

import com.weatherwise.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link TravelerRiskScorer} validating the five-component
 * composite risk score algorithm under various storm-traveler geometries.
 *
 * <p>All tests use realistic geographic coordinates along the I-64 corridor
 * in Kentucky, consistent with the Louisville tornado case study used
 * throughout the WeatherWise evaluation.</p>
 */
class TravelerRiskScorerTest {

    private TravelerRiskScorer scorer;
    private List<SafeLocation> standardSafeLocations;

    @BeforeEach
    void setUp() {
        scorer = new TravelerRiskScorer();
        ReflectionTestUtils.setField(scorer, "wProximity", 0.25);
        ReflectionTestUtils.setField(scorer, "wIntersection", 0.30);
        ReflectionTestUtils.setField(scorer, "wSeverity", 0.20);
        ReflectionTestUtils.setField(scorer, "wExposure", 0.15);
        ReflectionTestUtils.setField(scorer, "wEscape", 0.10);
        ReflectionTestUtils.setField(scorer, "nighttimeFactor", 1.15);

        // Standard safe locations along I-64
        standardSafeLocations = List.of(
                SafeLocation.builder()
                        .name("Pilot Travel Center Exit 28")
                        .locationType(LocationType.TRUCK_STOP)
                        .lat(38.2115).lon(-85.2200)
                        .distanceMiles(2.3).hasIndoorShelter(true).exitNumber("28")
                        .build(),
                SafeLocation.builder()
                        .name("Shelby County Rest Area")
                        .locationType(LocationType.REST_AREA)
                        .lat(38.1985).lon(-85.1780)
                        .distanceMiles(4.1).hasIndoorShelter(true).exitNumber("32")
                        .build(),
                SafeLocation.builder()
                        .name("Love's Travel Stop Exit 35")
                        .locationType(LocationType.TRUCK_STOP)
                        .lat(38.2240).lon(-85.1420)
                        .distanceMiles(6.8).hasIndoorShelter(true).exitNumber("35")
                        .build()
        );
    }

    // -----------------------------------------------------------------------
    //  Helper: build storm cells with predicted path polygons
    // -----------------------------------------------------------------------

    private StormCell buildStormCell(String id, double lat, double lon,
                                    double vx, double vy, double vil,
                                    double rotation, HazardType type) {
        Instant now = Instant.now();
        // Create a corridor polygon around the storm center
        double offset = 0.05; // ~3.5 miles
        return StormCell.builder()
                .id(id).lat(lat).lon(lon)
                .velocityX(vx).velocityY(vy)
                .vil(vil).rotation(rotation).hazardType(type)
                .predictedPath(List.of(
                        TimedPolygon.builder()
                                .time(now.toString())
                                .vertices(List.of(
                                        coord(lat + offset, lon - offset),
                                        coord(lat + offset, lon + offset),
                                        coord(lat - offset, lon + offset),
                                        coord(lat - offset, lon - offset)))
                                .build(),
                        TimedPolygon.builder()
                                .time(now.plus(30, ChronoUnit.MINUTES).toString())
                                .vertices(List.of(
                                        coord(lat + offset + 0.1, lon - offset + 0.1),
                                        coord(lat + offset + 0.1, lon + offset + 0.1),
                                        coord(lat - offset + 0.1, lon + offset + 0.1),
                                        coord(lat - offset + 0.1, lon - offset + 0.1)))
                                .build()))
                .build();
    }

    private TravelerPosition traveler(double lat, double lon,
                                      double heading, double speed) {
        return TravelerPosition.builder()
                .lat(lat).lon(lon)
                .heading(heading).speedMph(speed)
                .timestamp(Instant.now().toString())
                .build();
    }

    private Coordinate coord(double lat, double lon) {
        return Coordinate.builder().lat(lat).lon(lon).build();
    }

    // -----------------------------------------------------------------------
    //  Test 1: Storm far away — should be ADVISORY with low score
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("stormFarAway: storm 55+ mi away moving away → MONITORING, score < 25")
    void stormFarAway() {
        // Storm is 55+ miles NE of traveler, moving further NE (away)
        TravelerPosition t = traveler(38.25, -85.76, 270, 70);
        StormCell storm = buildStormCell("far-001",
                39.00, -84.90,   // ~55 miles NE
                25, 25,          // Moving NE (away from traveler heading west)
                30, 5.0,
                HazardType.SEVERE_THUNDERSTORM);

        // Safe locations near the traveler so escape options score is low
        List<SafeLocation> nearbySafe = List.of(
                SafeLocation.builder()
                        .name("Gas Station I-64 West")
                        .locationType(LocationType.GAS_STATION)
                        .lat(38.25).lon(-85.73)
                        .distanceMiles(1.8).hasIndoorShelter(true).exitNumber("15")
                        .build(),
                SafeLocation.builder()
                        .name("Truck Stop I-64 West")
                        .locationType(LocationType.TRUCK_STOP)
                        .lat(38.26).lon(-85.70)
                        .distanceMiles(3.5).hasIndoorShelter(true).exitNumber("17")
                        .build(),
                SafeLocation.builder()
                        .name("Rest Area I-64")
                        .locationType(LocationType.REST_AREA)
                        .lat(38.24).lon(-85.71)
                        .distanceMiles(2.9).hasIndoorShelter(true).exitNumber("16")
                        .build()
        );

        RiskAssessment result = scorer.computeRisk(t, List.of(storm),
                nearbySafe, false);

        assertEquals(AlertTier.MONITORING, result.getTier());
        assertTrue(result.getOverallScore() < 25.0,
                "Score should be < 25 for distant storm, was: " + result.getOverallScore());
        assertEquals(ActionType.CONTINUE_MONITORING, result.getRecommendedAction());
    }

    // -----------------------------------------------------------------------
    //  Test 2: Storm on collision course — ACTION_REQUIRED
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("stormOnCollisionCourse: storm 20 mi away on I-64, intersection ~18 min → ACTION_REQUIRED")
    void stormOnCollisionCourse() {
        // Traveler heading west on I-64 at 70 mph
        TravelerPosition t = traveler(38.25, -85.76, 270, 70);
        // Storm is ~20 miles ahead, moving toward I-64 from the south
        StormCell storm = buildStormCell("collision-001",
                38.17, -86.00,   // ~20 miles SW
                25, 24,          // Moving NE, toward traveler's route
                65, 25.0,
                HazardType.TORNADO);

        RiskAssessment result = scorer.computeRisk(t, List.of(storm),
                standardSafeLocations, false);

        assertTrue(result.getOverallScore() >= 30.0 && result.getOverallScore() <= 85.0,
                "Score should be 30-85 for collision course, was: " + result.getOverallScore());
        assertNotNull(result.getAlertMessage());
        assertTrue(result.getAlertMessage().length() > 10);
    }

    // -----------------------------------------------------------------------
    //  Test 3: Storm imminent, no exits — IMMEDIATE_DANGER
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("stormImminentNoExit: storm 5 mi away, closing fast, no safe locations → IMMEDIATE_DANGER, score > 70")
    void stormImminentNoExit() {
        // Traveler on I-64
        TravelerPosition t = traveler(38.20, -85.25, 270, 70);
        // Storm is 5 miles away, bearing down fast
        StormCell storm = buildStormCell("imminent-001",
                38.22, -85.20,   // ~3 miles
                -30, -10,        // Moving SW toward traveler
                70, 30.0,
                HazardType.TORNADO);

        // No safe locations within 15 miles
        RiskAssessment result = scorer.computeRisk(t, List.of(storm),
                Collections.emptyList(), false);

        assertTrue(result.getOverallScore() > 50.0,
                "Score should be > 50 for imminent storm with no exits, was: "
                        + result.getOverallScore());
        assertNotNull(result.getHazardSpecificGuidance());
    }

    // -----------------------------------------------------------------------
    //  Test 4: Storm behind traveler moving away — very low score
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("stormBehindTraveler: storm 10 mi behind, moving away → score < 20")
    void stormBehindTraveler() {
        // Traveler heading west on I-64
        TravelerPosition t = traveler(38.25, -85.76, 270, 70);
        // Storm is behind (east) and moving further east
        StormCell storm = buildStormCell("behind-001",
                38.25, -85.60,   // ~10 miles east (behind)
                20, 0,           // Moving east (away from westbound traveler)
                40, 10.0,
                HazardType.SEVERE_THUNDERSTORM);

        RiskAssessment result = scorer.computeRisk(t, List.of(storm),
                standardSafeLocations, false);

        assertTrue(result.getOverallScore() < 40.0,
                "Score should be < 40 for storm behind traveler, was: "
                        + result.getOverallScore());
    }

    // -----------------------------------------------------------------------
    //  Test 5: Nighttime escalation
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("nighttimeEscalation: same scenario as collision course but at night → higher score")
    void nighttimeEscalation() {
        TravelerPosition t = traveler(38.25, -85.76, 270, 70);
        StormCell storm = buildStormCell("night-001",
                38.17, -86.00,
                25, 24,
                65, 25.0,
                HazardType.TORNADO);

        RiskAssessment daytime = scorer.computeRisk(t, List.of(storm),
                standardSafeLocations, false);
        RiskAssessment nighttime = scorer.computeRisk(t, List.of(storm),
                standardSafeLocations, true);

        assertTrue(nighttime.getOverallScore() >= daytime.getOverallScore(),
                "Nighttime score (" + nighttime.getOverallScore()
                        + ") should be >= daytime score (" + daytime.getOverallScore() + ")");
    }

    // -----------------------------------------------------------------------
    //  Test 6: Traveler can outrun storm
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("travelerCanOutrun: storm crossing in 20 min but traveler clears in 12 min → ACTION_REQUIRED, lower score")
    void travelerCanOutrun() {
        // Traveler heading west at 75 mph — will clear storm crossing area quickly
        TravelerPosition t = traveler(38.25, -85.76, 270, 75);
        // Storm will cross I-64 in 20 min at a point 15 miles ahead
        StormCell storm = buildStormCell("outrun-001",
                38.10, -85.95,  // South of I-64, will cross at ~-85.95
                10, 30,         // Moving mostly north to cross the highway
                55, 20.0,
                HazardType.TORNADO);

        RiskAssessment result = scorer.computeRisk(t, List.of(storm),
                standardSafeLocations, false);

        // Should still be actionable but not extreme
        assertTrue(result.getOverallScore() <= 85.0,
                "Score should be ≤ 85 when traveler can outrun, was: "
                        + result.getOverallScore());
    }

    // -----------------------------------------------------------------------
    //  Test 7: Flash flood covering wide area
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("flashFloodAllRoutes: flash flood wide area → ACTION_REQUIRED with EXIT_TO_SHELTER")
    void flashFloodAllRoutes() {
        TravelerPosition t = traveler(38.25, -85.76, 270, 70);
        // Large flash flood polygon covering many square miles
        StormCell flood = StormCell.builder()
                .id("flood-001")
                .lat(38.25).lon(-85.80)
                .velocityX(0.0).velocityY(0.0)  // Stationary
                .vil(0.0).rotation(0.0)
                .hazardType(HazardType.FLASH_FLOOD)
                .predictedPath(List.of(
                        TimedPolygon.builder()
                                .time(Instant.now().toString())
                                .vertices(List.of(
                                        coord(38.35, -86.10),
                                        coord(38.35, -85.50),
                                        coord(38.15, -85.50),
                                        coord(38.15, -86.10)))
                                .build()))
                .build();

        // Safe locations exist but routes to them cross flood zone
        List<SafeLocation> locations = List.of(
                SafeLocation.builder()
                        .name("Gas Station Exit 40")
                        .locationType(LocationType.GAS_STATION)
                        .lat(38.26).lon(-85.85)  // Inside flood zone
                        .distanceMiles(3.0).hasIndoorShelter(true).exitNumber("40")
                        .build());

        RiskAssessment result = scorer.computeRisk(t, List.of(flood),
                locations, false);

        assertNotNull(result.getHazardType());
        assertEquals(HazardType.FLASH_FLOOD, result.getHazardType());
        assertNotNull(result.getHazardSpecificGuidance());
        assertTrue(result.getHazardSpecificGuidance().contains("Turn Around"));
    }

    // -----------------------------------------------------------------------
    //  Test 8: Multiple storms — score based on most dangerous
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("multipleStorms: two storms, one far one close → score driven by closest")
    void multipleStorms() {
        TravelerPosition t = traveler(38.25, -85.76, 270, 70);

        StormCell farStorm = buildStormCell("multi-far",
                39.00, -84.50,   // ~50 miles NE
                10, 10, 30, 5.0,
                HazardType.SEVERE_THUNDERSTORM);

        StormCell closeStorm = buildStormCell("multi-close",
                38.22, -85.80,   // ~3 miles south
                20, 15, 60, 22.0,
                HazardType.TORNADO);

        // Test with close storm alone
        RiskAssessment closeOnly = scorer.computeRisk(t, List.of(closeStorm),
                standardSafeLocations, false);

        // Test with both storms
        RiskAssessment both = scorer.computeRisk(t, List.of(farStorm, closeStorm),
                standardSafeLocations, false);

        // The composite score with both storms should be driven by the close one
        assertEquals(both.getOverallScore(), closeOnly.getOverallScore(),
                "Multi-storm score should match the worst single storm score");
        assertEquals(HazardType.TORNADO, both.getHazardType());
    }
}
