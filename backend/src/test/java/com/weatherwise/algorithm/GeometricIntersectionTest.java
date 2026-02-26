package com.weatherwise.algorithm;

import com.weatherwise.model.Coordinate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link GeometricIntersection} verifying Haversine distance,
 * position projection, point-in-polygon, minimum distance to polygon,
 * and line-segment-polygon intersection.
 */
class GeometricIntersectionTest {

    private Coordinate coord(double lat, double lon) {
        return Coordinate.builder().lat(lat).lon(lon).build();
    }

    // -----------------------------------------------------------------------
    //  Haversine distance
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("haversineDistance: same point returns 0")
    void haversineDistanceSamePoint() {
        double dist = GeometricIntersection.haversineDistance(38.25, -85.76, 38.25, -85.76);
        assertEquals(0.0, dist, 1e-10);
    }

    @Test
    @DisplayName("haversineDistance: Louisville to Lexington ~75 miles")
    void haversineDistanceLouisvilleToLexington() {
        // Louisville (38.2527, -85.7585) to Lexington (38.0406, -84.5037)
        double dist = GeometricIntersection.haversineDistance(
                38.2527, -85.7585, 38.0406, -84.5037);
        assertTrue(dist > 65 && dist < 75,
                "Louisville-Lexington distance should be ~70 miles, was: " + dist);
    }

    @Test
    @DisplayName("haversineDistance: 1 degree latitude ~69 miles")
    void haversineDistanceOneDegreeLatitude() {
        double dist = GeometricIntersection.haversineDistance(38.0, -85.0, 39.0, -85.0);
        assertTrue(dist > 68 && dist < 70,
                "1 degree lat should be ~69 miles, was: " + dist);
    }

    // -----------------------------------------------------------------------
    //  Position projection
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("projectPosition: zero speed stays in place")
    void projectPositionZeroSpeed() {
        Coordinate result = GeometricIntersection.projectPosition(
                38.25, -85.76, 270, 0, 30);
        assertEquals(38.25, result.getLat(), 1e-6);
        assertEquals(-85.76, result.getLon(), 1e-6);
    }

    @Test
    @DisplayName("projectPosition: heading north increases latitude")
    void projectPositionNorth() {
        Coordinate result = GeometricIntersection.projectPosition(
                38.0, -85.0, 0, 69, 60);  // ~69 mi/hr for 1 hour = ~1 degree north
        assertTrue(result.getLat() > 38.9,
                "Heading north should increase lat, was: " + result.getLat());
        assertEquals(-85.0, result.getLon(), 0.05);
    }

    @Test
    @DisplayName("projectPosition: heading east decreases longitude magnitude (less negative)")
    void projectPositionEast() {
        Coordinate result = GeometricIntersection.projectPosition(
                38.0, -85.0, 90, 60, 60);  // ~60 mi east in 1 hour
        assertTrue(result.getLon() > -85.0,
                "Heading east should move longitude toward 0, was: " + result.getLon());
    }

    @Test
    @DisplayName("projectPosition: zero minutes stays in place")
    void projectPositionZeroMinutes() {
        Coordinate result = GeometricIntersection.projectPosition(
                38.25, -85.76, 180, 70, 0);
        assertEquals(38.25, result.getLat(), 1e-6);
        assertEquals(-85.76, result.getLon(), 1e-6);
    }

    // -----------------------------------------------------------------------
    //  Point-in-polygon
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("pointInPolygon: point inside square returns true")
    void pointInPolygonInside() {
        List<Coordinate> square = List.of(
                coord(38.0, -86.0),
                coord(38.0, -85.0),
                coord(39.0, -85.0),
                coord(39.0, -86.0));

        assertTrue(GeometricIntersection.pointInPolygon(38.5, -85.5, square));
    }

    @Test
    @DisplayName("pointInPolygon: point outside square returns false")
    void pointInPolygonOutside() {
        List<Coordinate> square = List.of(
                coord(38.0, -86.0),
                coord(38.0, -85.0),
                coord(39.0, -85.0),
                coord(39.0, -86.0));

        assertFalse(GeometricIntersection.pointInPolygon(40.0, -85.5, square));
    }

