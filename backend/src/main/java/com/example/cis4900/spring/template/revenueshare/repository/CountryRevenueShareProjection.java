package com.example.cis4900.spring.template.revenueshare.repository;

// maps grouped query results without a dedicated entity
public interface CountryRevenueShareProjection {
    String getCountry();

    Number getRevenue();
}
