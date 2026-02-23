package com.weatherwise.resolver;

import com.weatherwise.model.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Provides realistic mock data simulating a tornado scenario near Louisville, Kentucky
 * on I-64, based on the real May 16, 2025 event. A tornado-warned supercell is
 * tracking NE at 35 mph across Shelby and Oldham counties, crossing I-64 between
 * exits 28 and 35.
 */
public class MockDataProvider {

    private static final Instant BASE_TIME = Instant.parse("2025-05-16T21:30:00Z");

    // --- Storm Cells ---

    public static List<StormCell> getStormCells() {
        return List.of(tornadoCell(), severeThunderstormCell());
    }

    private static StormCell tornadoCell() {
        // Tornado-warned supercell SW of Shelbyville, moving NE at 35 mph
        // toward I-64 corridor between exits 28-35
        return StormCell.builder()
                .id("cell-tor-20250516-001")
                .lat(38.1742)
                .lon(-85.2538)
                .velocityX(25.5)   // NE movement: +X (east component ~25 mph)
                .velocityY(23.8)   // +Y (north component ~24 mph) => ~35 mph resultant
                .vil(68.0)         // Very high VIL indicating large hail / tornado potential
                .rotation(28.5)    // Strong mesocyclone rotation (m/s)
                .hazardType(HazardType.TORNADO)
                .predictedPath(List.of(
                        TimedPolygon.builder()
                                .time(BASE_TIME.toString())
                                .vertices(List.of(
                                        coord(38.1842, -85.2638),
                                        coord(38.1842, -85.2438),
                                        coord(38.1642, -85.2438),
                                        coord(38.1642, -85.2638)
                                ))
                                .build(),
                        TimedPolygon.builder()
                                .time(BASE_TIME.plus(15, ChronoUnit.MINUTES).toString())
                                .vertices(List.of(
                                        coord(38.2130, -85.1850),
                                        coord(38.2130, -85.1650),
                                        coord(38.1930, -85.1650),
                                        coord(38.1930, -85.1850)
                                ))
                                .build(),
                        TimedPolygon.builder()
                                .time(BASE_TIME.plus(30, ChronoUnit.MINUTES).toString())
                                .vertices(List.of(
                                        coord(38.2510, -85.1080),
                                        coord(38.2510, -85.0880),
                                        coord(38.2310, -85.0880),
                                        coord(38.2310, -85.1080)
                                ))
                                .build(),
                        TimedPolygon.builder()
                                .time(BASE_TIME.plus(45, ChronoUnit.MINUTES).toString())
                                .vertices(List.of(
                                        coord(38.2890, -85.0310),
                                        coord(38.2890, -85.0110),
                                        coord(38.2690, -85.0110),
                                        coord(38.2690, -85.0310)
                                ))
                                .build()
                ))
                .build();
    }

    private static StormCell severeThunderstormCell() {
        // Severe thunderstorm cell trailing ~12 miles SW of the tornado cell
        return StormCell.builder()
                .id("cell-svr-20250516-002")
                .lat(38.0985)
                .lon(-85.3920)
                .velocityX(22.0)
                .velocityY(20.0)
                .vil(45.0)
                .rotation(8.2)     // Weak rotation, not tornadic
                .hazardType(HazardType.SEVERE_THUNDERSTORM)
                .predictedPath(List.of(
                        TimedPolygon.builder()
                                .time(BASE_TIME.toString())
                                .vertices(List.of(
                                        coord(38.1085, -85.4020),
                                        coord(38.1085, -85.3820),
                                        coord(38.0885, -85.3820),
                                        coord(38.0885, -85.4020)
                                ))
                                .build(),
                        TimedPolygon.builder()
                                .time(BASE_TIME.plus(20, ChronoUnit.MINUTES).toString())
                                .vertices(List.of(
                                        coord(38.1420, -85.3250),
                                        coord(38.1420, -85.3050),
                                        coord(38.1220, -85.3050),
                                        coord(38.1220, -85.3250)
                                ))
                                .build()
                ))
                .build();
    }

    // --- Weather Alerts ---

    public static List<WeatherAlert> getWeatherAlerts() {
        return List.of(tornadoWarning(), severeThunderstormWarning(), flashFloodWatch());
    }

    private static WeatherAlert tornadoWarning() {
        // Tornado Warning for Shelby and Oldham counties, covering I-64 exits 28-35
        return WeatherAlert.builder()
                .id("NWS-TOR-20250516-0042")
                .type(HazardType.TORNADO)
                .severity("Extreme")
                .polygon(List.of(
                        coord(38.2800, -85.3500),
                        coord(38.2800, -85.0500),
                        coord(38.1200, -85.0500),
                        coord(38.1200, -85.3500)
                ))
                .effectiveTime(BASE_TIME.toString())
                .expirationTime(BASE_TIME.plus(45, ChronoUnit.MINUTES).toString())
                .build();
    }

    private static WeatherAlert severeThunderstormWarning() {
        // Severe Thunderstorm Warning trailing SW of tornado warning area
        return WeatherAlert.builder()
                .id("NWS-SVR-20250516-0038")
                .type(HazardType.SEVERE_THUNDERSTORM)
                .severity("Severe")
                .polygon(List.of(
                        coord(38.1500, -85.5000),
                        coord(38.1500, -85.3000),
                        coord(38.0200, -85.3000),
                        coord(38.0200, -85.5000)
                ))
                .effectiveTime(BASE_TIME.minus(10, ChronoUnit.MINUTES).toString())
                .expirationTime(BASE_TIME.plus(50, ChronoUnit.MINUTES).toString())
                .build();
    }

