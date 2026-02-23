package com.weatherwise.repository;

import com.weatherwise.entity.SafeLocationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SafeLocationRepository extends JpaRepository<SafeLocationEntity, UUID> {

    @Query(value = """
            SELECT *, ST_Distance(
                s.location::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
            ) AS dist_meters
            FROM safe_locations s
            WHERE ST_DWithin(
                s.location::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radiusMeters
            )
            ORDER BY dist_meters ASC
            """, nativeQuery = true)
    List<SafeLocationEntity> findNearestSafeLocations(
            @Param("lat") double lat,
            @Param("lon") double lon,
            @Param("radiusMeters") double radiusMeters);
}
