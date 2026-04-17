package com.example.cis4900.spring.template.rfm.repository;

import com.example.cis4900.spring.template.rfm.model.RfmMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface RfmRepository extends JpaRepository<RfmMetric, String> {
    /**
    * Native Query for RFM analysis.
    */
    @Query(value = """
        SELECT 
            CustomerID AS customerId,
            DATEDIFF(CURRENT_DATE, MAX(InvoiceDate)) AS recency,
            COUNT(DISTINCT Invoice) AS frequency,
            SUM(Quantity * Price) AS monetary,
            Country AS country,
            -- Normalization Logic: SQRT handles the variance so bubbles look good
            SQRT(SUM(Quantity * Price)) AS bubbleSize 
        FROM cleaned_online_retail_data
        WHERE CustomerID IS NOT NULL 
            AND is_return = FALSE                           
            AND InvoiceDate BETWEEN :startDate AND :endDate  
            AND (:country IS NULL OR Country = :country) 
        GROUP BY CustomerID, Country
        """, nativeQuery = true)
        List<RfmMetric> findRfmStats(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        @Param("country") String country
    );

    @Query(value = """
        SELECT
            Invoice AS invoice,
            SUM(Quantity) AS basketSize,
            SUM(Quantity * Price) AS orderValue
        FROM cleaned_online_retail_data
        WHERE is_return = FALSE
          AND InvoiceDate BETWEEN :startDate AND :endDate
          AND (:country IS NULL OR Country = :country)
        GROUP BY Invoice, Country
        ORDER BY Invoice
        """, nativeQuery = true)
    List<InvoiceHistogramProjection> findInvoiceHistogramBase(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        @Param("country") String country
    );
}
