package com.weatherwise.service;

import com.weatherwise.entity.StormCellEntity;
import com.weatherwise.entity.TravelerSessionEntity;
import com.weatherwise.entity.WeatherAlertEntity;
import com.weatherwise.model.HazardType;
import com.weatherwise.repository.StormCellRepository;
import com.weatherwise.repository.TravelerSessionRepository;
import com.weatherwise.repository.WeatherAlertRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.*;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AlertIngestionServiceTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @Mock
    private NWSAlertService nwsAlertService;
    @Mock
    private WeatherAlertRepository weatherAlertRepository;
    @Mock
    private StormCellRepository stormCellRepository;
    @Mock
    private TravelerSessionRepository travelerSessionRepository;

    @InjectMocks
    private AlertIngestionService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "radiusMiles", 75.0);
        ReflectionTestUtils.setField(service, "corridorPoints", "37.09,-84.08");
    }

    private Polygon createTestPolygon(double lat, double lon) {
        double d = 0.05;
        Coordinate[] coords = {
                new Coordinate(lon - d, lat - d),
                new Coordinate(lon + d, lat - d),
                new Coordinate(lon + d, lat + d),
                new Coordinate(lon - d, lat + d),
                new Coordinate(lon - d, lat - d)
        };
        return GF.createPolygon(coords);
    }

    private WeatherAlertEntity createTestAlert(String alertId, HazardType type) {
        return WeatherAlertEntity.builder()
                .alertId(alertId)
                .hazardType(type)
                .severity("Extreme")
                .polygon(createTestPolygon(37.09, -84.08))
                .effectiveTime(Instant.now())
                .expirationTime(Instant.now().plus(2, ChronoUnit.HOURS))
                .active(true)
                .build();
    }

    @Test
    @DisplayName("ingestAlerts persists new alerts and creates storm cells")
    void ingestAlertsPersistsNewData() {
        WeatherAlertEntity alert = createTestAlert("NWS-001", HazardType.TORNADO);

        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(alert));
        when(weatherAlertRepository.findByAlertId("NWS-001"))
                .thenReturn(Optional.empty());
        when(stormCellRepository.findByStormId("nws-NWS-001"))
                .thenReturn(Optional.empty());

        service.ingestAlerts();

        verify(weatherAlertRepository).save(alert);
        ArgumentCaptor<StormCellEntity> stormCaptor = ArgumentCaptor.forClass(StormCellEntity.class);
        verify(stormCellRepository).save(stormCaptor.capture());

        StormCellEntity saved = stormCaptor.getValue();
        assertEquals("nws-NWS-001", saved.getStormId());
        assertEquals(HazardType.TORNADO, saved.getHazardType());
        assertEquals(20.0, saved.getVelocityX());
        assertEquals(18.0, saved.getVelocityY());
        assertEquals(65.0, saved.getVil());
        assertEquals(25.0, saved.getRotation());
        assertTrue(saved.getActive());
    }

    @Test
    @DisplayName("ingestAlerts skips already-persisted alerts")
    void ingestAlertsSkipsDuplicates() {
        WeatherAlertEntity alert = createTestAlert("NWS-DUP", HazardType.TORNADO);

        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(alert));
        when(weatherAlertRepository.findByAlertId("NWS-DUP"))
                .thenReturn(Optional.of(alert));

        service.ingestAlerts();

        verify(weatherAlertRepository, never()).save(any());
        verify(stormCellRepository, never()).save(any());
    }

    @Test
    @DisplayName("ingestAlerts handles NWS API failure gracefully")
    void ingestAlertsHandlesFailure() {
        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenThrow(new RuntimeException("NWS API down"));

        assertDoesNotThrow(() -> service.ingestAlerts());
    }

    @Test
    @DisplayName("expireStaleData deactivates expired alerts and storms")
    void expireStaleDataDeactivatesExpired() {
        WeatherAlertEntity expiredAlert = createTestAlert("EXP-001", HazardType.TORNADO);
        expiredAlert.setExpirationTime(Instant.now().minus(1, ChronoUnit.HOURS));
        expiredAlert.setActive(true);

        StormCellEntity expiredStorm = StormCellEntity.builder()
                .stormId("nws-EXP-001")
                .location(GF.createPoint(new Coordinate(-84.08, 37.09)))
                .hazardType(HazardType.TORNADO)
                .velocityX(20.0).velocityY(18.0).vil(65.0).rotation(25.0)
                .active(true)
                .createdAt(Instant.now().minus(3, ChronoUnit.HOURS))
                .expiresAt(Instant.now().minus(1, ChronoUnit.HOURS))
                .build();

        when(weatherAlertRepository.findByActiveTrue()).thenReturn(List.of(expiredAlert));
        when(stormCellRepository.findByActiveTrue()).thenReturn(List.of(expiredStorm));

        service.expireStaleData();

        assertFalse(expiredAlert.getActive());
        assertFalse(expiredStorm.getActive());
        verify(weatherAlertRepository).save(expiredAlert);
        verify(stormCellRepository).save(expiredStorm);
    }

    @Test
    @DisplayName("expireStaleData does not deactivate non-expired data")
    void expireStaleDataKeepsActive() {
        WeatherAlertEntity activeAlert = createTestAlert("ACT-001", HazardType.TORNADO);
        activeAlert.setExpirationTime(Instant.now().plus(2, ChronoUnit.HOURS));

        StormCellEntity activeStorm = StormCellEntity.builder()
                .stormId("nws-ACT-001")
                .location(GF.createPoint(new Coordinate(-84.08, 37.09)))
                .hazardType(HazardType.TORNADO)
                .velocityX(20.0).velocityY(18.0).vil(65.0).rotation(25.0)
                .active(true)
                .createdAt(Instant.now())
                .expiresAt(Instant.now().plus(2, ChronoUnit.HOURS))
                .build();

        when(weatherAlertRepository.findByActiveTrue()).thenReturn(List.of(activeAlert));
        when(stormCellRepository.findByActiveTrue()).thenReturn(List.of(activeStorm));

        service.expireStaleData();

        assertTrue(activeAlert.getActive());
        assertTrue(activeStorm.getActive());
        verify(weatherAlertRepository, never()).save(any());
        verify(stormCellRepository, never()).save(any());
    }

    @Test
    @DisplayName("convertAlertToStorm assigns correct kinematics per hazard type")
    void convertAssignsCorrectKinematics() {
        // Test SEVERE_THUNDERSTORM kinematics
        WeatherAlertEntity tsAlert = createTestAlert("TS-001", HazardType.SEVERE_THUNDERSTORM);
        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(tsAlert));
        when(weatherAlertRepository.findByAlertId("TS-001")).thenReturn(Optional.empty());
        when(stormCellRepository.findByStormId("nws-TS-001")).thenReturn(Optional.empty());

        service.ingestAlerts();

        ArgumentCaptor<StormCellEntity> captor = ArgumentCaptor.forClass(StormCellEntity.class);
        verify(stormCellRepository).save(captor.capture());
        StormCellEntity storm = captor.getValue();

        assertEquals(15.0, storm.getVelocityX());
        assertEquals(12.0, storm.getVelocityY());
        assertEquals(45.0, storm.getVil());
        assertEquals(5.0, storm.getRotation());
    }

    @Test
    @DisplayName("ingestAlerts includes traveler session locations in polling")
    void ingestAlertsIncludesTravelerLocations() {
        TravelerSessionEntity session = mock(TravelerSessionEntity.class);
        Point mockPoint = GF.createPoint(new Coordinate(-85.50, 38.20));
        when(session.getLastKnownLocation()).thenReturn(mockPoint);

        when(travelerSessionRepository.findByActiveTrue()).thenReturn(List.of(session));
        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());

        service.ingestAlerts();

        // Should have polled for corridor point (1) + traveler session (1) = 2 locations
        verify(nwsAlertService, atLeast(2)).getActiveAlerts(anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    @DisplayName("ingestAlerts with flash flood creates stationary storm cell")
    void ingestFlashFloodCreatesStationaryStorm() {
        WeatherAlertEntity floodAlert = createTestAlert("FLOOD-001", HazardType.FLASH_FLOOD);
        when(nwsAlertService.getActiveAlerts(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(List.of(floodAlert));
        when(weatherAlertRepository.findByAlertId("FLOOD-001")).thenReturn(Optional.empty());
        when(stormCellRepository.findByStormId("nws-FLOOD-001")).thenReturn(Optional.empty());

        service.ingestAlerts();

        ArgumentCaptor<StormCellEntity> captor = ArgumentCaptor.forClass(StormCellEntity.class);
        verify(stormCellRepository).save(captor.capture());
        StormCellEntity storm = captor.getValue();

        assertEquals(0.0, storm.getVelocityX());
        assertEquals(0.0, storm.getVelocityY());
        assertEquals(50.0, storm.getVil());
        assertEquals(0.0, storm.getRotation());
    }
}
