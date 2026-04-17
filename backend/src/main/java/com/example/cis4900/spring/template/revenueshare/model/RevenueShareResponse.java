package com.example.cis4900.spring.template.revenueshare.model;

import java.util.List;
import java.math.BigDecimal;

// response payload for the pie chart view
public record RevenueShareResponse(
    BigDecimal totalRevenue,
    List<CountryRevenueShareItem> slices
) {}
