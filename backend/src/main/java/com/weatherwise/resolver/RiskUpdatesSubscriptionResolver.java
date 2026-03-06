package com.weatherwise.resolver;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsSubscription;
import com.netflix.graphql.dgs.InputArgument;
import com.weatherwise.model.*;
import com.weatherwise.service.RiskScoringService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.reactivestreams.Publisher;
import reactor.core.publisher.Flux;

import java.time.Duration;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class RiskUpdatesSubscriptionResolver {

    private final RiskScoringService riskScoringService;

    @DgsSubscription
    public Publisher<RiskAssessment> riskUpdates(
            @InputArgument Double lat,
            @InputArgument Double lon,
            @InputArgument Double heading,
            @InputArgument Double speedMph) {

        double safeLat = lat != null ? lat : 0.0;
        double safeLon = lon != null ? lon : 0.0;
        double safeHeading = heading != null ? heading : 0.0;
        double safeSpeed = speedMph != null ? speedMph : 0.0;

        // Stream real risk assessments every 10 seconds using live NWS + ML data
        return Flux.interval(Duration.ofSeconds(10))
                .map(tick -> {
                    try {
                        return riskScoringService.computeFullRisk(
                                safeLat, safeLon, safeHeading, safeSpeed, null);
                    } catch (Exception e) {
                        log.debug("Risk computation failed in subscription: {}", e.getMessage());
                        return RiskAssessment.builder()
                                .overallScore(0.0)
                                .tier(AlertTier.MONITORING)
                                .recommendedAction(ActionType.CONTINUE_MONITORING)
                                .alertMessage("Monitoring conditions. Backend temporarily unavailable.")
                                .build();
                    }
                });
    }
}
