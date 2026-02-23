package com.weatherwise.resolver;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.weatherwise.algorithm.SafeRouteOptimizer;
import com.weatherwise.entity.RoadSegmentEntity;
import com.weatherwise.entity.StormCellEntity;
import com.weatherwise.model.*;
import com.weatherwise.repository.RoadSegmentRepository;
import com.weatherwise.repository.StormCellRepository;

import java.time.Instant;
import java.util.List;

@DgsComponent
public class AlternateRouteResolver {

    private final SafeRouteOptimizer routeOptimizer;
    private final StormCellRepository stormCellRepository;
    private final RoadSegmentRepository roadSegmentRepository;
    private final StormCellResolver stormCellResolver;

    public AlternateRouteResolver(SafeRouteOptimizer routeOptimizer,
                                  StormCellRepository stormCellRepository,
                                  RoadSegmentRepository roadSegmentRepository,
                                  StormCellResolver stormCellResolver) {
        this.routeOptimizer = routeOptimizer;
        this.stormCellRepository = stormCellRepository;
        this.roadSegmentRepository = roadSegmentRepository;
        this.stormCellResolver = stormCellResolver;
    }

    @DgsQuery
    public List<AlternateRoute> alternateRoutes(
            @InputArgument Double fromLat,
            @InputArgument Double fromLon,
            @InputArgument Double toLat,
            @InputArgument Double toLon,
            @InputArgument Boolean avoidHazards) {

        List<StormCellEntity> stormEntities = stormCellRepository.findByActiveTrue();
        List<StormCell> storms = stormEntities.stream()
                .map(stormCellResolver::toModel).toList();

        if (!Boolean.TRUE.equals(avoidHazards)) {
            return buildDefaultRoutes(fromLat, fromLon, toLat, toLon);
        }

        TravelerPosition start = TravelerPosition.builder()
                .lat(fromLat).lon(fromLon)
                .heading(270.0).speedMph(70.0)
                .timestamp(Instant.now().toString())
                .build();

        Coordinate destination = Coordinate.builder()
                .lat(toLat).lon(toLon).build();

        // Build road network from DB segments
        SafeRouteOptimizer.RoadNetwork network = buildNetworkFromDb(fromLat, fromLon, toLat, toLon);

        AlternateRoute safest = routeOptimizer.findSafestRoute(
                start, destination, storms, network);

        if (safest != null) {
            return List.of(safest);
        }

        // Fall back to default routes
        return buildDefaultRoutes(fromLat, fromLon, toLat, toLon);
    }

    private SafeRouteOptimizer.RoadNetwork buildNetworkFromDb(
            double fromLat, double fromLon, double toLat, double toLon) {

        // Expand bounding box by 0.5 degrees to include alternate routes
        double minLat = Math.min(fromLat, toLat) - 0.5;
        double maxLat = Math.max(fromLat, toLat) + 0.5;
        double minLon = Math.min(fromLon, toLon) - 0.5;
        double maxLon = Math.max(fromLon, toLon) + 0.5;

        List<RoadSegmentEntity> segments = roadSegmentRepository.findSegmentsWithinBounds(
                minLon, minLat, maxLon, maxLat);

        SafeRouteOptimizer.RoadNetwork network = new SafeRouteOptimizer.RoadNetwork();

        for (RoadSegmentEntity seg : segments) {
            org.locationtech.jts.geom.Coordinate[] coords = seg.getGeometry().getCoordinates();
            if (coords.length < 2) continue;

            // Create nodes at start and end of segment
            org.locationtech.jts.geom.Coordinate startCoord = coords[0];
            org.locationtech.jts.geom.Coordinate endCoord = coords[coords.length - 1];

            String startId = seg.getSegmentId() + "-start";
            String endId = seg.getSegmentId() + "-end";

            network.addNode(SafeRouteOptimizer.Node.builder()
                    .id(startId)
                    .lat(startCoord.getY())
                    .lon(startCoord.getX())
                    .name(seg.getFromName())
                    .isExit(true)
                    .hasShelter(false)
                    .build());

            network.addNode(SafeRouteOptimizer.Node.builder()
                    .id(endId)
                    .lat(endCoord.getY())
                    .lon(endCoord.getX())
                    .name(seg.getToName())
                    .isExit(true)
                    .hasShelter(false)
                    .build());

            // Bidirectional edges
            network.addEdge(SafeRouteOptimizer.Edge.builder()
                    .fromNode(startId).toNode(endId)
                    .distanceMiles(seg.getDistanceMiles())
                    .speedLimitMph(seg.getSpeedLimitMph())
                    .weatherDangerScore(0.0)
                    .build());
            network.addEdge(SafeRouteOptimizer.Edge.builder()
                    .fromNode(endId).toNode(startId)
                    .distanceMiles(seg.getDistanceMiles())
                    .speedLimitMph(seg.getSpeedLimitMph())
                    .weatherDangerScore(0.0)
                    .build());
        }

        // If no segments found in DB, fall back to static I-64 network
        if (network.getNodes().isEmpty()) {
            return SafeRouteOptimizer.buildI64Network();
        }

        return network;
    }

    private List<AlternateRoute> buildDefaultRoutes(double fromLat, double fromLon,
                                                     double toLat, double toLon) {
        // Simple direct route as fallback
        return List.of(AlternateRoute.builder()
                .waypoints(List.of(
                        Coordinate.builder().lat(fromLat).lon(fromLon).build(),
                        Coordinate.builder().lat(toLat).lon(toLon).build()))
                .distanceMiles(50.0)
                .estimatedMinutes(50.0)
                .safetyScore(50.0)
                .build());
    }
}
