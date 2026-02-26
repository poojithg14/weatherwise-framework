package com.weatherwise.algorithm;

import com.weatherwise.model.*;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Core risk-scoring engine for the WeatherWise real-time severe weather
 * alerting framework.
 *
 * <p><b>Theoretical Foundation:</b> This scorer adapts MIT Lincoln Laboratory's
 * Convective Weather Avoidance Model (CWAM), originally designed for en-route
 * aviation, to the highway-vehicle domain. The key innovation is the combination
 * of five orthogonal risk sub-scores — proximity, intersection likelihood,
 * severity, exposure duration, and escape availability — into a single
 * composite risk index that directly maps to actionable alert tiers.</p>
 *
 * <h3>Algorithm Overview</h3>
 * <p>The composite risk score <i>R</i> is computed as a weighted linear
 * combination of five normalized sub-scores, each in the range [0.0, 1.0]:</p>
 *
 * <pre>
 *   R = w₁·PROXIMITY + w₂·INTERSECTION + w₃·SEVERITY + w₄·EXPOSURE + w₅·ESCAPE_OPTIONS
 *
 *   where  w₁ = 0.25,  w₂ = 0.30,  w₃ = 0.20,  w₄ = 0.15,  w₅ = 0.10
 * </pre>
 *
 * <h4>Sub-score Definitions</h4>
 * <ol>
 *   <li><b>PROXIMITY (w=0.25):</b> Logarithmic decay of distance to nearest
 *       hazard corridor boundary. {@code score = max(0, 1 − log₁₀(d+1)/log₁₀(51))}.
 *       A traveler &lt;1 mile from a hazard scores ~1.0; at 50 miles, ~0.0.</li>
 *   <li><b>INTERSECTION (w=0.30):</b> Forward projection of both traveler and
 *       storm positions at 5-minute intervals over a 60-minute horizon. If the
 *       projected traveler position falls inside the projected storm polygon,
 *       the score is 1.0 for intersection within 15 min, decaying linearly to
 *       0.0 at 60 min. No intersection yields 0.0.</li>
 *   <li><b>SEVERITY (w=0.20):</b> Categorical mapping of hazard type to a
 *       fixed severity coefficient (e.g., TORNADO → 1.0, HURRICANE → 0.95,
 *       FLASH_FLOOD → 0.80, SEVERE_THUNDERSTORM → 0.75).</li>
 *   <li><b>EXPOSURE (w=0.15):</b> Estimated minutes the traveler would spend
 *       inside the hazard corridor if no action is taken, normalized by 30 min.
 *       {@code score = min(1.0, exposureMinutes / 30)}.</li>
 *   <li><b>ESCAPE_OPTIONS (w=0.10):</b> Inverse measure of safe-exit
 *       availability within graduated distance bands (5 mi, 10 mi, 15 mi).</li>
 * </ol>
 *
 * <h4>Nighttime Adjustment</h4>
 * <p>If {@code isNighttime} is true, the INTERSECTION and SEVERITY sub-scores
 * are multiplied by 1.15 (capped at 1.0) before combination, reflecting the
 * increased risk due to reduced visibility and slower driver reaction times
 * at night.</p>
 *
 * <h4>Alert Tier Mapping</h4>
 * <ul>
 *   <li>R &lt; 0.25 → MONITORING</li>
 *   <li>0.25 ≤ R &lt; 0.50 → ADVISORY</li>
 *   <li>0.50 ≤ R &lt; 0.75 → ACTION_REQUIRED</li>
 *   <li>R ≥ 0.75 → IMMEDIATE_DANGER</li>
 * </ul>
 *
 * <p><b>For IEEE Access Paper Section IV-B (Methodology).</b></p>
 *
 * @author WeatherWise Research Team
 * @see GeometricIntersection
 */
@Component
public class TravelerRiskScorer {

    // Sub-score weights (must sum to 1.0)
    private static final double W_PROXIMITY    = 0.25;
    private static final double W_INTERSECTION = 0.30;
    private static final double W_SEVERITY     = 0.20;
    private static final double W_EXPOSURE     = 0.15;
    private static final double W_ESCAPE       = 0.10;

    // Nighttime escalation multiplier
    private static final double NIGHTTIME_FACTOR = 1.15;

    // Forward-projection horizon (minutes) and step size
    private static final int PROJECTION_HORIZON_MIN = 60;
    private static final int PROJECTION_STEP_MIN    = 5;

