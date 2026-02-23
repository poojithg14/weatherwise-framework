package com.weatherwise.algorithm;

import com.weatherwise.model.Coordinate;

import java.util.List;

/**
 * Geometric utility methods for geographic coordinate operations used in the
 * WeatherWise real-time hazard assessment system.
 *
 * <p>This class provides fundamental spatial operations adapted for use with
 * geographic (latitude/longitude) coordinates on the WGS-84 ellipsoid,
 * approximated as a sphere. Methods include distance computation via the
 * Haversine formula, position projection along a heading using spherical
 * geometry, point-in-polygon testing via ray casting, and line–polygon
 * intersection detection.</p>
 *
 * <p><b>Reference:</b> Adapted from aviation CWAM (Convective Weather Avoidance
 * Model, MIT Lincoln Laboratory) geometric primitives for ground-vehicle
 * highway applications. See: DeLaura, R., &amp; Allan, S. (2003).
 * "Route Optimization in the Presence of Convective Weather."</p>
 *
 * <p>All methods are static and thread-safe.</p>
 *
 * @author WeatherWise Research Team
 */
public final class GeometricIntersection {

    /** Mean radius of the Earth in miles (WGS-84 mean radius). */
    private static final double EARTH_RADIUS_MILES = 3958.8;

    private GeometricIntersection() {
        // Utility class — prevent instantiation
    }

    /**
     * Computes the great-circle distance between two points on the Earth's
     * surface using the Haversine formula.
     *
     * <p>The Haversine formula is numerically stable for small distances and
     * avoids the floating-point issues that arise with the spherical law of
     * cosines at short ranges.</p>
     *
     * <p><b>Formula:</b></p>
     * <pre>
     *   a = sin²(Δlat/2) + cos(lat1) · cos(lat2) · sin²(Δlon/2)
     *   c = 2 · atan2(√a, √(1−a))
     *   d = R · c
     * </pre>
     *
     * @param lat1 latitude of the first point in decimal degrees
     * @param lon1 longitude of the first point in decimal degrees
     * @param lat2 latitude of the second point in decimal degrees
     * @param lon2 longitude of the second point in decimal degrees
     * @return great-circle distance in miles
     */
    public static double haversineDistance(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double rLat1 = Math.toRadians(lat1);
        double rLat2 = Math.toRadians(lat2);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(rLat1) * Math.cos(rLat2)
                 * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS_MILES * c;
    }

    /**
     * Projects a geographic position forward along a given heading and speed
     * using spherical geometry (the direct geodesic problem).
     *
     * <p>Given a starting point, a compass heading (0° = north, 90° = east),
     * a speed in miles per hour, and a duration in minutes, this method
     * computes the new latitude and longitude after traveling along the
     * specified great-circle path.</p>
     *
     * <p><b>Formulas (spherical Earth):</b></p>
     * <pre>
     *   δ = d / R                           (angular distance)
     *   lat₂ = asin(sin(lat₁)·cos(δ) + cos(lat₁)·sin(δ)·cos(θ))
     *   lon₂ = lon₁ + atan2(sin(θ)·sin(δ)·cos(lat₁),
     *                        cos(δ) − sin(lat₁)·sin(lat₂))
     * </pre>
     *
     * @param lat            starting latitude in decimal degrees
     * @param lon            starting longitude in decimal degrees
     * @param headingDegrees compass heading in degrees (0 = north, 90 = east)
     * @param speedMph       speed in miles per hour
     * @param minutes        duration in minutes
     * @return a {@link Coordinate} representing the projected position
     */
    public static Coordinate projectPosition(double lat, double lon,
                                             double headingDegrees,
                                             double speedMph,
                                             double minutes) {
        double distanceMiles = speedMph * (minutes / 60.0);
        double angularDistance = distanceMiles / EARTH_RADIUS_MILES;

        double rLat = Math.toRadians(lat);
        double rLon = Math.toRadians(lon);
        double rHeading = Math.toRadians(headingDegrees);

        double newLat = Math.asin(
                Math.sin(rLat) * Math.cos(angularDistance)
              + Math.cos(rLat) * Math.sin(angularDistance) * Math.cos(rHeading));

        double newLon = rLon + Math.atan2(
                Math.sin(rHeading) * Math.sin(angularDistance) * Math.cos(rLat),
                Math.cos(angularDistance) - Math.sin(rLat) * Math.sin(newLat));

        return Coordinate.builder()
                .lat(Math.toDegrees(newLat))
                .lon(Math.toDegrees(newLon))
                .build();
    }

