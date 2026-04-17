package com.example.cis4900.spring.template.rfm.model;

public record HistogramResponse(
    HistogramMetric basketSize,
    HistogramMetric orderValue
) {}
