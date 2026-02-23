package com.weatherwise.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlternateRoute {
    private List<Coordinate> waypoints;
    private Double distanceMiles;
    private Double estimatedMinutes;
    private Double safetyScore;
}
