package com.weatherwise.entity;

import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Point;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "traveler_sessions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TravelerSessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String sessionToken;

    @Column(columnDefinition = "geometry(Point,4326)", nullable = false)
    private Point lastKnownLocation;

    @Column(nullable = false)
    private Double heading;

    @Column(nullable = false)
    private Double speedMph;

    @Column(nullable = false)
    private Instant lastUpdated;

    @Column(nullable = false)
    private Boolean active;
}
