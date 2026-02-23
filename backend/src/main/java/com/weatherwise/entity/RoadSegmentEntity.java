package com.weatherwise.entity;

import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.LineString;

import java.util.UUID;

@Entity
@Table(name = "road_segments")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoadSegmentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String segmentId;

    @Column(nullable = false)
    private String highway;

    @Column(nullable = false)
    private String fromName;

    @Column(nullable = false)
    private String toName;

    @Column(columnDefinition = "geometry(LineString,4326)", nullable = false)
    private LineString geometry;

    @Column(nullable = false)
    private Double speedLimitMph;

    @Column(nullable = false)
    private Double distanceMiles;
}
