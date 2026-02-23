package com.weatherwise.entity;

import com.weatherwise.model.LocationType;
import jakarta.persistence.*;
import lombok.*;
import org.locationtech.jts.geom.Point;

import java.util.UUID;

@Entity
@Table(name = "safe_locations")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SafeLocationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LocationType locationType;

    @Column(columnDefinition = "geometry(Point,4326)", nullable = false)
    private Point location;

    @Column(nullable = false)
    private Boolean hasIndoorShelter;

    private String exitNumber;

    private String highway;
}
