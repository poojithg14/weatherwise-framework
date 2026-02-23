package com.weatherwise.repository;

import com.weatherwise.entity.RiskAssessmentLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RiskAssessmentLogRepository extends JpaRepository<RiskAssessmentLogEntity, UUID> {

    List<RiskAssessmentLogEntity> findByTravelerSessionIdOrderByComputedAtDesc(UUID travelerSessionId);
}
