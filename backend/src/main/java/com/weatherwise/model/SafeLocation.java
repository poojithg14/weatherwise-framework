package com.weatherwise.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SafeLocation {
    private String name;
    private LocationType locationType;
    private Double lat;
    private Double lon;
    private Double distanceMiles;
    private Boolean hasIndoorShelter;
    private String exitNumber;
}
