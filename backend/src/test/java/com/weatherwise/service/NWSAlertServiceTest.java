package com.weatherwise.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.weatherwise.entity.WeatherAlertEntity;
import com.weatherwise.model.HazardType;
import com.weatherwise.repository.WeatherAlertRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NWSAlertServiceTest {

    @Mock
    private RestTemplate restTemplate;
    @Mock
    private WeatherAlertRepository alertRepository;

    private NWSAlertService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        service = new NWSAlertService(restTemplate, objectMapper, alertRepository);
        ReflectionTestUtils.setField(service, "nwsBaseUrl", "https://api.weather.gov");
        ReflectionTestUtils.setField(service, "userAgent", "(WeatherWise,test@example.com)");
    }

    private static final String TORNADO_GEOJSON = """
            {
                "type": "FeatureCollection",
                "features": [{
                    "type": "Feature",
                    "properties": {
                        "id": "NWS-TOR-001",
                        "event": "Tornado Warning",
                        "severity": "Extreme",
                        "effective": "2025-05-16T21:30:00Z",
                        "expires": "2025-05-16T23:30:00Z"
                    },
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-84.10, 37.05],
                            [-84.05, 37.05],
                            [-84.05, 37.15],
                            [-84.10, 37.15],
                            [-84.10, 37.05]
                        ]]
                    }
                }]
            }
            """;

    private static final String MULTI_EVENT_GEOJSON = """
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {
                            "id": "NWS-TOR-001",
                            "event": "Tornado Warning",
                            "severity": "Extreme",
                            "effective": "2025-05-16T21:30:00Z",
                            "expires": "2025-05-16T23:30:00Z"
                        },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[[-84.10,37.05],[-84.05,37.05],[-84.05,37.15],[-84.10,37.15],[-84.10,37.05]]]
                        }
                    },
                    {
                        "type": "Feature",
                        "properties": {
                            "id": "NWS-FF-001",
                            "event": "Flash Flood Warning",
                            "severity": "Severe",
                            "effective": "2025-05-16T21:30:00Z",
                            "expires": "2025-05-17T03:30:00Z"
                        },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[[-84.20,37.00],[-84.00,37.00],[-84.00,37.20],[-84.20,37.20],[-84.20,37.00]]]
                        }
                    },
                    {
                        "type": "Feature",
                        "properties": {
                            "id": "NWS-UNKNOWN-001",
                            "event": "Air Quality Alert",
                            "severity": "Minor",
                            "effective": "2025-05-16T21:30:00Z",
                            "expires": "2025-05-17T12:00:00Z"
                        },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[[-84.20,37.00],[-84.00,37.00],[-84.00,37.20],[-84.20,37.20],[-84.20,37.00]]]
                        }
                    }
                ]
            }
            """;

    @Test
    @DisplayName("Parses tornado warning GeoJSON correctly")
    void parsesTornadoWarning() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(TORNADO_GEOJSON, HttpStatus.OK));

        List<WeatherAlertEntity> alerts = service.getActiveAlerts(37.09, -84.08, 50.0);

        assertEquals(1, alerts.size());
        WeatherAlertEntity alert = alerts.get(0);
        assertEquals("NWS-TOR-001", alert.getAlertId());
        assertEquals(HazardType.TORNADO, alert.getHazardType());
        assertEquals("Extreme", alert.getSeverity());
        assertNotNull(alert.getPolygon());
        assertTrue(alert.getActive());
    }

    @Test
    @DisplayName("Filters out unmapped event types")
    void filtersUnmappedEvents() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(MULTI_EVENT_GEOJSON, HttpStatus.OK));

        List<WeatherAlertEntity> alerts = service.getActiveAlerts(37.09, -84.08, 50.0);

        // Should parse tornado + flash flood, skip "Air Quality Alert"
        assertEquals(2, alerts.size());
        assertTrue(alerts.stream().anyMatch(a -> a.getHazardType() == HazardType.TORNADO));
        assertTrue(alerts.stream().anyMatch(a -> a.getHazardType() == HazardType.FLASH_FLOOD));
    }

    @Test
    @DisplayName("Falls back to DB alerts when NWS API fails")
    void fallsBackToDbOnFailure() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenThrow(new RuntimeException("Connection refused"));
        when(alertRepository.findActiveAlertsWithinRadius(anyDouble(), anyDouble(), anyDouble()))
                .thenReturn(Collections.emptyList());

        List<WeatherAlertEntity> alerts = service.getActiveAlerts(37.09, -84.08, 50.0);

        assertNotNull(alerts);
        verify(alertRepository).findActiveAlertsWithinRadius(eq(37.09), eq(-84.08), anyDouble());
    }

    @Test
    @DisplayName("Caches NWS results for 60 seconds")
    void cachesResults() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(TORNADO_GEOJSON, HttpStatus.OK));

        // First call hits NWS
        service.getActiveAlerts(37.09, -84.08, 50.0);
        // Second call should use cache
        service.getActiveAlerts(37.09, -84.08, 50.0);

        verify(restTemplate, times(1)).exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class));
    }

    @Test
    @DisplayName("Handles empty feature collection")
    void handlesEmptyFeatures() {
        String emptyJson = """
                {"type": "FeatureCollection", "features": []}
                """;
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(emptyJson, HttpStatus.OK));

        List<WeatherAlertEntity> alerts = service.getActiveAlerts(37.09, -84.08, 50.0);

        assertNotNull(alerts);
        assertTrue(alerts.isEmpty());
    }

    @Test
    @DisplayName("Handles null response body")
    void handlesNullBody() {
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(null, HttpStatus.NOT_FOUND));

        List<WeatherAlertEntity> alerts = service.getActiveAlerts(37.09, -84.08, 50.0);

        assertNotNull(alerts);
        assertTrue(alerts.isEmpty());
    }

    @Test
    @DisplayName("Skips features with no geometry")
    void skipsNoGeometry() {
        String noGeomJson = """
                {
                    "type": "FeatureCollection",
                    "features": [{
                        "type": "Feature",
                        "properties": {
                            "id": "NWS-NO-GEOM",
                            "event": "Tornado Warning",
                            "severity": "Extreme",
                            "effective": "2025-05-16T21:30:00Z",
                            "expires": "2025-05-16T23:30:00Z"
                        },
                        "geometry": null
                    }]
                }
                """;
        when(restTemplate.exchange(anyString(), eq(HttpMethod.GET), any(HttpEntity.class), eq(String.class)))
                .thenReturn(new ResponseEntity<>(noGeomJson, HttpStatus.OK));

        List<WeatherAlertEntity> alerts = service.getActiveAlerts(37.09, -84.08, 50.0);

        assertTrue(alerts.isEmpty());
    }
}