    // Tier thresholds (match paper Section IV-B)
    private static final double TIER_ADVISORY_THRESHOLD = 0.25;
    private static final double TIER_ACTION_THRESHOLD   = 0.50;
    private static final double TIER_DANGER_THRESHOLD   = 0.75;

    /**
     * Computes a composite risk assessment for a traveler given the current
     * storm-cell landscape and available safe locations.
     *
     * @param traveler      current traveler position, heading, and speed
     * @param storms        list of active storm cells with predicted paths
     * @param safeLocations list of known safe locations (shelters, exits)
     * @param isNighttime   whether the current time is between 20:00 and 06:00
     * @return a fully populated {@link RiskAssessment} including composite
     *         score, tier, recommended action, and human-readable messages
     */
    public RiskAssessment computeRisk(TravelerPosition traveler,
                                      List<StormCell> storms,
                                      List<SafeLocation> safeLocations,
                                      boolean isNighttime) {
        if (storms == null || storms.isEmpty()) {
            return buildClearConditions(0.0, null);
        }

        // Find the most threatening storm (highest raw composite) and use
        // it to drive the final assessment.
        StormCell worstStorm = null;
        double worstScore = -1;
        double worstProximity = 0, worstIntersection = 0, worstSeverity = 0;
        double worstExposure = 0, worstEscape = 0;
        double worstTimeToIntersect = Double.MAX_VALUE;

        for (StormCell storm : storms) {
            double proximity    = computeProximity(traveler, storm);
            double intersection = computeIntersection(traveler, storm);
            double severity     = computeSeverity(storm.getHazardType());
            double exposure     = computeExposure(traveler, storm);
            double escape       = computeEscapeOptions(traveler, safeLocations);

            // Apply nighttime escalation
            if (isNighttime) {
                intersection = Math.min(1.0, intersection * NIGHTTIME_FACTOR);
                severity     = Math.min(1.0, severity * NIGHTTIME_FACTOR);
            }

            double composite = W_PROXIMITY * proximity
                             + W_INTERSECTION * intersection
                             + W_SEVERITY * severity
                             + W_EXPOSURE * exposure
                             + W_ESCAPE * escape;

            if (composite > worstScore) {
                worstScore        = composite;
                worstStorm        = storm;
                worstProximity    = proximity;
                worstIntersection = intersection;
                worstSeverity     = severity;
                worstExposure     = exposure;
                worstEscape       = escape;
                worstTimeToIntersect = findTimeToIntersection(traveler, storm);
            }
        }

        // Map composite score to 0-100 display scale
        double displayScore = Math.round(worstScore * 100.0 * 10.0) / 10.0;
        displayScore = Math.min(100.0, Math.max(0.0, displayScore));

        // Determine tier
        AlertTier tier = determineTier(worstScore);

        // Determine recommended action
        ActionType action = determineAction(tier, traveler, safeLocations, storms);

        // Determine time to intersection (null if no intersection predicted)
        Double timeToIntersection = (worstTimeToIntersect < Double.MAX_VALUE)
                ? Math.round(worstTimeToIntersect * 10.0) / 10.0
                : null;

        HazardType hazardType = (worstStorm != null) ? worstStorm.getHazardType() : null;

        // Generate messages
        String alertMessage = generateAlertMessage(tier, action, hazardType,
                timeToIntersection, traveler, safeLocations);
        String guidance = generateHazardGuidance(hazardType);

        return RiskAssessment.builder()
                .overallScore(displayScore)
                .tier(tier)
                .timeToIntersectionMinutes(timeToIntersection)
                .recommendedAction(action)
                .hazardType(hazardType)
                .alertMessage(alertMessage)
                .hazardSpecificGuidance(guidance)
                .build();
    }

    // -----------------------------------------------------------------------
    //  Sub-score computations
    // -----------------------------------------------------------------------

    /**
     * PROXIMITY sub-score: logarithmic decay of minimum distance to nearest
     * hazard corridor boundary.
     *
     * <pre>score = max(0, 1 − log₁₀(distance + 1) / log₁₀(51))</pre>
     *
     * @param traveler current position
     * @param storm    storm cell with predicted path polygons
     * @return normalized proximity score [0.0, 1.0]
     */
    double computeProximity(TravelerPosition traveler, StormCell storm) {
        double minDist = Double.MAX_VALUE;

        // Check distance to each predicted-path polygon
        for (TimedPolygon tp : storm.getPredictedPath()) {
            double dist = GeometricIntersection.minimumDistanceToPolygon(
                    traveler.getLat(), traveler.getLon(), tp.getVertices());
            if (dist < minDist) {
                minDist = dist;
            }
        }

        // Also check distance to the storm center itself
        double centerDist = GeometricIntersection.haversineDistance(
                traveler.getLat(), traveler.getLon(),
                storm.getLat(), storm.getLon());
        if (centerDist < minDist) {
            minDist = centerDist;
        }

        return Math.max(0.0, 1.0 - Math.log10(minDist + 1) / Math.log10(51));
    }

