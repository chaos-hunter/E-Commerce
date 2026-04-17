package com.example.cis4900.spring.template.revenueshare.service;

import com.example.cis4900.spring.template.revenueshare.model.CountryRevenueShareItem;
import com.example.cis4900.spring.template.revenueshare.model.RevenueShareResponse;
import com.example.cis4900.spring.template.revenueshare.repository.CountryRevenueShareProjection;
import com.example.cis4900.spring.template.revenueshare.repository.RevenueShareRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
public class RevenueShareService {

    private final RevenueShareRepository revenueShareRepository;

    public RevenueShareService(RevenueShareRepository revenueShareRepository) {
        this.revenueShareRepository = revenueShareRepository;
    }

    public RevenueShareResponse getCountryRevenueShares(LocalDateTime startDate, LocalDateTime endDate) {
        List<CountryRevenueShareProjection> rows =
            revenueShareRepository.findCountryRevenueShares(startDate, endDate);

        if (rows.isEmpty()) {
            // keeps the response shape stable when no rows match
            return new RevenueShareResponse(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP), List.of());
        }

        // builds the total used to calculate each country share
        BigDecimal rawTotalRevenue = rows.stream()
            .map(CountryRevenueShareProjection::getRevenue)
            .filter(Objects::nonNull)
            .map(this::toBigDecimal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        // rounds the total for response display
        BigDecimal totalRevenue = roundMoney(rawTotalRevenue);

        // maps grouped query results into the response payload
        List<CountryRevenueShareItem> slices = rows.stream()
            .filter(row -> row.getRevenue() != null)
            .map(row -> new CountryRevenueShareItem(
                row.getCountry(),
                // rounds money values to normal currency precision
                roundMoney(toBigDecimal(row.getRevenue())),
                // uses the unrounded total so tiny slices stay visible
                calculatePercentage(toBigDecimal(row.getRevenue()), rawTotalRevenue)
            ))
            .toList();

        return new RevenueShareResponse(totalRevenue, slices);
    }

    private BigDecimal calculatePercentage(BigDecimal revenue, BigDecimal totalRevenue) {
        if (totalRevenue.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        }

        // converts one country revenue into a percent of the total
        return revenue
            .multiply(BigDecimal.valueOf(100))
            .divide(totalRevenue, 4, RoundingMode.HALF_UP);
    }

    // keeps currency values in normal money format
    private BigDecimal roundMoney(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    // converts database numeric values into big decimal values
    private BigDecimal toBigDecimal(Number value) {
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }

        return new BigDecimal(value.toString());
    }
}
