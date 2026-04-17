package com.example.cis4900.spring.template.cleaning.dto;

/**
 * Projection used for listing rows from dirty_data.
 */
public record DirtyRetailDataItem(
    int id,
    String invoice,
    String stockCode,
    String description,
    String quantity,
    String invoiceDate,
    String price,
    String customerId,
    String country
) {}
