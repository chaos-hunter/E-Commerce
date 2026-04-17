package com.example.cis4900.spring.template.rfm.model;

public record HistogramSummary(
    int invoiceCount,
    Double average,
    Double median,
    Double p90
) {}
