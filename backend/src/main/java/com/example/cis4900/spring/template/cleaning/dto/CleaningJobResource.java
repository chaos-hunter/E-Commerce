package com.example.cis4900.spring.template.cleaning.dto;

import java.time.Instant;
import com.example.cis4900.spring.template.cleaning.model.CleaningRunSummary;

public record CleaningJobResource(
    String jobId,
    String status,
    Instant createdAt,
    Instant startedAt,
    long processedCount,
    long totalCount,
    double progress,
    Long estimatedMillisRemaining,
    CleaningRunSummary summary
) {}
