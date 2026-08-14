package com.weatherwise.repository;

import com.weatherwise.entity.TravelerSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TravelerSessionRepository extends JpaRepository<TravelerSessionEntity, UUID> {

    Optional<TravelerSessionEntity> findBySessionToken(String sessionToken);

    Optional<TravelerSessionEntity> findBySessionTokenAndActiveTrue(String sessionToken);

    List<TravelerSessionEntity> findByActiveTrue();
}
