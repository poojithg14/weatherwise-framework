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
public class WeatherAlert {
    private String id;
    private HazardType type;
    private String severity;
    private List<Coordinate> polygon;
    private String effectiveTime;
    private String expirationTime;
}
