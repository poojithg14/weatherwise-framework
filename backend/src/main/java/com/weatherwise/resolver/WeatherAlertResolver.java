package com.weatherwise.resolver;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.weatherwise.entity.WeatherAlertEntity;
import com.weatherwise.model.Coordinate;
import com.weatherwise.model.WeatherAlert;
import com.weatherwise.repository.WeatherAlertRepository;

import java.util.ArrayList;
import java.util.List;

@DgsComponent
public class WeatherAlertResolver {

    private static final double MILES_TO_METERS = 1609.344;

    private final WeatherAlertRepository weatherAlertRepository;

    public WeatherAlertResolver(WeatherAlertRepository weatherAlertRepository) {
        this.weatherAlertRepository = weatherAlertRepository;
    }

    @DgsQuery
    public List<WeatherAlert> activeAlerts(
            @InputArgument Double lat,
            @InputArgument Double lon,
            @InputArgument Double radiusMiles) {

        double radiusMeters = radiusMiles * MILES_TO_METERS;
        List<WeatherAlertEntity> entities = weatherAlertRepository.findActiveAlertsWithinRadius(
                lat, lon, radiusMeters);

        return entities.stream().map(this::toModel).toList();
    }

    private WeatherAlert toModel(WeatherAlertEntity entity) {
        org.locationtech.jts.geom.Coordinate[] jtsCoords = entity.getPolygon().getCoordinates();
        List<Coordinate> polygonCoords = new ArrayList<>();
        // Skip the last coordinate (closing point of the ring)
        for (int i = 0; i < jtsCoords.length - 1; i++) {
            polygonCoords.add(Coordinate.builder()
                    .lat(jtsCoords[i].getY())
                    .lon(jtsCoords[i].getX())
                    .build());
        }

        return WeatherAlert.builder()
                .id(entity.getAlertId())
                .type(entity.getHazardType())
                .severity(entity.getSeverity())
                .polygon(polygonCoords)
                .effectiveTime(entity.getEffectiveTime().toString())
                .expirationTime(entity.getExpirationTime().toString())
                .build();
    }
}