    /**
     * INTERSECTION sub-score: forward-projects both traveler and storm at
     * 5-minute intervals. If the traveler's projected position falls within
     * the storm's projected polygon at any time step, the score reflects
     * urgency based on how soon the intersection occurs.
     *
     * <pre>
     * score = 1.0                      if t_intersect ≤ 15 min
     * score = 1.0 − (t − 15) / 45     if 15 < t_intersect ≤ 60 min
     * score = 0.0                      if no intersection within 60 min
     * </pre>
     *
     * @param traveler current position, heading, and speed
     * @param storm    storm cell with velocity and predicted path
     * @return normalized intersection score [0.0, 1.0]
     */
    double computeIntersection(TravelerPosition traveler, StormCell storm) {
        double earliestIntersectMin = findTimeToIntersection(traveler, storm);

        if (earliestIntersectMin >= PROJECTION_HORIZON_MIN) {
            return 0.0;
        }
        if (earliestIntersectMin <= 15.0) {
            return 1.0;
        }
        // Linear decay from 1.0 at 15 min to 0.0 at 60 min
        return 1.0 - (earliestIntersectMin - 15.0) / 45.0;
    }

    /**
     * Finds the earliest time (in minutes) at which the traveler's projected
     * position intersects any of the storm's projected hazard polygons.
     *
     * @return time in minutes, or {@link Double#MAX_VALUE} if no intersection
     */
    private double findTimeToIntersection(TravelerPosition traveler, StormCell storm) {
        for (int t = 0; t <= PROJECTION_HORIZON_MIN; t += PROJECTION_STEP_MIN) {
            // Project the traveler forward
            Coordinate travelerFuture = GeometricIntersection.projectPosition(
                    traveler.getLat(), traveler.getLon(),
                    traveler.getHeading(), traveler.getSpeedMph(), t);

            // Project each storm polygon forward based on storm velocity
            // Storm velocity is in mph; convert to degree offset approximation
            for (TimedPolygon tp : storm.getPredictedPath()) {
                List<Coordinate> projectedPoly = projectStormPolygon(
                        tp.getVertices(), storm.getVelocityX(), storm.getVelocityY(), t);

                if (GeometricIntersection.pointInPolygon(
                        travelerFuture.getLat(), travelerFuture.getLon(), projectedPoly)) {
                    return t;
                }
            }
        }
        return Double.MAX_VALUE;
    }

    /**
     * Projects a storm polygon forward in time based on the storm's velocity
     * components (velocityX = eastward mph, velocityY = northward mph).
     */
    private List<Coordinate> projectStormPolygon(List<Coordinate> vertices,
                                                 double velocityX,
                                                 double velocityY,
                                                 double minutes) {
        // Convert mph to approximate degrees per minute
        // 1 degree latitude ≈ 69.0 miles, 1 degree longitude ≈ 69.0 * cos(lat) miles
        // Use average latitude of the polygon for the longitude conversion
        double avgLat = vertices.stream()
                .mapToDouble(Coordinate::getLat).average().orElse(38.0);
        double cosLat = Math.cos(Math.toRadians(avgLat));

        double dLatPerMin = (velocityY / 60.0) / 69.0;
        double dLonPerMin = (velocityX / 60.0) / (69.0 * cosLat);

        double dLat = dLatPerMin * minutes;
        double dLon = dLonPerMin * minutes;

        return vertices.stream()
                .map(v -> Coordinate.builder()
                        .lat(v.getLat() + dLat)
                        .lon(v.getLon() + dLon)
                        .build())
                .toList();
    }

