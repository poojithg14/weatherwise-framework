package com.weatherwise.resolver;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.weatherwise.algorithm.GeometricIntersection;
import com.weatherwise.algorithm.TravelerRiskScorer;
import com.weatherwise.entity.SafeLocationEntity;
import com.weatherwise.entity.StormCellEntity;
import com.weatherwise.model.RiskAssessment;
import com.weatherwise.model.SafeLocation;
import com.weatherwise.model.StormCell;
import com.weatherwise.model.TravelerPosition;
import com.weatherwise.repository.SafeLocationRepository;
import com.weatherwise.repository.StormCellRepository;
import org.springframework.beans.factory.annotation.Value;

import java.time.Instant;
import java.util.List;

@DgsComponent
public class TravelerSafetyResolver {

    private static final double MILES_TO_METERS = 1609.344;

    @Value("${weatherwise.risk.storm-radius-miles:50.0}")
    private double stormRadiusMiles;

    private final TravelerRiskScorer riskScorer;
    private final StormCellRepository stormCellRepository;
    private final SafeLocationRepository safeLocationRepository;
    private final StormCellResolver stormCellResolver;

    public TravelerSafetyResolver(TravelerRiskScorer riskScorer,
                                  StormCellRepository stormCellRepository,
                                  SafeLocationRepository safeLocationRepository,
                                  StormCellResolver stormCellResolver) {
        this.riskScorer = riskScorer;
        this.stormCellRepository = stormCellRepository;
        this.safeLocationRepository = safeLocationRepository;
        this.stormCellResolver = stormCellResolver;
    }

    @DgsQuery
    public RiskAssessment travelerSafety(
            @InputArgument Double lat,
            @InputArgument Double lon,
            @InputArgument Double heading,
            @InputArgument Double speedMph) {

        TravelerPosition position = TravelerPosition.builder()
                .lat(lat).lon(lon)
                .heading(heading).speedMph(speedMph)
                .timestamp(Instant.now().toString())
                .build();

        double radiusMeters = stormRadiusMiles * MILES_TO_METERS;

        List<StormCellEntity> stormEntities = stormCellRepository.findActiveStormsWithinRadius(
                lat, lon, radiusMeters);
        List<StormCell> storms = stormEntities.stream()
                .map(stormCellResolver::toModel).toList();

        List<SafeLocationEntity> safeEntities = safeLocationRepository.findNearestSafeLocations(
                lat, lon, radiusMeters);
        List<SafeLocation> safeLocations = safeEntities.stream()
                .map(e -> toSafeLocationModel(e, lat, lon)).toList();

        // Determine nighttime: approximate check (UTC 00:00-11:00 ≈ US evening/night)
        int hour = Instant.now().atZone(java.time.ZoneId.of("America/New_York")).getHour();
        boolean isNighttime = hour >= 20 || hour < 6;

        return riskScorer.computeRisk(position, storms, safeLocations, isNighttime);
    }

    private SafeLocation toSafeLocationModel(SafeLocationEntity entity, double fromLat, double fromLon) {
        double dist = GeometricIntersection.haversineDistance(
                fromLat, fromLon, entity.getLocation().getY(), entity.getLocation().getX());
        return SafeLocation.builder()
                .name(entity.getName())
                .locationType(entity.getLocationType())
                .lat(entity.getLocation().getY())
                .lon(entity.getLocation().getX())
                .distanceMiles(Math.round(dist * 10.0) / 10.0)
                .hasIndoorShelter(entity.getHasIndoorShelter())
                .exitNumber(entity.getExitNumber())
                .build();
    }
}
