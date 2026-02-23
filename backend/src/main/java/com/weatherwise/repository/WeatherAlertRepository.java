package com.weatherwise.repository;

import com.weatherwise.entity.WeatherAlertEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface WeatherAlertRepository extends JpaRepository<WeatherAlertEntity, UUID> {

    @Query(value = """
            SELECT * FROM weather_alerts a
            WHERE a.active = true
            AND ST_Contains(
                a.polygon,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
            )
            """, nativeQuery = true)
    List<WeatherAlertEntity> findActiveAlertsContainingPoint(
            @Param("lat") double lat,
            @Param("lon") double lon);

    @Query(value = """
            SELECT * FROM weather_alerts a
            WHERE a.active = true
            AND ST_DWithin(
                a.polygon::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radiusMeters
            )
            """, nativeQuery = true)
    List<WeatherAlertEntity> findActiveAlertsWithinRadius(
            @Param("lat") double lat,
            @Param("lon") double lon,
            @Param("radiusMeters") double radiusMeters);

    List<WeatherAlertEntity> findByActiveTrue();
}
