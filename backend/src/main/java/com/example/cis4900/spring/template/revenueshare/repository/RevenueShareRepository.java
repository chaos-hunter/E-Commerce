package com.example.cis4900.spring.template.revenueshare.repository;

import com.example.cis4900.spring.template.rfm.model.RfmMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RevenueShareRepository extends JpaRepository<RfmMetric, String> {

    // aggregates revenue by country for the selected date range
    @Query(value = """
        SELECT
            -- groups blank values under a readable fallback
            COALESCE(NULLIF(TRIM(Country), ''), 'Unknown') AS country,
            SUM(Quantity * Price) AS revenue
        FROM cleaned_online_retail_data
        WHERE is_return = FALSE
          -- keeps returns out of revenue totals
          AND InvoiceDate BETWEEN :startDate AND :endDate
        GROUP BY COALESCE(NULLIF(TRIM(Country), ''), 'Unknown')
        -- keeps the largest slices first for the frontend
        ORDER BY revenue DESC, country ASC
        """, nativeQuery = true)
    List<CountryRevenueShareProjection> findCountryRevenueShares(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );
}
