package com.weatherwise.entity;

import com.weatherwise.model.HazardType;
import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Polygon;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "weather_alerts")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WeatherAlertEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String alertId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HazardType hazardType;

    @Column(nullable = false)
    private String severity;

    @Column(columnDefinition = "geometry(Polygon,4326)", nullable = false)
    private Polygon polygon;

    @Column(nullable = false)
    private Instant effectiveTime;

    @Column(nullable = false)
    private Instant expirationTime;

    @Column(nullable = false)
    private Boolean active;
}
