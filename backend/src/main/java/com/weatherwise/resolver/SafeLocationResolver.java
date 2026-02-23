package com.weatherwise.resolver;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.weatherwise.algorithm.GeometricIntersection;
import com.weatherwise.algorithm.SafeRouteOptimizer;
import com.weatherwise.entity.SafeLocationEntity;
import com.weatherwise.entity.StormCellEntity;
import com.weatherwise.model.SafeLocation;
import com.weatherwise.model.StormCell;
import com.weatherwise.model.TravelerPosition;
import com.weatherwise.repository.SafeLocationRepository;
import com.weatherwise.repository.StormCellRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@DgsComponent
public class SafeLocationResolver {

    private static final double MILES_TO_METERS = 1609.344;

    private final SafeRouteOptimizer routeOptimizer;
    private final SafeLocationRepository safeLocationRepository;
    private final StormCellRepository stormCellRepository;
    private final StormCellResolver stormCellResolver;

    public SafeLocationResolver(SafeRouteOptimizer routeOptimizer,
                                SafeLocationRepository safeLocationRepository,
                                StormCellRepository stormCellRepository,
                                StormCellResolver stormCellResolver) {
        this.routeOptimizer = routeOptimizer;
        this.safeLocationRepository = safeLocationRepository;
        this.stormCellRepository = stormCellRepository;
        this.stormCellResolver = stormCellResolver;
    }

    @DgsQuery
    public List<SafeLocation> safeLocations(
            @InputArgument Double lat,
            @InputArgument Double lon,
            @InputArgument Double radiusMiles) {

        double radiusMeters = radiusMiles * MILES_TO_METERS;
        List<SafeLocationEntity> entities = safeLocationRepository.findNearestSafeLocations(
                lat, lon, radiusMeters);

        List<StormCellEntity> stormEntities = stormCellRepository.findByActiveTrue();
        List<StormCell> storms = stormEntities.stream()
                .map(stormCellResolver::toModel).toList();

        TravelerPosition position = TravelerPosition.builder()
                .lat(lat).lon(lon)
                .heading(270.0).speedMph(0.0)
                .timestamp(Instant.now().toString())
                .build();

        // Convert entities to model and compute distance
        List<SafeLocation> filtered = new ArrayList<>();
        for (SafeLocationEntity entity : entities) {
            double dist = GeometricIntersection.haversineDistance(
                    lat, lon, entity.getLocation().getY(), entity.getLocation().getX());
            filtered.add(SafeLocation.builder()
                    .name(entity.getName())
                    .locationType(entity.getLocationType())
                    .lat(entity.getLocation().getY())
                    .lon(entity.getLocation().getX())
                    .distanceMiles(Math.round(dist * 10.0) / 10.0)
                    .hasIndoorShelter(entity.getHasIndoorShelter())
                    .exitNumber(entity.getExitNumber())
                    .build());
        }

        filtered.sort(Comparator.comparingDouble(SafeLocation::getDistanceMiles));

        // Put the safest reachable shelter first
        SafeLocation safest = routeOptimizer.findNearestSafeShelter(
                position, filtered, storms);
        if (safest != null && !filtered.isEmpty() && !filtered.get(0).equals(safest)) {
            filtered.remove(safest);
            filtered.add(0, safest);
        }

        return filtered;
    }
}