    private static WeatherAlert flashFloodWatch() {
        // Flash Flood Watch for broader Louisville metro area due to training storms
        return WeatherAlert.builder()
                .id("NWS-FFA-20250516-0025")
                .type(HazardType.FLASH_FLOOD)
                .severity("Moderate")
                .polygon(List.of(
                        coord(38.4000, -85.9000),
                        coord(38.4000, -85.0000),
                        coord(38.0000, -85.0000),
                        coord(38.0000, -85.9000)
                ))
                .effectiveTime(BASE_TIME.minus(3, ChronoUnit.HOURS).toString())
                .expirationTime(BASE_TIME.plus(6, ChronoUnit.HOURS).toString())
                .build();
    }

    // --- Safe Locations near I-64 exits ---

    public static List<SafeLocation> getSafeLocations() {
        return List.of(
                SafeLocation.builder()
                        .name("Pilot Travel Center Exit 28")
                        .locationType(LocationType.TRUCK_STOP)
                        .lat(38.2115)
                        .lon(-85.2200)
                        .distanceMiles(2.3)
                        .hasIndoorShelter(true)
                        .exitNumber("28")
                        .build(),
                SafeLocation.builder()
                        .name("Shelby County Rest Area")
                        .locationType(LocationType.REST_AREA)
                        .lat(38.1985)
                        .lon(-85.1780)
                        .distanceMiles(4.1)
                        .hasIndoorShelter(true)
                        .exitNumber("32")
                        .build(),
                SafeLocation.builder()
                        .name("Love's Travel Stop Exit 35")
                        .locationType(LocationType.TRUCK_STOP)
                        .lat(38.2240)
                        .lon(-85.1420)
                        .distanceMiles(6.8)
                        .hasIndoorShelter(true)
                        .exitNumber("35")
                        .build(),
                SafeLocation.builder()
                        .name("Thornton's Gas Station Exit 32")
                        .locationType(LocationType.GAS_STATION)
                        .lat(38.2010)
                        .lon(-85.1830)
                        .distanceMiles(3.9)
                        .hasIndoorShelter(false)
                        .exitNumber("32")
                        .build(),
                SafeLocation.builder()
                        .name("Comfort Inn Shelbyville")
                        .locationType(LocationType.HOTEL)
                        .lat(38.2125)
                        .lon(-85.2050)
                        .distanceMiles(2.7)
                        .hasIndoorShelter(true)
                        .exitNumber("28")
                        .build()
        );
    }

    // --- Alternate Routes ---

    public static List<AlternateRoute> getAlternateRoutes() {
        return List.of(
                // Southern bypass via US-60 through Shelbyville then back to I-64 east of storm
                AlternateRoute.builder()
                        .waypoints(List.of(
                                coord(38.2050, -85.3100),  // Start: I-64 before warning area
                                coord(38.1720, -85.2900),  // Exit to US-60 south
                                coord(38.1580, -85.2200),  // US-60 through Shelbyville
                                coord(38.1650, -85.1500),  // Continue east on US-60
                                coord(38.1900, -85.0800),  // Rejoin I-64 past storm
                                coord(38.2200, -85.0200)   // Back on I-64 eastbound
                        ))
                        .distanceMiles(28.4)
                        .estimatedMinutes(38.0)
                        .safetyScore(82.5)
                        .build(),
                // Northern bypass via I-71 to KY-53 to I-64 east
                AlternateRoute.builder()
                        .waypoints(List.of(
                                coord(38.2050, -85.3100),  // Start: I-64 before warning area
                                coord(38.2500, -85.3300),  // North to I-71 interchange
                                coord(38.3200, -85.2800),  // I-71 NE
                                coord(38.3500, -85.1900),  // KY-53 exit
                                coord(38.2900, -85.0600),  // KY-53 south to I-64
                                coord(38.2200, -85.0200)   // Rejoin I-64 eastbound
                        ))
                        .distanceMiles(35.2)
                        .estimatedMinutes(44.0)
                        .safetyScore(91.0)
                        .build()
        );
    }

    // --- Risk Assessment ---

    public static RiskAssessment getRiskAssessment() {
        return RiskAssessment.builder()
                .overallScore(78.5)
                .tier(AlertTier.ACTION_REQUIRED)
                .timeToIntersectionMinutes(12.0)
                .recommendedAction(ActionType.REROUTE)
                .hazardType(HazardType.TORNADO)
                .alertMessage("TORNADO WARNING: Tornado-warned supercell crossing I-64 between exits 28-35 in approximately 12 minutes. Reroute immediately via US-60 south or I-71 north to avoid intercept path.")
                .hazardSpecificGuidance("A confirmed tornado is tracking NE at 35 mph toward your route on I-64. Do NOT attempt to outrun the tornado eastbound. Take the next available exit and seek sturdy shelter immediately. If no exit is available within 2 minutes, pull over away from overpasses, stay buckled with the engine running, and duck below the window line.")
                .build();
    }

    private static Coordinate coord(double lat, double lon) {
        return Coordinate.builder().lat(lat).lon(lon).build();
    }
}
