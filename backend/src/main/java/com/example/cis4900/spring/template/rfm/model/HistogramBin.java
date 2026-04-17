package com.example.cis4900.spring.template.rfm.model;

public record HistogramBin(
    double rangeStart,
    double rangeEnd,
    long count,
    boolean isOutlier
) {}
