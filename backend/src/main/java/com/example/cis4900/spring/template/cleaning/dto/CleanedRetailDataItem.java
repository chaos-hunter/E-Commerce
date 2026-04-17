package com.example.cis4900.spring.template.cleaning.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;

/**
 * Projection used for listing rows from cleaned_online_retail_data.
 */
public record CleanedRetailDataItem(
    int id,
    int rawDataId,
    String invoice,
    String stockCode,
    String description,
    int quantity,
    LocalDateTime invoiceDate,
    BigDecimal price,
    Integer customerId,
    String country,
    boolean isReturn,
    Instant createdAt,
    Instant updatedAt
) {}