    /**
     * SEVERITY sub-score: fixed categorical mapping of hazard type to a
     * severity coefficient reflecting potential for loss of life or
     * vehicle damage on a highway.
     *
     * <table>
     *   <tr><th>Hazard Type</th><th>Score</th><th>Rationale</th></tr>
     *   <tr><td>TORNADO</td><td>1.00</td><td>EF3+ direct life threat</td></tr>
     *   <tr><td>HURRICANE</td><td>0.95</td><td>Cat 3+ direct life threat</td></tr>
     *   <tr><td>FLASH_FLOOD</td><td>0.80</td><td>#1 cause of weather deaths</td></tr>
     *   <tr><td>SEVERE_THUNDERSTORM</td><td>0.75</td><td>Large hail, wind</td></tr>
     *   <tr><td>WILDFIRE_SMOKE</td><td>0.70</td><td>Near-zero visibility risk</td></tr>
     *   <tr><td>WINTER_STORM</td><td>0.55</td><td>Reduced traction, visibility</td></tr>
     * </table>
     *
     * @param type the hazard type
     * @return normalized severity score [0.0, 1.0]
     */
    double computeSeverity(HazardType type) {
        if (type == null) return 0.0;
        return switch (type) {
            case TORNADO              -> 1.0;
            case HURRICANE            -> 0.95;
            case FLASH_FLOOD          -> 0.80;
            case SEVERE_THUNDERSTORM  -> 0.75;
            case WILDFIRE_SMOKE       -> 0.70;
            case WINTER_STORM         -> 0.55;
        };
    }

    /**
     * EXPOSURE sub-score: estimates how many minutes the traveler would spend
     * inside the hazard corridor if no evasive action is taken, normalized
     * by a 30-minute baseline.
     *
     * <pre>score = min(1.0, exposureMinutes / 30.0)</pre>
     *
     * <p>Exposure is computed by projecting the traveler forward at 1-minute
     * intervals and counting how many of those intervals fall inside any
     * storm polygon.</p>
     *
     * @param traveler current position, heading, and speed
     * @param storm    storm cell with predicted path
     * @return normalized exposure score [0.0, 1.0]
     */
    double computeExposure(TravelerPosition traveler, StormCell storm) {
        int insideCount = 0;

        for (int t = 0; t <= PROJECTION_HORIZON_MIN; t++) {
            Coordinate pos = GeometricIntersection.projectPosition(
                    traveler.getLat(), traveler.getLon(),
                    traveler.getHeading(), traveler.getSpeedMph(), t);

            for (TimedPolygon tp : storm.getPredictedPath()) {
                List<Coordinate> projPoly = projectStormPolygon(
                        tp.getVertices(), storm.getVelocityX(), storm.getVelocityY(), t);
                if (GeometricIntersection.pointInPolygon(
                        pos.getLat(), pos.getLon(), projPoly)) {
                    insideCount++;
                    break;
                }
            }
        }

        return Math.min(1.0, insideCount / 30.0);
    }

    /**
     * ESCAPE_OPTIONS sub-score: inverse measure of how many safe exits are
     * available nearby. More options = lower score (less risk).
     *
     * <pre>
     * 3+ safe exits within 5 mi  → 0.1
     * 1–2 exits within 5 mi      → 0.3
     * Exits within 10 mi only    → 0.6
     * Exits within 15 mi only    → 0.9
     * Nothing within 15 mi       → 1.0
     * </pre>
     *
     * @param traveler      current position
     * @param safeLocations available safe locations
     * @return normalized escape-options score [0.0, 1.0]
     */
    double computeEscapeOptions(TravelerPosition traveler,
                                List<SafeLocation> safeLocations) {
        if (safeLocations == null || safeLocations.isEmpty()) {
            return 1.0;
        }

        int within5  = 0;
        int within10 = 0;
        int within15 = 0;

        for (SafeLocation loc : safeLocations) {
            double dist = GeometricIntersection.haversineDistance(
                    traveler.getLat(), traveler.getLon(),
                    loc.getLat(), loc.getLon());
            if (dist <= 5.0)  within5++;
            if (dist <= 10.0) within10++;
            if (dist <= 15.0) within15++;
        }

        if (within5 >= 3)       return 0.1;
        if (within5 >= 1)       return 0.3;
        if (within10 >= 1)      return 0.6;
        if (within15 >= 1)      return 0.9;
        return 1.0;
    }

    // -----------------------------------------------------------------------
    //  Tier and action determination
    // -----------------------------------------------------------------------

    private AlertTier determineTier(double compositeScore) {
        if (compositeScore >= TIER_DANGER_THRESHOLD)   return AlertTier.IMMEDIATE_DANGER;
        if (compositeScore >= TIER_ACTION_THRESHOLD)    return AlertTier.ACTION_REQUIRED;
        if (compositeScore >= TIER_ADVISORY_THRESHOLD)  return AlertTier.ADVISORY;
        return AlertTier.MONITORING;
    }

