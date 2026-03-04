package com.weatherwise.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class MLPredictionService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ml.service.url}")
    private String mlServiceUrl;

    public MLPredictionService(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public MLPrediction predict(double lat, double lon, int month, int hour,
                                boolean isNighttime, double rotation, double vil) {
        try {
            Map<String, Object> request = new HashMap<>();
            request.put("lat", lat);
            request.put("lon", lon);
            request.put("month", month);
            request.put("hour", hour);
            request.put("is_nighttime", isNighttime);
            request.put("magnitude", 0.0);
            request.put("state", "");
            request.put("rotation", rotation);
            request.put("vil", vil);
            request.put("cape", 0.0);
            request.put("wind_shear", 0.0);

            String response = restTemplate.postForObject(
                    mlServiceUrl + "/predict", request, String.class);

            return parsePrediction(response);
        } catch (Exception e) {
            log.debug("ML service unavailable: {}", e.getMessage());
            return null;
        }
    }

    public boolean isAvailable() {
        try {
            String response = restTemplate.getForObject(mlServiceUrl + "/health", String.class);
            return response != null && response.contains("ok");
        } catch (Exception e) {
            return false;
        }
    }

    private MLPrediction parsePrediction(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            return new MLPrediction(
                    root.path("hazard_type").asText(),
                    root.path("probability").asDouble(),
                    root.path("severity_estimate").asText("Unknown"),
                    root.path("confidence").asDouble()
            );
        } catch (Exception e) {
            log.warn("Failed to parse ML prediction: {}", e.getMessage());
            return null;
        }
    }

    public record MLPrediction(String hazardType, double probability,
                                String severityEstimate, double confidence) {}
}
