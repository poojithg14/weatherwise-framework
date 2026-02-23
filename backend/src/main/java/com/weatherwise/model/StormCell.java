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
public class StormCell {
    private String id;
    private Double lat;
    private Double lon;
    private Double velocityX;
    private Double velocityY;
    private Double vil;
    private Double rotation;
    private HazardType hazardType;
    private List<TimedPolygon> predictedPath;
}
