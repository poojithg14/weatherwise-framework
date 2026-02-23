package com.weatherwise.entity;

import com.weatherwise.model.ActionType;
import com.weatherwise.model.AlertTier;
import com.weatherwise.model.HazardType;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "risk_assessment_logs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskAssessmentLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "traveler_session_id", nullable = false)
    private TravelerSessionEntity travelerSession;

    @Column(nullable = false)
    private Double overallScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlertTier tier;

    private Double timeToIntersectionMinutes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActionType recommendedAction;

    @Enumerated(EnumType.STRING)
    private HazardType hazardType;

    @Column(columnDefinition = "TEXT")
    private String alertMessage;

    @Column(nullable = false)
    private Instant computedAt;
}
