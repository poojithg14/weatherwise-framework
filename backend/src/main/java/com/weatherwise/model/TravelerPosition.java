package com.weatherwise.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TravelerPosition {
    private Double lat;
    private Double lon;
    private Double heading;
    private Double speedMph;
    private String timestamp;
}
