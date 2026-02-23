package com.weatherwise.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskAssessment {
    private Double overallScore;
    private AlertTier tier;
    private Double timeToIntersectionMinutes;
    private ActionType recommendedAction;
    private HazardType hazardType;
    private String alertMessage;
    private String hazardSpecificGuidance;
}
