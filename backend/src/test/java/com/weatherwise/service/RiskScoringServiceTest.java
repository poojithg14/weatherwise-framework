package com.weatherwise.service;

import com.weatherwise.algorithm.TravelerRiskScorer;
import com.weatherwise.algorithm.SafeRouteOptimizer;
import com.weatherwise.entity.*;
import com.weatherwise.model.*;
import com.weatherwise.repository.RiskAssessmentLogRepository;
import com.weatherwise.repository.SafeLocationRepository;
import com.weatherwise.repository.StormCellRepository;
import com.weatherwise.resolver.StormCellResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Polygon;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RiskScoringServiceTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Mock
    private TravelerRiskScorer riskScorer;
    @Mock
    private SafeRouteOptimizer routeOptimizer;
    @Mock
    private StormCellRepository stormCellRepository;
    @Mock
    private SafeLocationRepository safeLocationRepository;
    @Mock
    private RiskAssessmentLogRepository riskLogRepository;
    @Mock
    private StormCellResolver stormCellResolver;
    @Mock
    private NWSAlertService nwsAlertService;
    @Mock
    private MLPredictionService mlPredictionService;

    private RiskScoringService service;

    @BeforeEach
    void setUp() {
        service = new RiskScoringService(
                riskScorer, routeOptimizer, stormCellRepository,
                safeLocationRepository, riskLogRepository,
                stormCellResolver, nwsAlertService, mlPredictionService);
        ReflectionTestUtils.setField(service, "stormRadiusMiles", 50.0);
    }

    private StormCellEntity createStormEntity(String stormId) {
        return StormCellEntity.builder()
                .stormId(stormId)
                .location(GF.createPoint(new org.locationtech.jts.geom.Coordinate(-84.08, 37.09)))
                .velocityX(20.0).velocityY(18.0).vil(65.0).rotation(25.0)
                .hazardType(HazardType.TORNADO)
                .active(true)
                .createdAt(Instant.now())
                .expiresAt(Instant.now().plus(2, ChronoUnit.HOURS))
                .build();
    }

    private SafeLocationEntity createSafeLocationEntity(String name) {
        return SafeLocationEntity.builder()
                .name(name)
                .locationType(LocationType.TRUCK_STOP)
                .location(GF.createPoint(new org.locationtech.jts.geom.Coordinate(-85.22, 38.21)))
                .hasIndoorShelter(true)
                .exitNumber("28")
                .build();
    }

    private StormCell createStormModel(String id) {
        return StormCell.builder()
                .id(id)
                .lat(37.09).lon(-84.08)
                .velocityX(20.0).velocityY(18.0)
                .vil(65.0).rotation(25.0)
                .hazardType(HazardType.TORNADO)
                .predictedPath(Collections.emptyList())
                .build();
    }

    private Polygon createTestPolygon() {
        org.locationtech.jts.geom.Coordinate[] coords = {
                new org.locationtech.jts.geom.Coordinate(-84.10, 37.05),
                new org.locationtech.jts.geom.Coordinate(-84.05, 37.05),
                new org.locationtech.jts.geom.Coordinate(-84.05, 37.15),
                new org.locationtech.jts.geom.Coordinate(-84.10, 37.15),
                new org.locationtech.jts.geom.Coordinate(-84.10, 37.05)
        };
        return GF.createPolygon(coords);
    }

    @Test
    @DisplayName("computeFullRisk returns valid risk assessment")
    void computeFullRiskReturnsValidResult() {
        StormCellEntity stormEntity = createStormEntity("storm-001");
        StormCell stormModel = createStormModel("storm-001");
        SafeLocationEntity safeEntity = createSafeLocationEntity("Test Shelter");

        when(stormCellRepository.findActiveStormsWithinRadius(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(stormEntity));
        when(stormCellResolver.toModel(stormEntity)).thenReturn(stormModel);
        when(safeLocationRepository.findNearestSafeLocations(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(safeEntity));
        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());

        RiskAssessment expectedRisk = RiskAssessment.builder()
                .overallScore(45.0)
                .tier(AlertTier.ADVISORY)
                .recommendedAction(ActionType.REROUTE)
                .alertMessage("Advisory: weather conditions ahead")
                .hazardType(HazardType.TORNADO)
                .hazardSpecificGuidance("Seek shelter if conditions worsen")
                .build();
        when(riskScorer.computeRisk(any(), anyList(), anyList(), anyBoolean()))
                .thenReturn(expectedRisk);

        RiskAssessment result = service.computeFullRisk(37.09, -84.08, 180, 70, null);

        assertNotNull(result);
        assertEquals(AlertTier.ADVISORY, result.getTier());
        assertEquals(ActionType.REROUTE, result.getRecommendedAction());
    }

    @Test
    @DisplayName("computeFullRisk merges live NWS alerts into storms list")
    void computeFullRiskMergesNWSAlerts() {
        when(stormCellRepository.findActiveStormsWithinRadius(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());
        when(safeLocationRepository.findNearestSafeLocations(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());

        WeatherAlertEntity liveAlert = WeatherAlertEntity.builder()
                .alertId("NWS-LIVE-001")
                .hazardType(HazardType.TORNADO)
                .severity("Extreme")
                .polygon(createTestPolygon())
                .effectiveTime(Instant.now())
                .expirationTime(Instant.now().plus(2, ChronoUnit.HOURS))
                .active(true)
                .build();

        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(liveAlert));

        RiskAssessment mockRisk = RiskAssessment.builder()
                .overallScore(60.0)
                .tier(AlertTier.ACTION_REQUIRED)
                .recommendedAction(ActionType.EXIT_TO_SHELTER)
                .alertMessage("Take shelter")
                .hazardType(HazardType.TORNADO)
                .build();
        when(riskScorer.computeRisk(any(), anyList(), anyList(), anyBoolean()))
                .thenReturn(mockRisk);

        service.computeFullRisk(37.09, -84.08, 180, 70, null);

        // Verify that computeRisk was called with a storms list containing the NWS alert
        verify(riskScorer).computeRisk(any(), argThat(storms ->
                storms.stream().anyMatch(s -> "nws-NWS-LIVE-001".equals(s.getId()))
        ), anyList(), anyBoolean());
    }

    @Test
    @DisplayName("computeFullRisk deduplicates NWS alerts already in DB")
    void computeFullRiskDeduplicatesAlerts() {
        StormCellEntity dbStorm = createStormEntity("nws-NWS-001");
        StormCell dbModel = createStormModel("nws-NWS-001");

        when(stormCellRepository.findActiveStormsWithinRadius(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(dbStorm));
        when(stormCellResolver.toModel(dbStorm)).thenReturn(dbModel);
        when(safeLocationRepository.findNearestSafeLocations(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());

        WeatherAlertEntity duplicateAlert = WeatherAlertEntity.builder()
                .alertId("NWS-001")
                .hazardType(HazardType.TORNADO)
                .severity("Extreme")
                .polygon(createTestPolygon())
                .effectiveTime(Instant.now())
                .expirationTime(Instant.now().plus(2, ChronoUnit.HOURS))
                .active(true)
                .build();

        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(duplicateAlert));

        RiskAssessment mockRisk = RiskAssessment.builder()
                .overallScore(30.0)
                .tier(AlertTier.ADVISORY)
                .recommendedAction(ActionType.CONTINUE_MONITORING)
                .alertMessage("Monitoring")
                .build();
        when(riskScorer.computeRisk(any(), anyList(), anyList(), anyBoolean()))
                .thenReturn(mockRisk);

        service.computeFullRisk(37.09, -84.08, 180, 70, null);

        // Should only have 1 storm (the DB one), not duplicated
        verify(riskScorer).computeRisk(any(), argThat(storms -> storms.size() == 1), anyList(), anyBoolean());
    }

    @Test
    @DisplayName("computeFullRisk handles NWS failure gracefully")
    void computeFullRiskHandlesNWSFailure() {
        when(stormCellRepository.findActiveStormsWithinRadius(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());
        when(safeLocationRepository.findNearestSafeLocations(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());
        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenThrow(new RuntimeException("NWS down"));

        RiskAssessment mockRisk = RiskAssessment.builder()
                .overallScore(10.0)
                .tier(AlertTier.MONITORING)
                .recommendedAction(ActionType.CONTINUE_MONITORING)
                .alertMessage("No hazards detected")
                .build();
        when(riskScorer.computeRisk(any(), anyList(), anyList(), anyBoolean()))
                .thenReturn(mockRisk);

        RiskAssessment result = service.computeFullRisk(37.09, -84.08, 180, 70, null);

        assertNotNull(result);
        assertEquals(AlertTier.MONITORING, result.getTier());
    }

    @Test
    @DisplayName("computeFullRisk applies ML multiplier for high-confidence tornado prediction")
    void computeFullRiskAppliesMLMultiplier() {
        when(stormCellRepository.findActiveStormsWithinRadius(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());
        when(safeLocationRepository.findNearestSafeLocations(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());
        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());

        RiskAssessment baseRisk = RiskAssessment.builder()
                .overallScore(50.0)
                .tier(AlertTier.ACTION_REQUIRED)
                .recommendedAction(ActionType.REROUTE)
                .alertMessage("Moderate risk")
                .build();
        when(riskScorer.computeRisk(any(), anyList(), anyList(), anyBoolean()))
                .thenReturn(baseRisk);

        MLPredictionService.MLPrediction mlPrediction =
                new MLPredictionService.MLPrediction("TORNADO", 0.85, "Extreme", 0.9);
        when(mlPredictionService.predict(anyDouble(), anyDouble(), anyInt(), anyInt(), anyBoolean(), anyDouble(), anyDouble()))
                .thenReturn(mlPrediction);

        RiskAssessment result = service.computeFullRisk(37.09, -84.08, 180, 70, null);

        // ML multiplier of 1.2 should increase score from 50 to 60
        assertEquals(60.0, result.getOverallScore(), 0.01);
    }

    @Test
    @DisplayName("computeFullRisk logs risk assessment when session provided")
    void computeFullRiskLogsToDb() {
        when(stormCellRepository.findActiveStormsWithinRadius(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());
        when(safeLocationRepository.findNearestSafeLocations(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());
        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());

        RiskAssessment mockRisk = RiskAssessment.builder()
                .overallScore(25.0)
                .tier(AlertTier.ADVISORY)
                .recommendedAction(ActionType.REROUTE)
                .alertMessage("Advisory")
                .hazardType(HazardType.SEVERE_THUNDERSTORM)
                .build();
        when(riskScorer.computeRisk(any(), anyList(), anyList(), anyBoolean()))
                .thenReturn(mockRisk);

        TravelerSessionEntity session = mock(TravelerSessionEntity.class);

        service.computeFullRisk(37.09, -84.08, 180, 70, session);

        verify(riskLogRepository).save(any(RiskAssessmentLogEntity.class));
    }

    @Test
    @DisplayName("computeFullRisk does not log when no session")
    void computeFullRiskDoesNotLogWithoutSession() {
        when(stormCellRepository.findActiveStormsWithinRadius(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());
        when(safeLocationRepository.findNearestSafeLocations(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());
        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());

        RiskAssessment mockRisk = RiskAssessment.builder()
                .overallScore(10.0)
                .tier(AlertTier.MONITORING)
                .recommendedAction(ActionType.CONTINUE_MONITORING)
                .alertMessage("Clear")
                .build();
        when(riskScorer.computeRisk(any(), anyList(), anyList(), anyBoolean()))
                .thenReturn(mockRisk);

        service.computeFullRisk(37.09, -84.08, 180, 70, null);

        verify(riskLogRepository, never()).save(any());
    }
}
