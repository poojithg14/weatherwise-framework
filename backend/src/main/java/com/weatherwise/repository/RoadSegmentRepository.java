package com.weatherwise.repository;

import com.weatherwise.entity.RoadSegmentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RoadSegmentRepository extends JpaRepository<RoadSegmentEntity, UUID> {

    @Query(value = """
            SELECT * FROM road_segments r
            WHERE ST_Intersects(
                r.geometry,
                ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326)
            )
            """, nativeQuery = true)
    List<RoadSegmentEntity> findSegmentsWithinBounds(
            @Param("minLon") double minLon,
            @Param("minLat") double minLat,
            @Param("maxLon") double maxLon,
            @Param("maxLat") double maxLat);

    List<RoadSegmentEntity> findByHighway(String highway);
}
