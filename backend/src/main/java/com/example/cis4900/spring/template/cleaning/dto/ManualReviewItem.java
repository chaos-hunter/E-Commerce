package com.example.cis4900.spring.template.cleaning.dto;

import java.time.Instant;

/**
 * Projection used for listing rows from online_retail_manual_review.
 */
public record ManualReviewItem(
    int id,
    int rawDataId,
    String reviewStatus,
    String reason,
    String validationErrors,
    String rawValues,
    String cleanedValues,
    Instant createdAt,
    Instant updatedAt
) {}