    /**
     * Determines the recommended driver action based on the alert tier,
     * traveler position, available safe locations, and storm configuration.
     *
     * <p>Decision matrix:</p>
     * <ul>
     *   <li>ADVISORY → CONTINUE_MONITORING</li>
     *   <li>ACTION_REQUIRED + safe locations within 5 mi with safe route → REROUTE</li>
     *   <li>ACTION_REQUIRED + safe locations nearby but no safe route → EXIT_TO_SHELTER</li>
     *   <li>ACTION_REQUIRED + nothing nearby → PULL_OVER</li>
     *   <li>IMMEDIATE_DANGER + exit within 2 mi → EXIT_TO_SHELTER</li>
     *   <li>IMMEDIATE_DANGER + no exit → EMERGENCY_SHELTER_IN_VEHICLE</li>
     * </ul>
     */
    private ActionType determineAction(AlertTier tier,
                                       TravelerPosition traveler,
                                       List<SafeLocation> safeLocations,
                                       List<StormCell> storms) {
        if (tier == AlertTier.MONITORING || tier == AlertTier.ADVISORY) {
            return ActionType.CONTINUE_MONITORING;
        }

        boolean exitWithin2mi = false;
        boolean exitWithin5mi = false;
        boolean anySafeLocationNearby = false;

        if (safeLocations != null) {
            for (SafeLocation loc : safeLocations) {
                double dist = GeometricIntersection.haversineDistance(
                        traveler.getLat(), traveler.getLon(),
                        loc.getLat(), loc.getLon());
                if (dist <= 2.0) exitWithin2mi = true;
                if (dist <= 5.0) exitWithin5mi = true;
                if (dist <= 15.0) anySafeLocationNearby = true;
            }
        }

        if (tier == AlertTier.IMMEDIATE_DANGER) {
            return exitWithin2mi ? ActionType.EXIT_TO_SHELTER
                                 : ActionType.EMERGENCY_SHELTER_IN_VEHICLE;
        }

        // ACTION_REQUIRED
        if (exitWithin5mi && hasRouteClearOfStorms(traveler, safeLocations, storms)) {
            return ActionType.REROUTE;
        }
        if (anySafeLocationNearby) {
            return ActionType.EXIT_TO_SHELTER;
        }
        return ActionType.PULL_OVER;
    }

    /**
     * Quick check: is there at least one safe location within 5 mi that can
     * be reached without crossing a storm polygon?
     */
    private boolean hasRouteClearOfStorms(TravelerPosition traveler,
                                         List<SafeLocation> safeLocations,
                                         List<StormCell> storms) {
        if (safeLocations == null || storms == null) return true;

        for (SafeLocation loc : safeLocations) {
            double dist = GeometricIntersection.haversineDistance(
                    traveler.getLat(), traveler.getLon(),
                    loc.getLat(), loc.getLon());
            if (dist > 5.0) continue;

            boolean blocked = false;
            for (StormCell storm : storms) {
                for (TimedPolygon tp : storm.getPredictedPath()) {
                    if (GeometricIntersection.lineSegmentIntersectsPolygon(
                            traveler.getLat(), traveler.getLon(),
                            loc.getLat(), loc.getLon(),
                            tp.getVertices())) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) break;
            }
            if (!blocked) return true;
        }
        return false;
    }

    // -----------------------------------------------------------------------
    //  Message generation
    // -----------------------------------------------------------------------

