package com.weatherwise.entity;

import com.weatherwise.model.HazardType;
import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Point;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "storm_cells")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StormCellEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String stormId;

    @Column(columnDefinition = "geometry(Point,4326)", nullable = false)
    private Point location;

    @Column(nullable = false)
    private Double velocityX;

    @Column(nullable = false)
    private Double velocityY;

    @Column(nullable = false)
    private Double vil;

    @Column(nullable = false)
    private Double rotation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private HazardType hazardType;

    @Column(columnDefinition = "TEXT")
    private String predictedPathJson;

    @Column(nullable = false)
    private Boolean active;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant expiresAt;
}
