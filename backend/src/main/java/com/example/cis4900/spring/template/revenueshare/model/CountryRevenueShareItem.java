package com.example.cis4900.spring.template.revenueshare.model;

import java.math.BigDecimal;

// one slice in the pie chart response
public record CountryRevenueShareItem(
    String country,
    BigDecimal revenue,
    BigDecimal percentage
) {}