    /**
     * Generates a human-readable alert message appropriate for the alert tier,
     * recommended action, hazard type, and current context.
     */
    private String generateAlertMessage(AlertTier tier, ActionType action,
                                        HazardType hazardType,
                                        Double timeToIntersection,
                                        TravelerPosition traveler,
                                        List<SafeLocation> safeLocations) {
        String hazardName = hazardDisplayName(hazardType);
        SafeLocation nearest = findNearestSafe(traveler, safeLocations);
        String nearestInfo = (nearest != null)
                ? String.format("%s (%.1f mi)", nearest.getName(), nearest.getDistanceMiles())
                : "";

        return switch (tier) {
            case MONITORING -> "All clear. Monitoring conditions along your route.";

            case ADVISORY -> String.format(
                    "Severe weather developing %.0f miles from your route. "
                  + "Currently no impact expected. Monitoring conditions.",
                    timeToIntersection != null ? timeToIntersection * 1.2 : 35.0);

            case ACTION_REQUIRED -> switch (action) {
                case REROUTE -> String.format(
                        "%s crossing your route in approximately %.0f minutes. "
                      + "Safe alternate route available. Tap to reroute.",
                        hazardName,
                        timeToIntersection != null ? timeToIntersection : 20.0);
                case EXIT_TO_SHELTER -> String.format(
                        "%s warnings on routes ahead. Exit to shelter at %s. "
                      + "Indoor shelter available.",
                        hazardName, nearestInfo);
                case PULL_OVER -> String.format(
                        "No safe route or shelter nearby. Reduce speed. "
                      + "Prepare to pull over if conditions worsen. "
                      + "Next exit: %s.",
                        nearestInfo.isEmpty() ? "unknown" : nearestInfo);
                default -> "Severe weather in your area. Take appropriate precautions.";
            };

            case IMMEDIATE_DANGER -> switch (action) {
                case EXIT_TO_SHELTER -> String.format(
                        "%s DANGER. EXIT NOW at %s. "
                      + "Go inside to interior room immediately.",
                        hazardName.toUpperCase(), nearestInfo);
                case EMERGENCY_SHELTER_IN_VEHICLE -> String.format(
                        "%s DANGER. No exit nearby. Pull over NOW. "
                      + "Park vehicle. Seatbelt ON. Head below windows. Cover with arms.",
                        hazardName.toUpperCase());
                default -> hazardName.toUpperCase() + " DANGER. Seek shelter immediately.";
            };
        };
    }

    /**
     * Returns hazard-specific safety guidance tailored for highway travelers.
     *
     * <p>Each guidance string is based on NOAA / NWS best practices and
     * adapted for the in-vehicle context.</p>
     */
    private String generateHazardGuidance(HazardType type) {
        if (type == null) return "Monitor conditions and be prepared to take action.";

        return switch (type) {
            case TORNADO -> "Do NOT shelter under overpasses — wind tunnel effect "
                    + "increases danger. Stay in vehicle with seatbelt fastened. "
                    + "Keep head below window level.";
            case FLASH_FLOOD -> "Never drive through standing water. 6 inches can "
                    + "knock you down, 12 inches carries a vehicle. "
                    + "Turn Around Don't Drown.";
            case WINTER_STORM -> "Reduce speed to 25 mph. Increase following distance "
                    + "to 10 seconds. Headlights on. If whiteout: pull over, "
                    + "hazard lights on, stay in vehicle.";
            case WILDFIRE_SMOKE -> "Close all windows and vents. Set AC to recirculate. "
                    + "If visibility below 100 feet, pull over safely. "
                    + "If fire approaching, drive through quickly — do not stop in fire zone.";
            case HURRICANE -> "Seek sturdy building immediately. Avoid mobile structures, "
                    + "downed power lines, and standing water.";
            case SEVERE_THUNDERSTORM -> "Reduce speed for hail. Pull over if visibility "
                    + "drops or hail becomes large. Stay in vehicle — it provides protection.";
        };
    }

    private String hazardDisplayName(HazardType type) {
        if (type == null) return "Severe weather";
        return switch (type) {
            case TORNADO              -> "Tornado-warned storm";
            case HURRICANE            -> "Hurricane";
            case FLASH_FLOOD          -> "Flash flood";
            case SEVERE_THUNDERSTORM  -> "Severe thunderstorm";
            case WINTER_STORM         -> "Winter storm";
            case WILDFIRE_SMOKE       -> "Wildfire smoke";
        };
    }

    private SafeLocation findNearestSafe(TravelerPosition traveler,
                                         List<SafeLocation> locations) {
        if (locations == null || locations.isEmpty()) return null;
        SafeLocation nearest = null;
        double minDist = Double.MAX_VALUE;
        for (SafeLocation loc : locations) {
            double dist = GeometricIntersection.haversineDistance(
                    traveler.getLat(), traveler.getLon(),
                    loc.getLat(), loc.getLon());
            if (dist < minDist) {
                minDist = dist;
                nearest = loc;
            }
        }
        return nearest;
    }

    private RiskAssessment buildClearConditions(double score, HazardType type) {
        return RiskAssessment.builder()
                .overallScore(score)
                .tier(AlertTier.MONITORING)
                .recommendedAction(ActionType.CONTINUE_MONITORING)
                .hazardType(type)
                .alertMessage("No severe weather threats detected on your route. Conditions clear.")
                .hazardSpecificGuidance(null)
                .build();
    }
}