    /**
     * Determines whether a geographic point lies inside a polygon defined by
     * a list of vertices, using the ray-casting algorithm adapted for
     * geographic (latitude/longitude) coordinates.
     *
     * <p>The ray-casting algorithm works by casting a horizontal ray from the
     * test point and counting how many polygon edges it crosses. An odd
     * crossing count indicates the point is inside the polygon. This
     * implementation treats latitude as the Y-axis and longitude as the
     * X-axis, which is a valid simplification for the relatively small
     * polygons (storm cells) used in WeatherWise.</p>
     *
     * <p><b>Note:</b> This method does not account for polygons that wrap
     * around the antimeridian (±180° longitude), which is acceptable for
     * the continental United States domain.</p>
     *
     * @param lat     latitude of the test point in decimal degrees
     * @param lon     longitude of the test point in decimal degrees
     * @param polygon list of vertices defining the polygon (implicitly closed)
     * @return {@code true} if the point is inside the polygon
     */
    public static boolean pointInPolygon(double lat, double lon, List<Coordinate> polygon) {
        if (polygon == null || polygon.size() < 3) {
            return false;
        }

        boolean inside = false;
        int n = polygon.size();

        for (int i = 0, j = n - 1; i < n; j = i++) {
            double yi = polygon.get(i).getLat();
            double xi = polygon.get(i).getLon();
            double yj = polygon.get(j).getLat();
            double xj = polygon.get(j).getLon();

            // Check if the ray from (lon, lat) going in +longitude direction
            // crosses this edge
            boolean intersects = ((yi > lat) != (yj > lat))
                    && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);

            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }

    /**
     * Computes the minimum Haversine distance from a point to any edge of a
     * polygon.
     *
     * <p>For each edge segment of the polygon, this method finds the closest
     * point on that segment to the given point and computes the Haversine
     * distance. The minimum across all edges is returned.</p>
     *
     * <p>If the point is inside the polygon, this method returns 0.0.</p>
     *
     * @param lat     latitude of the point in decimal degrees
     * @param lon     longitude of the point in decimal degrees
     * @param polygon list of vertices defining the polygon (implicitly closed)
     * @return minimum distance in miles from the point to the polygon boundary;
     *         0.0 if the point is inside the polygon
     */
    public static double minimumDistanceToPolygon(double lat, double lon,
                                                  List<Coordinate> polygon) {
        if (polygon == null || polygon.size() < 3) {
            return Double.MAX_VALUE;
        }

        if (pointInPolygon(lat, lon, polygon)) {
            return 0.0;
        }

        double minDist = Double.MAX_VALUE;
        int n = polygon.size();

        for (int i = 0; i < n; i++) {
            int j = (i + 1) % n;
            Coordinate a = polygon.get(i);
            Coordinate b = polygon.get(j);
            double dist = distanceToSegment(lat, lon, a.getLat(), a.getLon(),
                                            b.getLat(), b.getLon());
            if (dist < minDist) {
                minDist = dist;
            }
        }
        return minDist;
    }

    /**
     * Checks whether a line segment (defined by two endpoints) intersects
     * any edge of a polygon.
     *
     * <p>This uses the standard line-segment intersection test for each edge
     * of the polygon. Additionally, if either endpoint of the segment lies
     * inside the polygon, intersection is trivially true.</p>
     *
     * @param lat1    latitude of the first endpoint
     * @param lon1    longitude of the first endpoint
     * @param lat2    latitude of the second endpoint
     * @param lon2    longitude of the second endpoint
     * @param polygon list of vertices defining the polygon (implicitly closed)
     * @return {@code true} if the segment intersects or is contained within
     *         the polygon
     */
    public static boolean lineSegmentIntersectsPolygon(double lat1, double lon1,
                                                       double lat2, double lon2,
                                                       List<Coordinate> polygon) {
        if (polygon == null || polygon.size() < 3) {
            return false;
        }

        // If either endpoint is inside the polygon, trivially intersects
        if (pointInPolygon(lat1, lon1, polygon) || pointInPolygon(lat2, lon2, polygon)) {
            return true;
        }

        int n = polygon.size();
        for (int i = 0; i < n; i++) {
            int j = (i + 1) % n;
            Coordinate a = polygon.get(i);
            Coordinate b = polygon.get(j);

            if (segmentsIntersect(lat1, lon1, lat2, lon2,
                                  a.getLat(), a.getLon(), b.getLat(), b.getLon())) {
                return true;
            }
        }
        return false;
    }

