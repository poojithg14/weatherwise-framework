package com.weatherwise.service;

import com.weatherwise.entity.RiskAssessmentLogEntity;
import com.weatherwise.repository.RiskAssessmentLogRepository;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Buffers per-tick risk assessment logs and writes them in batches, keeping
 * synchronous inserts out of the position-update hot path.
 */
@Component
@Slf4j
public class RiskLogBuffer {

    private final RiskAssessmentLogRepository repository;
    private final ConcurrentLinkedQueue<RiskAssessmentLogEntity> queue = new ConcurrentLinkedQueue<>();

    public RiskLogBuffer(RiskAssessmentLogRepository repository) {
        this.repository = repository;
    }

    public void offer(RiskAssessmentLogEntity entity) {
        queue.add(entity);
    }

    @Scheduled(fixedDelayString = "${weatherwise.risk-log-flush-ms:5000}")
    @PreDestroy
    public void flush() {
        if (queue.isEmpty()) {
            return;
        }
        List<RiskAssessmentLogEntity> batch = new ArrayList<>();
        RiskAssessmentLogEntity entry;
        while ((entry = queue.poll()) != null) {
            batch.add(entry);
        }
        try {
            repository.saveAll(batch);
        } catch (Exception ex) {
            log.warn("Failed to flush {} risk log entries: {}", batch.size(), ex.getMessage());
        }
    }
}
