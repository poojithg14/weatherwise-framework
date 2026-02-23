package com.weatherwise.config;

import com.weatherwise.entity.*;
import com.weatherwise.model.HazardType;
import com.weatherwise.model.LocationType;
import com.weatherwise.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private static final int SRID = 4326;

    private final SafeLocationRepository safeLocationRepository;
    private final RoadSegmentRepository roadSegmentRepository;
    private final StormCellRepository stormCellRepository;
    private final WeatherAlertRepository weatherAlertRepository;

    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), SRID);

    @Override
    public void run(String... args) {
        if (safeLocationRepository.count() > 0) {
            log.info("Database already seeded — skipping.");
            return;
        }

        log.info("Seeding I-75 corridor data...");
        seedSafeLocations();
        seedRoadSegments();
        seedStormData();
        log.info("Seeding complete.");
    }

    private Point point(double lon, double lat) {
        return geometryFactory.createPoint(new Coordinate(lon, lat));
    }

    private LineString lineString(double[][] coords) {
        Coordinate[] jtsCoords = new Coordinate[coords.length];
        for (int i = 0; i < coords.length; i++) {
            jtsCoords[i] = new Coordinate(coords[i][0], coords[i][1]); // lon, lat
        }
        return geometryFactory.createLineString(jtsCoords);
    }

    private Polygon polygon(double[][] coords) {
        // Close the ring if not already closed
        Coordinate[] jtsCoords;
        if (coords[0][0] != coords[coords.length - 1][0] || coords[0][1] != coords[coords.length - 1][1]) {
            jtsCoords = new Coordinate[coords.length + 1];
            for (int i = 0; i < coords.length; i++) {
                jtsCoords[i] = new Coordinate(coords[i][0], coords[i][1]);
            }
            jtsCoords[coords.length] = new Coordinate(coords[0][0], coords[0][1]);
        } else {
            jtsCoords = new Coordinate[coords.length];
            for (int i = 0; i < coords.length; i++) {
                jtsCoords[i] = new Coordinate(coords[i][0], coords[i][1]);
            }
        }
        return geometryFactory.createPolygon(jtsCoords);
    }

    // -----------------------------------------------------------------------
    //  Safe Locations — I-75 from Lexington to Knoxville
    // -----------------------------------------------------------------------

    private void seedSafeLocations() {
        // Lexington area (I-75 exits 104-115)
        saveSafe("Pilot Travel Center Exit 104", LocationType.TRUCK_STOP,
                -84.4580, 37.8860, true, "104", "I-75");
        saveSafe("Shell Gas Station Exit 108", LocationType.GAS_STATION,
                -84.4320, 37.8540, false, "108", "I-75");
        saveSafe("Comfort Suites Nicholasville Rd", LocationType.HOTEL,
                -84.5100, 37.9900, true, "110", "I-75");
        saveSafe("BP Station Exit 113", LocationType.GAS_STATION,
                -84.3710, 37.8110, false, "113", "I-75");

        // Berea / Richmond area (I-75 exits 76-95)
        saveSafe("Love's Travel Stop Exit 95", LocationType.TRUCK_STOP,
                -84.3020, 37.7490, true, "95", "I-75");
        saveSafe("Holiday Inn Richmond", LocationType.HOTEL,
                -84.2870, 37.7350, true, "90", "I-75");
        saveSafe("Berea Rest Area", LocationType.REST_AREA,
                -84.2960, 37.5920, true, "77", "I-75");
        saveSafe("Pilot Travel Center Berea", LocationType.TRUCK_STOP,
                -84.2900, 37.5700, true, "76", "I-75");

        // London / Corbin area (I-75 exits 25-41) — tornado impact zone
        saveSafe("TA Travel Center Exit 41", LocationType.TRUCK_STOP,
                -84.0830, 37.1290, true, "41", "I-75");
        saveSafe("London Rest Area SB", LocationType.REST_AREA,
                -84.0760, 37.1050, true, "38", "I-75");
        saveSafe("Comfort Inn London", LocationType.HOTEL,
                -84.0870, 37.0880, true, "38", "I-75");
        saveSafe("Shell Station Exit 29", LocationType.GAS_STATION,
                -84.1120, 37.0470, false, "29", "I-75");
        saveSafe("St. Joseph Hospital London", LocationType.HOSPITAL,
                -84.0920, 37.0930, true, null, "US-25");
        saveSafe("London Community Center", LocationType.STURDY_BUILDING,
                -84.0840, 37.0950, true, null, "US-25");

        // South toward Knoxville (I-75 exits 11-25)
        saveSafe("BP Station Exit 25", LocationType.GAS_STATION,
                -84.1370, 36.9730, false, "25", "I-75");
        saveSafe("Pilot Travel Center Jellico", LocationType.TRUCK_STOP,
                -84.1290, 36.5890, true, "160", "I-75");
        saveSafe("Williamsburg Rest Area", LocationType.REST_AREA,
                -84.1600, 36.7430, true, "15", "I-75");

        // Alternate route safe locations
        saveSafe("Daniel Boone Pkwy Rest Area", LocationType.REST_AREA,
                -83.8500, 37.1200, true, null, "Daniel Boone Pkwy");
        saveSafe("KY-80 Gas & Go", LocationType.GAS_STATION,
                -84.2000, 37.0600, false, null, "KY-80");

        log.info("Seeded {} safe locations.", safeLocationRepository.count());
    }

    private void saveSafe(String name, LocationType type, double lon, double lat,
                          boolean shelter, String exit, String highway) {
        safeLocationRepository.save(SafeLocationEntity.builder()
                .name(name)
                .locationType(type)
                .location(point(lon, lat))
                .hasIndoorShelter(shelter)
                .exitNumber(exit)
                .highway(highway)
                .build());
    }

    // -----------------------------------------------------------------------
    //  Road Segments — I-75, US-25, US-150, KY-80, Daniel Boone Pkwy
    // -----------------------------------------------------------------------

    private void seedRoadSegments() {
        // I-75 Lexington → Richmond
        saveRoad("i75-lex-rich", "I-75", "Lexington Exit 115", "Richmond Exit 95",
                new double[][]{{-84.3910, 37.8290}, {-84.3600, 37.7900}, {-84.3020, 37.7490}},
                65.0, 20.0);

        // I-75 Richmond → Berea
        saveRoad("i75-rich-berea", "I-75", "Richmond Exit 95", "Berea Exit 76",
                new double[][]{{-84.3020, 37.7490}, {-84.2960, 37.6700}, {-84.2900, 37.5700}},
                65.0, 19.0);

        // I-75 Berea → Mt Vernon
        saveRoad("i75-berea-mtv", "I-75", "Berea Exit 76", "Mt Vernon Exit 62",
                new double[][]{{-84.2900, 37.5700}, {-84.2600, 37.4500}, {-84.2200, 37.3530}},
                65.0, 14.0);

        // I-75 Mt Vernon → London (approaches tornado zone)
        saveRoad("i75-mtv-london", "I-75", "Mt Vernon Exit 62", "London Exit 38",
                new double[][]{{-84.2200, 37.3530}, {-84.1500, 37.2500}, {-84.0760, 37.1050}},
                65.0, 24.0);

        // I-75 London → Exit 29 (through tornado impact area)
        saveRoad("i75-london-29", "I-75", "London Exit 38", "Exit 29",
                new double[][]{{-84.0760, 37.1050}, {-84.1000, 37.0700}, {-84.1120, 37.0470}},
                65.0, 9.0);

        // I-75 Exit 29 → Williamsburg
        saveRoad("i75-29-wburg", "I-75", "Exit 29", "Williamsburg Exit 15",
                new double[][]{{-84.1120, 37.0470}, {-84.1400, 36.9500}, {-84.1600, 36.7430}},
                65.0, 14.0);

        // I-75 Williamsburg → Jellico (KY/TN border)
        saveRoad("i75-wburg-jellico", "I-75", "Williamsburg Exit 15", "Jellico Exit 160",
                new double[][]{{-84.1600, 36.7430}, {-84.1450, 36.6500}, {-84.1290, 36.5890}},
                65.0, 15.0);

        // US-25 London bypass (alternate to I-75 through London)
        saveRoad("us25-london-n", "US-25", "US-25 North London", "US-25 Downtown London",
                new double[][]{{-84.0900, 37.1300}, {-84.0920, 37.1100}, {-84.0870, 37.0880}},
                45.0, 4.0);
        saveRoad("us25-london-s", "US-25", "US-25 Downtown London", "US-25 South London",
                new double[][]{{-84.0870, 37.0880}, {-84.0950, 37.0650}, {-84.1100, 37.0400}},
                45.0, 5.0);

        // US-150 (connects I-75 at Mt Vernon to Stanford)
        saveRoad("us150-mtv-stan", "US-150", "Mt Vernon", "Stanford",
                new double[][]{{-84.2200, 37.3530}, {-84.3500, 37.3200}, {-84.6620, 37.5310}},
                55.0, 30.0);

        // KY-80 (east-west alternate south of London)
        saveRoad("ky80-london-w", "KY-80", "KY-80 / I-75 Junction", "KY-80 West",
                new double[][]{{-84.0870, 37.0880}, {-84.2000, 37.0600}, {-84.3500, 37.0400}},
                50.0, 18.0);
        saveRoad("ky80-london-e", "KY-80", "KY-80 / I-75 Junction", "KY-80 East",
                new double[][]{{-84.0870, 37.0880}, {-83.9500, 37.0700}, {-83.7500, 37.0500}},
                50.0, 20.0);

        // Daniel Boone Parkway (connects London area to Hazard via Hal Rogers Pkwy)
        saveRoad("dbp-london-east", "Daniel Boone Pkwy", "London I-75 Junction", "East Daniel Boone",
                new double[][]{{-84.0760, 37.1050}, {-83.9500, 37.1100}, {-83.8500, 37.1200}},
                65.0, 14.0);

        log.info("Seeded {} road segments.", roadSegmentRepository.count());
    }

    private void saveRoad(String segmentId, String highway, String from, String to,
                          double[][] coords, double speedLimit, double distance) {
        roadSegmentRepository.save(RoadSegmentEntity.builder()
                .segmentId(segmentId)
                .highway(highway)
                .fromName(from)
                .toName(to)
                .geometry(lineString(coords))
                .speedLimitMph(speedLimit)
                .distanceMiles(distance)
                .build());
    }

    // -----------------------------------------------------------------------
    //  Storm Data — May 16, 2025 London KY EF-4 tornado
    // -----------------------------------------------------------------------

    private void seedStormData() {
        Instant baseTime = Instant.parse("2025-05-16T21:30:00Z");

        // EF-4 tornado: Russell County → SE of London
        // Track: SW to NE across I-75 near London, KY
        String tornadoPredictedPath = """
                [
                  {"time": "%s", "vertices": [
                    {"lat": 37.0400, "lon": -84.1700},
                    {"lat": 37.0400, "lon": -84.1200},
                    {"lat": 37.0100, "lon": -84.1200},
                    {"lat": 37.0100, "lon": -84.1700}
                  ]},
                  {"time": "%s", "vertices": [
                    {"lat": 37.0800, "lon": -84.1200},
                    {"lat": 37.0800, "lon": -84.0700},
                    {"lat": 37.0500, "lon": -84.0700},
                    {"lat": 37.0500, "lon": -84.1200}
                  ]},
                  {"time": "%s", "vertices": [
                    {"lat": 37.1200, "lon": -84.0700},
                    {"lat": 37.1200, "lon": -84.0200},
                    {"lat": 37.0900, "lon": -84.0200},
                    {"lat": 37.0900, "lon": -84.0700}
                  ]},
                  {"time": "%s", "vertices": [
                    {"lat": 37.1600, "lon": -84.0200},
                    {"lat": 37.1600, "lon": -83.9700},
                    {"lat": 37.1300, "lon": -83.9700},
                    {"lat": 37.1300, "lon": -84.0200}
                  ]}
                ]
                """.formatted(
                baseTime,
                baseTime.plus(15, ChronoUnit.MINUTES),
                baseTime.plus(30, ChronoUnit.MINUTES),
                baseTime.plus(45, ChronoUnit.MINUTES));

        stormCellRepository.save(StormCellEntity.builder()
                .stormId("cell-tor-20250516-001")
                .location(point(-84.1450, 37.0250))
                .velocityX(22.0)
                .velocityY(20.0)
                .vil(72.0)
                .rotation(32.0)
                .hazardType(HazardType.TORNADO)
                .predictedPathJson(tornadoPredictedPath)
                .active(true)
                .createdAt(baseTime)
                .expiresAt(baseTime.plus(2, ChronoUnit.HOURS))
                .build());

        // Trailing severe thunderstorm cell
        String svrPredictedPath = """
                [
                  {"time": "%s", "vertices": [
                    {"lat": 36.9800, "lon": -84.2500},
                    {"lat": 36.9800, "lon": -84.2000},
                    {"lat": 36.9500, "lon": -84.2000},
                    {"lat": 36.9500, "lon": -84.2500}
                  ]},
                  {"time": "%s", "vertices": [
                    {"lat": 37.0200, "lon": -84.1800},
                    {"lat": 37.0200, "lon": -84.1300},
                    {"lat": 36.9900, "lon": -84.1300},
                    {"lat": 36.9900, "lon": -84.1800}
                  ]}
                ]
                """.formatted(
                baseTime,
                baseTime.plus(20, ChronoUnit.MINUTES));

        stormCellRepository.save(StormCellEntity.builder()
                .stormId("cell-svr-20250516-002")
                .location(point(-84.2250, 36.9650))
                .velocityX(18.0)
                .velocityY(16.0)
                .vil(48.0)
                .rotation(6.5)
                .hazardType(HazardType.SEVERE_THUNDERSTORM)
                .predictedPathJson(svrPredictedPath)
                .active(true)
                .createdAt(baseTime)
                .expiresAt(baseTime.plus(2, ChronoUnit.HOURS))
                .build());

        // Tornado Warning — covers I-75 exits 25-41 near London
        weatherAlertRepository.save(WeatherAlertEntity.builder()
                .alertId("NWS-TOR-20250516-0042")
                .hazardType(HazardType.TORNADO)
                .severity("Extreme")
                .polygon(polygon(new double[][]{
                        {-84.2000, 37.1600},
                        {-83.9500, 37.1600},
                        {-83.9500, 37.0000},
                        {-84.2000, 37.0000}
                }))
                .effectiveTime(baseTime)
                .expirationTime(baseTime.plus(45, ChronoUnit.MINUTES))
                .active(true)
                .build());

        // Severe Thunderstorm Warning — trailing SW
        weatherAlertRepository.save(WeatherAlertEntity.builder()
                .alertId("NWS-SVR-20250516-0038")
                .hazardType(HazardType.SEVERE_THUNDERSTORM)
                .severity("Severe")
                .polygon(polygon(new double[][]{
                        {-84.3000, 37.0200},
                        {-84.1500, 37.0200},
                        {-84.1500, 36.9200},
                        {-84.3000, 36.9200}
                }))
                .effectiveTime(baseTime.minus(10, ChronoUnit.MINUTES))
                .expirationTime(baseTime.plus(50, ChronoUnit.MINUTES))
                .active(true)
                .build());

        // Flash Flood Watch — broader area around London
        weatherAlertRepository.save(WeatherAlertEntity.builder()
                .alertId("NWS-FFA-20250516-0025")
                .hazardType(HazardType.FLASH_FLOOD)
                .severity("Moderate")
                .polygon(polygon(new double[][]{
                        {-84.4000, 37.3000},
                        {-83.8000, 37.3000},
                        {-83.8000, 36.8000},
                        {-84.4000, 36.8000}
                }))
                .effectiveTime(baseTime.minus(3, ChronoUnit.HOURS))
                .expirationTime(baseTime.plus(6, ChronoUnit.HOURS))
                .active(true)
                .build());

        log.info("Seeded {} storm cells and {} weather alerts.",
                stormCellRepository.count(), weatherAlertRepository.count());
    }
}
