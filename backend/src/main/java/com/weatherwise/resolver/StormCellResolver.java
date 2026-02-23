package com.weatherwise.resolver;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.weatherwise.entity.StormCellEntity;
import com.weatherwise.model.Coordinate;
import com.weatherwise.model.StormCell;
import com.weatherwise.model.TimedPolygon;
import com.weatherwise.repository.StormCellRepository;

import java.util.Collections;
import java.util.List;

@DgsComponent
public class StormCellResolver {

    private static final double MILES_TO_METERS = 1609.344;

    private final StormCellRepository stormCellRepository;
    private final ObjectMapper objectMapper;

    public StormCellResolver(StormCellRepository stormCellRepository, ObjectMapper objectMapper) {
        this.stormCellRepository = stormCellRepository;
        this.objectMapper = objectMapper;
    }

    @DgsQuery
    public List<StormCell> stormCells(
            @InputArgument Double lat,
            @InputArgument Double lon,
            @InputArgument Double radiusMiles) {

        double radiusMeters = radiusMiles * MILES_TO_METERS;
        List<StormCellEntity> entities = stormCellRepository.findActiveStormsWithinRadius(
                lat, lon, radiusMeters);

        return entities.stream().map(this::toModel).toList();
    }

    StormCell toModel(StormCellEntity entity) {
        return StormCell.builder()
                .id(entity.getStormId())
                .lat(entity.getLocation().getY())
                .lon(entity.getLocation().getX())
                .velocityX(entity.getVelocityX())
                .velocityY(entity.getVelocityY())
                .vil(entity.getVil())
                .rotation(entity.getRotation())
                .hazardType(entity.getHazardType())
                .predictedPath(parsePredictedPath(entity.getPredictedPathJson()))
                .build();
    }

    private List<TimedPolygon> parsePredictedPath(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            List<PredictedPathEntry> entries = objectMapper.readValue(json,
                    new TypeReference<List<PredictedPathEntry>>() {});
            return entries.stream().map(e -> TimedPolygon.builder()
                    .time(e.time)
                    .vertices(e.vertices.stream()
                            .map(v -> Coordinate.builder().lat(v.lat).lon(v.lon).build())
                            .toList())
                    .build()
            ).toList();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private static class PredictedPathEntry {
        public String time;
        public List<CoordEntry> vertices;
    }

    private static class CoordEntry {
        public double lat;
        public double lon;
    }
}
