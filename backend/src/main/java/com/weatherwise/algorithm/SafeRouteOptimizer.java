package com.weatherwise.algorithm;

import com.weatherwise.model.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * A* pathfinding-based route optimizer that finds the safest highway route
 * avoiding predicted severe weather corridors.
 *
 * <p><b>Algorithm:</b> Modified A* search where the cost function incorporates
 * both travel time and weather danger. The weather-danger penalty is set
 * extremely high ({@value #DANGER_PENALTY}) to ensure the algorithm strongly
 * avoids hazard corridors, effectively treating them as impassable unless no
 * alternative exists.</p>
 *
 * <p><b>Cost Function:</b></p>
 * <pre>
 *   g(n) = Σ (edge.distanceMiles / edge.speedLimitMph × 60 + DANGER_PENALTY × edge.weatherDangerScore)
 *   h(n) = haversineDistance(current, destination) / 70.0 × 60.0
 * </pre>
 *
 * <p><b>Weather Danger Score per Edge:</b></p>
 * <ul>
 *   <li>1.0 if edge intersects a predicted hazard corridor polygon at estimated traversal time</li>
 *   <li>0.3 if edge is within 5 miles of a hazard corridor but does not intersect</li>
 *   <li>0.0 if edge is clear of all hazards</li>
 * </ul>
 *
 * @author WeatherWise Research Team
 */
@Component
public class SafeRouteOptimizer {

    /** Penalty multiplier for edges with weather danger. */
    private static final double DANGER_PENALTY = 10000.0;

    /** Maximum edge danger score above which a route is considered blocked. */
    private static final double MAX_SAFE_DANGER = 0.8;

    /** Assumed average highway speed for heuristic (mph). */
    private static final double HEURISTIC_SPEED_MPH = 70.0;

    // -----------------------------------------------------------------------
    //  Inner classes: Road Network
    // -----------------------------------------------------------------------

    /**
     * Represents a node (exit, interchange, or waypoint) in the road network.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Node {
        private String id;
        private double lat;
        private double lon;
        private String name;
        private boolean isExit;
        private boolean hasShelter;
    }

    /**
     * Represents a directed edge (road segment) in the road network.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Edge {
        private String fromNode;
        private String toNode;
        private double distanceMiles;
        private double speedLimitMph;
        private double weatherDangerScore;
    }

    /**
     * Weighted graph representing the highway network.
     */
    @Data
    public static class RoadNetwork {
        private final Map<String, Node> nodes = new LinkedHashMap<>();
        private final List<Edge> edges = new ArrayList<>();
        private final Map<String, List<Edge>> adjacency = new HashMap<>();

        public void addNode(Node node) {
            nodes.put(node.getId(), node);
        }

        public void addEdge(Edge edge) {
            edges.add(edge);
            adjacency.computeIfAbsent(edge.getFromNode(), k -> new ArrayList<>()).add(edge);
        }

        public List<Edge> getNeighborEdges(String nodeId) {
            return adjacency.getOrDefault(nodeId, Collections.emptyList());
        }

        public Node getNode(String id) {
            return nodes.get(id);
        }
    }

    // -----------------------------------------------------------------------
    //  A* search state
    // -----------------------------------------------------------------------

    private record AStarState(String nodeId, double gCost, double fCost,
                              String parentNodeId) implements Comparable<AStarState> {
        @Override
        public int compareTo(AStarState o) {
            return Double.compare(this.fCost, o.fCost);
        }
    }

    // -----------------------------------------------------------------------
    //  Public methods
    // -----------------------------------------------------------------------

    /**
     * Finds the safest route from the traveler's current position to a
     * destination, avoiding predicted storm corridors.
     *
     * @param start       current traveler position
     * @param destination target coordinate
     * @param storms      active storm cells with predicted paths
     * @param network     road network graph
     * @return an {@link AlternateRoute} representing the safest path, or
     *         {@code null} if all routes have maximum edge danger &gt; 0.8
     */
    public AlternateRoute findSafestRoute(TravelerPosition start,
                                          Coordinate destination,
                                          List<StormCell> storms,
                                          RoadNetwork network) {
        // Find the nearest node to start and destination
        String startNodeId = findNearestNode(start.getLat(), start.getLon(), network);
        String destNodeId = findNearestNode(destination.getLat(), destination.getLon(), network);

        if (startNodeId == null || destNodeId == null) return null;

        // Update weather danger scores on all edges
        updateDangerScores(network, storms);

        // Run A*
        List<String> path = aStarSearch(startNodeId, destNodeId, network);
        if (path == null) return null;

        // Check if the route is actually safe (max edge danger < threshold)
        double maxDanger = 0;
        for (int i = 0; i < path.size() - 1; i++) {
            for (Edge e : network.getNeighborEdges(path.get(i))) {
                if (e.getToNode().equals(path.get(i + 1))) {
                    maxDanger = Math.max(maxDanger, e.getWeatherDangerScore());
                }
            }
        }
        if (maxDanger > MAX_SAFE_DANGER) return null;

        return buildRoute(path, network);
    }

    /**
     * Finds the nearest safe shelter reachable WITHOUT crossing any hazard
     * corridor.
     *
     * @param position current traveler position
     * @param shelters available safe locations
     * @param storms   active storm cells
     * @return the nearest safely reachable {@link SafeLocation}, or the one
     *         with minimum hazard exposure if none are fully safe
     */
    public SafeLocation findNearestSafeShelter(TravelerPosition position,
                                               List<SafeLocation> shelters,
                                               List<StormCell> storms) {
        if (shelters == null || shelters.isEmpty()) return null;

        // Sort shelters by distance
        List<SafeLocation> sorted = new ArrayList<>(shelters);
        sorted.sort(Comparator.comparingDouble(s ->
                GeometricIntersection.haversineDistance(
                        position.getLat(), position.getLon(),
                        s.getLat(), s.getLon())));

        // Check each shelter — return first one reachable without crossing storm
        for (SafeLocation shelter : sorted) {
            boolean pathClear = true;
            for (StormCell storm : storms) {
                for (TimedPolygon tp : storm.getPredictedPath()) {
                    if (GeometricIntersection.lineSegmentIntersectsPolygon(
                            position.getLat(), position.getLon(),
                            shelter.getLat(), shelter.getLon(),
                            tp.getVertices())) {
                        pathClear = false;
                        break;
                    }
                }
                if (!pathClear) break;
            }
            if (pathClear) return shelter;
        }

        // No shelter fully safe — return the one with minimum hazard exposure
        // (fewest storm polygon crossings)
        SafeLocation bestFallback = null;
        int minCrossings = Integer.MAX_VALUE;

        for (SafeLocation shelter : sorted) {
            int crossings = 0;
            for (StormCell storm : storms) {
                for (TimedPolygon tp : storm.getPredictedPath()) {
                    if (GeometricIntersection.lineSegmentIntersectsPolygon(
                            position.getLat(), position.getLon(),
                            shelter.getLat(), shelter.getLon(),
                            tp.getVertices())) {
                        crossings++;
                    }
                }
            }
            if (crossings < minCrossings) {
                minCrossings = crossings;
                bestFallback = shelter;
            }
        }
        return bestFallback;
    }

    /**
     * For a traveler ALREADY inside a hazard zone, finds the shortest path
     * OUT of all hazard polygons.
     *
     * @param position current traveler position (inside hazard zone)
     * @param storms   active storm cells
     * @param network  road network
     * @return an {@link AlternateRoute} leading out of the hazard, or null
     */
    public AlternateRoute findEscapeRoute(TravelerPosition position,
                                          List<StormCell> storms,
                                          RoadNetwork network) {
        String startId = findNearestNode(position.getLat(), position.getLon(), network);
        if (startId == null) return null;

        updateDangerScores(network, storms);

        // Find nearest node that is OUTSIDE all hazard polygons
        String escapeNodeId = null;
        double minDist = Double.MAX_VALUE;

        for (Node node : network.getNodes().values()) {
            boolean insideHazard = false;
            for (StormCell storm : storms) {
                for (TimedPolygon tp : storm.getPredictedPath()) {
                    if (GeometricIntersection.pointInPolygon(
                            node.getLat(), node.getLon(), tp.getVertices())) {
                        insideHazard = true;
                        break;
                    }
                }
                if (insideHazard) break;
            }
            if (!insideHazard) {
                double dist = GeometricIntersection.haversineDistance(
                        position.getLat(), position.getLon(),
                        node.getLat(), node.getLon());
                if (dist < minDist) {
                    minDist = dist;
                    escapeNodeId = node.getId();
                }
            }
        }

        if (escapeNodeId == null) return null;

        // Use Dijkstra (A* with h=0 effectively, but we use distance-based h)
        List<String> path = aStarSearch(startId, escapeNodeId, network);
        if (path == null) return null;

        return buildRoute(path, network);
    }

    // -----------------------------------------------------------------------
    //  A* implementation
    // -----------------------------------------------------------------------

    private List<String> aStarSearch(String startId, String goalId,
                                     RoadNetwork network) {
        PriorityQueue<AStarState> openSet = new PriorityQueue<>();
        Map<String, Double> gScores = new HashMap<>();
        Map<String, String> cameFrom = new HashMap<>();
        Set<String> closedSet = new HashSet<>();

        Node goalNode = network.getNode(goalId);
        if (goalNode == null) return null;

        gScores.put(startId, 0.0);
        double h = heuristic(network.getNode(startId), goalNode);
        openSet.add(new AStarState(startId, 0.0, h, null));

        while (!openSet.isEmpty()) {
            AStarState current = openSet.poll();
            String currentId = current.nodeId();

            if (currentId.equals(goalId)) {
                return reconstructPath(cameFrom, goalId);
            }

            if (closedSet.contains(currentId)) continue;
            closedSet.add(currentId);

            for (Edge edge : network.getNeighborEdges(currentId)) {
                String neighborId = edge.getToNode();
                if (closedSet.contains(neighborId)) continue;

                double edgeCost = (edge.getDistanceMiles() / edge.getSpeedLimitMph()) * 60.0
                                + DANGER_PENALTY * edge.getWeatherDangerScore();
                double tentativeG = gScores.getOrDefault(currentId, Double.MAX_VALUE) + edgeCost;

                if (tentativeG < gScores.getOrDefault(neighborId, Double.MAX_VALUE)) {
                    gScores.put(neighborId, tentativeG);
                    cameFrom.put(neighborId, currentId);
                    Node neighborNode = network.getNode(neighborId);
                    double fCost = tentativeG + heuristic(neighborNode, goalNode);
                    openSet.add(new AStarState(neighborId, tentativeG, fCost, currentId));
                }
            }
        }

        return null; // No path found
    }

    private double heuristic(Node current, Node goal) {
        if (current == null || goal == null) return 0;
        double dist = GeometricIntersection.haversineDistance(
                current.getLat(), current.getLon(),
                goal.getLat(), goal.getLon());
        return (dist / HEURISTIC_SPEED_MPH) * 60.0;
    }

    private List<String> reconstructPath(Map<String, String> cameFrom, String goalId) {
        LinkedList<String> path = new LinkedList<>();
        String current = goalId;
        while (current != null) {
            path.addFirst(current);
            current = cameFrom.get(current);
        }
        return path;
    }

    // -----------------------------------------------------------------------
    //  Danger-score update
    // -----------------------------------------------------------------------

    private void updateDangerScores(RoadNetwork network, List<StormCell> storms) {
        for (Edge edge : network.getEdges()) {
            Node from = network.getNode(edge.getFromNode());
            Node to = network.getNode(edge.getToNode());
            if (from == null || to == null) continue;

            double dangerScore = 0.0;
            for (StormCell storm : storms) {
                for (TimedPolygon tp : storm.getPredictedPath()) {
                    // Check if edge intersects hazard polygon
                    if (GeometricIntersection.lineSegmentIntersectsPolygon(
                            from.getLat(), from.getLon(),
                            to.getLat(), to.getLon(),
                            tp.getVertices())) {
                        double severity = hazardSeverity(storm.getHazardType());
                        dangerScore = Math.max(dangerScore, severity);
                    } else {
                        // Check proximity — midpoint of edge to polygon
                        double midLat = (from.getLat() + to.getLat()) / 2;
                        double midLon = (from.getLon() + to.getLon()) / 2;
                        double dist = GeometricIntersection.minimumDistanceToPolygon(
                                midLat, midLon, tp.getVertices());
                        if (dist < 5.0) {
                            dangerScore = Math.max(dangerScore, 0.3);
                        }
                    }
                }
            }
            edge.setWeatherDangerScore(dangerScore);
        }
    }

    private double hazardSeverity(HazardType type) {
        return switch (type) {
            case TORNADO             -> 1.0;
            case HURRICANE           -> 1.0;
            case FLASH_FLOOD         -> 0.85;
            case WILDFIRE_SMOKE      -> 0.70;
            case SEVERE_THUNDERSTORM -> 0.65;
            case WINTER_STORM        -> 0.55;
        };
    }

    // -----------------------------------------------------------------------
    //  Utility
    // -----------------------------------------------------------------------

    private String findNearestNode(double lat, double lon, RoadNetwork network) {
        String nearest = null;
        double minDist = Double.MAX_VALUE;
        for (Node node : network.getNodes().values()) {
            double dist = GeometricIntersection.haversineDistance(
                    lat, lon, node.getLat(), node.getLon());
            if (dist < minDist) {
                minDist = dist;
                nearest = node.getId();
            }
        }
        return nearest;
    }

    private AlternateRoute buildRoute(List<String> path, RoadNetwork network) {
        List<Coordinate> waypoints = new ArrayList<>();
        double totalDist = 0;
        double totalMinutes = 0;
        double maxDanger = 0;

        for (int i = 0; i < path.size(); i++) {
            Node node = network.getNode(path.get(i));
            waypoints.add(Coordinate.builder()
                    .lat(node.getLat()).lon(node.getLon()).build());

            if (i > 0) {
                for (Edge e : network.getNeighborEdges(path.get(i - 1))) {
                    if (e.getToNode().equals(path.get(i))) {
                        totalDist += e.getDistanceMiles();
                        totalMinutes += (e.getDistanceMiles() / e.getSpeedLimitMph()) * 60.0;
                        maxDanger = Math.max(maxDanger, e.getWeatherDangerScore());
                        break;
                    }
                }
            }
        }

        double safetyScore = Math.max(0, (1.0 - maxDanger) * 100.0);

        return AlternateRoute.builder()
                .waypoints(waypoints)
                .distanceMiles(Math.round(totalDist * 10.0) / 10.0)
                .estimatedMinutes(Math.round(totalMinutes * 10.0) / 10.0)
                .safetyScore(Math.round(safetyScore * 10.0) / 10.0)
                .build();
    }

    // -----------------------------------------------------------------------
    //  Static I-64 network builder
    // -----------------------------------------------------------------------

    /**
     * Builds a realistic road network representing the I-64 corridor from
     * Louisville, KY to Frankfort, KY with connecting highways (I-65, I-265,
     * US-60) as alternate route options.
     *
     * <p>Includes 22 nodes at real exit locations with approximate lat/lon
     * coordinates and 30 edges. Exits with known truck stops, rest areas,
     * and gas stations are marked as having shelter.</p>
     *
     * @return a populated {@link RoadNetwork}
     */
    public static RoadNetwork buildI64Network() {
        RoadNetwork net = new RoadNetwork();

        // === I-64 main corridor (Louisville → Frankfort) ===
        net.addNode(Node.builder().id("i64-exit-0").lat(38.2540).lon(-85.7600)
                .name("I-64/I-65 Interchange Louisville").isExit(true).hasShelter(false).build());
        net.addNode(Node.builder().id("i64-exit-5").lat(38.2510).lon(-85.6850)
                .name("Exit 5 - Hurstbourne Pkwy").isExit(true).hasShelter(true).build());
        net.addNode(Node.builder().id("i64-exit-12").lat(38.2420).lon(-85.5700)
                .name("Exit 12 - I-265 Interchange").isExit(true).hasShelter(false).build());
        net.addNode(Node.builder().id("i64-exit-15").lat(38.2380).lon(-85.5200)
                .name("Exit 15 - Blankenbaker").isExit(true).hasShelter(true).build());
        net.addNode(Node.builder().id("i64-exit-19").lat(38.2310).lon(-85.4500)
                .name("Exit 19 - Simpsonville").isExit(true).hasShelter(true).build());
        net.addNode(Node.builder().id("i64-exit-22").lat(38.2260).lon(-85.3900)
                .name("Exit 22 - Peytona").isExit(true).hasShelter(false).build());
        net.addNode(Node.builder().id("i64-exit-28").lat(38.2115).lon(-85.2800)
                .name("Exit 28 - Shelbyville/US-60").isExit(true).hasShelter(true).build());
        net.addNode(Node.builder().id("i64-exit-32").lat(38.1985).lon(-85.2100)
                .name("Exit 32 - Shelby County Rest Area").isExit(true).hasShelter(true).build());
        net.addNode(Node.builder().id("i64-exit-35").lat(38.2240).lon(-85.1420)
                .name("Exit 35 - Love's Travel Stop").isExit(true).hasShelter(true).build());
        net.addNode(Node.builder().id("i64-exit-38").lat(38.2400).lon(-85.0800)
                .name("Exit 38 - Waddy").isExit(true).hasShelter(false).build());
        net.addNode(Node.builder().id("i64-exit-43").lat(38.2600).lon(-84.9800)
                .name("Exit 43 - KY-395").isExit(true).hasShelter(false).build());
        net.addNode(Node.builder().id("i64-exit-48").lat(38.2800).lon(-84.8800)
                .name("Exit 48 - Frankfort/US-127").isExit(true).hasShelter(true).build());
        net.addNode(Node.builder().id("i64-exit-53").lat(38.2900).lon(-84.8000)
                .name("Exit 53 - US-60 Frankfort").isExit(true).hasShelter(true).build());
        net.addNode(Node.builder().id("i64-exit-58").lat(38.3000).lon(-84.7200)
                .name("Exit 58 - Frankfort East").isExit(true).hasShelter(false).build());

        // === I-265 / Gene Snyder bypass nodes ===
        net.addNode(Node.builder().id("i265-south").lat(38.1600).lon(-85.5700)
                .name("I-265 South - Fern Valley").isExit(true).hasShelter(true).build());
        net.addNode(Node.builder().id("i265-east").lat(38.2100).lon(-85.4800)
                .name("I-265 East - Middletown").isExit(true).hasShelter(false).build());

        // === US-60 alternate corridor ===
        net.addNode(Node.builder().id("us60-shelbyville").lat(38.2120).lon(-85.2240)
                .name("US-60 Shelbyville Center").isExit(true).hasShelter(true).build());
        net.addNode(Node.builder().id("us60-midway").lat(38.1800).lon(-85.1000)
                .name("US-60 Midway").isExit(false).hasShelter(false).build());
        net.addNode(Node.builder().id("us60-versailles").lat(38.0500).lon(-84.7300)
                .name("US-60 Versailles").isExit(true).hasShelter(true).build());

        // === I-65 corridor south ===
        net.addNode(Node.builder().id("i65-south-10").lat(38.1500).lon(-85.7400)
                .name("I-65 Exit 125 - Brooks").isExit(true).hasShelter(true).build());
        net.addNode(Node.builder().id("i65-south-20").lat(38.0500).lon(-85.7000)
                .name("I-65 Exit 117 - Shepherdsville").isExit(true).hasShelter(true).build());

        // === KY-53 connector ===
        net.addNode(Node.builder().id("ky53-north").lat(38.3500).lon(-85.1900)
                .name("KY-53 North").isExit(false).hasShelter(false).build());

        // ============================================================
        // EDGES (bidirectional — add both directions)
        // ============================================================

        // I-64 mainline eastbound
        addBidirectionalEdge(net, "i64-exit-0", "i64-exit-5", 5.0, 65);
        addBidirectionalEdge(net, "i64-exit-5", "i64-exit-12", 7.0, 65);
        addBidirectionalEdge(net, "i64-exit-12", "i64-exit-15", 3.5, 65);
        addBidirectionalEdge(net, "i64-exit-15", "i64-exit-19", 4.5, 65);
        addBidirectionalEdge(net, "i64-exit-19", "i64-exit-22", 3.8, 65);
        addBidirectionalEdge(net, "i64-exit-22", "i64-exit-28", 6.5, 65);
        addBidirectionalEdge(net, "i64-exit-28", "i64-exit-32", 4.5, 65);
        addBidirectionalEdge(net, "i64-exit-32", "i64-exit-35", 4.2, 65);
        addBidirectionalEdge(net, "i64-exit-35", "i64-exit-38", 4.0, 65);
        addBidirectionalEdge(net, "i64-exit-38", "i64-exit-43", 6.0, 65);
        addBidirectionalEdge(net, "i64-exit-43", "i64-exit-48", 6.5, 65);
        addBidirectionalEdge(net, "i64-exit-48", "i64-exit-53", 5.5, 65);
        addBidirectionalEdge(net, "i64-exit-53", "i64-exit-58", 5.0, 65);

        // I-265 Gene Snyder connections
        addBidirectionalEdge(net, "i64-exit-12", "i265-south", 8.0, 55);
        addBidirectionalEdge(net, "i265-south", "i265-east", 7.5, 55);
        addBidirectionalEdge(net, "i265-east", "i64-exit-19", 4.0, 55);

        // US-60 alternate route
        addBidirectionalEdge(net, "i64-exit-28", "us60-shelbyville", 2.0, 45);
        addBidirectionalEdge(net, "us60-shelbyville", "us60-midway", 8.5, 45);
        addBidirectionalEdge(net, "us60-midway", "i64-exit-38", 7.0, 45);
        addBidirectionalEdge(net, "us60-midway", "us60-versailles", 22.0, 50);
        addBidirectionalEdge(net, "us60-versailles", "i64-exit-58", 8.0, 55);

        // I-65 south connector
        addBidirectionalEdge(net, "i64-exit-0", "i65-south-10", 8.0, 65);
        addBidirectionalEdge(net, "i65-south-10", "i65-south-20", 8.0, 65);

        // KY-53 north connector (for northern bypass)
        addBidirectionalEdge(net, "i64-exit-35", "ky53-north", 10.0, 50);
        addBidirectionalEdge(net, "ky53-north", "i64-exit-48", 14.0, 50);

        return net;
    }

    private static void addBidirectionalEdge(RoadNetwork net,
                                             String fromId, String toId,
                                             double distanceMiles,
                                             double speedLimitMph) {
        net.addEdge(Edge.builder()
                .fromNode(fromId).toNode(toId)
                .distanceMiles(distanceMiles)
                .speedLimitMph(speedLimitMph)
                .weatherDangerScore(0.0)
                .build());
        net.addEdge(Edge.builder()
                .fromNode(toId).toNode(fromId)
                .distanceMiles(distanceMiles)
                .speedLimitMph(speedLimitMph)
                .weatherDangerScore(0.0)
                .build());
    }
}
