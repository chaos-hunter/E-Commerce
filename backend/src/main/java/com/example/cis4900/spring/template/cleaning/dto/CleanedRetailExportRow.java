package com.example.cis4900.spring.template.cleaning.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * File-facing projection for cleaned data export.
 */
public record CleanedRetailExportRow(
    String invoice,
    String stockCode,
    String description,
    int quantity,
    LocalDateTime invoiceDate,
    BigDecimal unitPrice,
    Integer customerId,
    String country
) {}