    // -----------------------------------------------------------------------
    //  Internal helper methods
    // -----------------------------------------------------------------------

    /**
     * Computes the minimum Haversine distance from a point (px, py) to the
     * line segment from (ax, ay) to (bx, by). The closest point on the
     * segment is found by projecting the point onto the line and clamping
     * the parameter to [0, 1].
     */
    private static double distanceToSegment(double pLat, double pLon,
                                            double aLat, double aLon,
                                            double bLat, double bLon) {
        // Use a planar approximation for the projection parameter t,
        // then compute Haversine distance to the closest point.
        double dx = bLon - aLon;
        double dy = bLat - aLat;
        double lenSq = dx * dx + dy * dy;

        double t;
        if (lenSq < 1e-12) {
            // Segment has zero length — distance is to the single point
            t = 0;
        } else {
            t = ((pLon - aLon) * dx + (pLat - aLat) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
        }

        double closestLat = aLat + t * dy;
        double closestLon = aLon + t * dx;

        return haversineDistance(pLat, pLon, closestLat, closestLon);
    }

    /**
     * Tests whether two line segments intersect using the orientation (cross
     * product) method. Segments are (p1→p2) and (p3→p4).
     */
    private static boolean segmentsIntersect(double p1Lat, double p1Lon,
                                             double p2Lat, double p2Lon,
                                             double p3Lat, double p3Lon,
                                             double p4Lat, double p4Lon) {
        double d1 = cross(p3Lat, p3Lon, p4Lat, p4Lon, p1Lat, p1Lon);
        double d2 = cross(p3Lat, p3Lon, p4Lat, p4Lon, p2Lat, p2Lon);
        double d3 = cross(p1Lat, p1Lon, p2Lat, p2Lon, p3Lat, p3Lon);
        double d4 = cross(p1Lat, p1Lon, p2Lat, p2Lon, p4Lat, p4Lon);

        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
         && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
            return true;
        }

        // Collinear cases
        if (Math.abs(d1) < 1e-10 && onSegment(p3Lat, p3Lon, p4Lat, p4Lon, p1Lat, p1Lon)) return true;
        if (Math.abs(d2) < 1e-10 && onSegment(p3Lat, p3Lon, p4Lat, p4Lon, p2Lat, p2Lon)) return true;
        if (Math.abs(d3) < 1e-10 && onSegment(p1Lat, p1Lon, p2Lat, p2Lon, p3Lat, p3Lon)) return true;
        if (Math.abs(d4) < 1e-10 && onSegment(p1Lat, p1Lon, p2Lat, p2Lon, p4Lat, p4Lon)) return true;

        return false;
    }

    /**
     * Cross product of vectors (aLat,aLon)→(bLat,bLon) and (aLat,aLon)→(cLat,cLon).
     */
    private static double cross(double aLat, double aLon,
                                double bLat, double bLon,
                                double cLat, double cLon) {
        return (bLon - aLon) * (cLat - aLat) - (bLat - aLat) * (cLon - aLon);
    }

    /**
     * Checks if point (pLat, pLon) lies on the segment from (aLat, aLon) to
     * (bLat, bLon), assuming the three points are collinear.
     */
    private static boolean onSegment(double aLat, double aLon,
                                     double bLat, double bLon,
                                     double pLat, double pLon) {
        return Math.min(aLon, bLon) <= pLon + 1e-10
            && pLon <= Math.max(aLon, bLon) + 1e-10
            && Math.min(aLat, bLat) <= pLat + 1e-10
            && pLat <= Math.max(aLat, bLat) + 1e-10;
    }
}
