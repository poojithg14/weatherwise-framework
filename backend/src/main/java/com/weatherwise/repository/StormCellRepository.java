package com.weatherwise.repository;

import com.weatherwise.entity.StormCellEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StormCellRepository extends JpaRepository<StormCellEntity, UUID> {

    @Query(value = """
            SELECT * FROM storm_cells s
            WHERE s.active = true
            AND ST_DWithin(
                s.location::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radiusMeters
            )
            """, nativeQuery = true)
    List<StormCellEntity> findActiveStormsWithinRadius(
            @Param("lat") double lat,
            @Param("lon") double lon,
            @Param("radiusMeters") double radiusMeters);

    List<StormCellEntity> findByActiveTrue();

    Optional<StormCellEntity> findByStormId(String stormId);
}
