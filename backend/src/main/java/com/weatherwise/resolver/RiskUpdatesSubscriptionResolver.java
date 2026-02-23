package com.weatherwise.resolver;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsSubscription;
import com.netflix.graphql.dgs.InputArgument;
import com.weatherwise.model.*;
import org.reactivestreams.Publisher;
import reactor.core.publisher.Flux;

import java.time.Duration;

@DgsComponent
public class RiskUpdatesSubscriptionResolver {

    @DgsSubscription
    public Publisher<RiskAssessment> riskUpdates(
            @InputArgument Double lat,
            @InputArgument Double lon,
            @InputArgument Double heading,
            @InputArgument Double speedMph) {

        // Simulate real-time risk updates every 5 seconds with evolving scenario
        return Flux.interval(Duration.ofSeconds(5))
                .map(tick -> {
                    double minutesElapsed = tick * 0.5;
                    double timeToIntersection = Math.max(0, 12.0 - minutesElapsed);

                    AlertTier tier;
                    ActionType action;
                    String message;
                    String guidance;

                    if (timeToIntersection > 8) {
                        tier = AlertTier.ACTION_REQUIRED;
                        action = ActionType.REROUTE;
                        message = String.format(
                                "TORNADO WARNING: Tornado-warned supercell crossing I-64 in approximately %.0f minutes. Reroute now via the next available exit.",
                                timeToIntersection);
                        guidance = "Take the next exit and follow the southern bypass via US-60 to avoid the storm path. Do NOT continue eastbound on I-64.";
                    } else if (timeToIntersection > 3) {
                        tier = AlertTier.IMMEDIATE_DANGER;
                        action = ActionType.EXIT_TO_SHELTER;
                        message = String.format(
                                "TORNADO IMMINENT: Tornado will cross I-64 in %.0f minutes. Exit immediately and seek sturdy shelter!",
                                timeToIntersection);
                        guidance = "Exit at the nearest ramp NOW. Seek shelter in a sturdy building such as Pilot Travel Center Exit 28 or Comfort Inn Shelbyville. Go to the lowest interior room away from windows.";
                    } else {
                        tier = AlertTier.IMMEDIATE_DANGER;
                        action = ActionType.EMERGENCY_SHELTER_IN_VEHICLE;
                        message = "TORNADO IMMINENT: If you cannot exit, pull over immediately. Stay buckled, engine running, head below windows.";
                        guidance = "You are in the direct path. Pull over away from overpasses and trees. Keep seatbelt fastened, put vehicle in park, keep engine running. Duck below the window line and cover your head. Do NOT get out of the vehicle.";
                    }

                    return RiskAssessment.builder()
                            .overallScore(Math.min(99.0, 78.5 + (12.0 - timeToIntersection) * 1.8))
                            .tier(tier)
                            .timeToIntersectionMinutes(timeToIntersection)
                            .recommendedAction(action)
                            .hazardType(HazardType.TORNADO)
                            .alertMessage(message)
                            .hazardSpecificGuidance(guidance)
                            .build();
                });
    }
}