    @Test
    @DisplayName("pointInPolygon: null polygon returns false")
    void pointInPolygonNull() {
        assertFalse(GeometricIntersection.pointInPolygon(38.0, -85.0, null));
    }

    @Test
    @DisplayName("pointInPolygon: degenerate polygon (2 points) returns false")
    void pointInPolygonDegenerate() {
        List<Coordinate> line = List.of(coord(38.0, -86.0), coord(39.0, -85.0));
        assertFalse(GeometricIntersection.pointInPolygon(38.5, -85.5, line));
    }

    @Test
    @DisplayName("pointInPolygon: triangle containment")
    void pointInPolygonTriangle() {
        List<Coordinate> triangle = List.of(
                coord(37.0, -85.0),
                coord(38.0, -84.0),
                coord(38.0, -86.0));

        assertTrue(GeometricIntersection.pointInPolygon(37.5, -85.0, triangle));
        assertFalse(GeometricIntersection.pointInPolygon(36.0, -85.0, triangle));
    }

    // -----------------------------------------------------------------------
    //  Minimum distance to polygon
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("minimumDistanceToPolygon: point inside polygon returns 0")
    void minDistInsidePolygon() {
        List<Coordinate> square = List.of(
                coord(38.0, -86.0),
                coord(38.0, -85.0),
                coord(39.0, -85.0),
                coord(39.0, -86.0));

        assertEquals(0.0, GeometricIntersection.minimumDistanceToPolygon(
                38.5, -85.5, square));
    }

    @Test
    @DisplayName("minimumDistanceToPolygon: point outside returns positive distance")
    void minDistOutsidePolygon() {
        List<Coordinate> square = List.of(
                coord(38.0, -86.0),
                coord(38.0, -85.0),
                coord(39.0, -85.0),
                coord(39.0, -86.0));

        double dist = GeometricIntersection.minimumDistanceToPolygon(
                40.0, -85.5, square);  // ~69 miles north of polygon
        assertTrue(dist > 60 && dist < 80,
                "Distance should be ~69 miles, was: " + dist);
    }

    @Test
    @DisplayName("minimumDistanceToPolygon: null polygon returns MAX_VALUE")
    void minDistNullPolygon() {
        assertEquals(Double.MAX_VALUE,
                GeometricIntersection.minimumDistanceToPolygon(38.0, -85.0, null));
    }

    // -----------------------------------------------------------------------
    //  Line segment intersects polygon
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("lineSegmentIntersectsPolygon: segment crossing polygon returns true")
    void lineSegmentCrossesPolygon() {
        List<Coordinate> square = List.of(
                coord(38.0, -86.0),
                coord(38.0, -85.0),
                coord(39.0, -85.0),
                coord(39.0, -86.0));

        // Segment from south to north crossing the polygon
        assertTrue(GeometricIntersection.lineSegmentIntersectsPolygon(
                37.5, -85.5, 39.5, -85.5, square));
    }

    @Test
    @DisplayName("lineSegmentIntersectsPolygon: segment inside polygon returns true")
    void lineSegmentInsidePolygon() {
        List<Coordinate> square = List.of(
                coord(38.0, -86.0),
                coord(38.0, -85.0),
                coord(39.0, -85.0),
                coord(39.0, -86.0));

        // Both endpoints inside
        assertTrue(GeometricIntersection.lineSegmentIntersectsPolygon(
                38.3, -85.5, 38.7, -85.5, square));
    }

    @Test
    @DisplayName("lineSegmentIntersectsPolygon: segment outside polygon returns false")
    void lineSegmentOutsidePolygon() {
        List<Coordinate> square = List.of(
                coord(38.0, -86.0),
                coord(38.0, -85.0),
                coord(39.0, -85.0),
                coord(39.0, -86.0));

        // Segment entirely above the polygon
        assertFalse(GeometricIntersection.lineSegmentIntersectsPolygon(
                40.0, -86.0, 40.0, -85.0, square));
    }

    @Test
    @DisplayName("lineSegmentIntersectsPolygon: null polygon returns false")
    void lineSegmentNullPolygon() {
        assertFalse(GeometricIntersection.lineSegmentIntersectsPolygon(
                38.0, -85.0, 39.0, -85.0, null));
    }
}
