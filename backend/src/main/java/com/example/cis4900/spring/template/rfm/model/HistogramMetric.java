package com.example.cis4900.spring.template.rfm.model;

import java.util.List;

public record HistogramMetric(
    HistogramSummary summary,
    List<HistogramBin> bins
) {}
