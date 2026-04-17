package com.example.cis4900.spring.template.revenueshare.service;

import com.example.cis4900.spring.template.revenueshare.model.RevenueShareResponse;
import com.example.cis4900.spring.template.revenueshare.repository.CountryRevenueShareProjection;
import com.example.cis4900.spring.template.revenueshare.repository.RevenueShareRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RevenueShareServiceTest {

    private RevenueShareService revenueShareService;
    private RevenueShareRepository revenueShareRepository;

    @BeforeEach
    void setUp() {
        revenueShareRepository = mock(RevenueShareRepository.class);
        revenueShareService = new RevenueShareService(revenueShareRepository);
    }

    @Test
    void testGetCountryRevenueShares_ReturnsEmptyPayloadWhenNoRowsMatch() {
        LocalDateTime start = LocalDateTime.of(2023, 1, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2023, 12, 31, 23, 59);

        when(revenueShareRepository.findCountryRevenueShares(start, end)).thenReturn(List.of());

        RevenueShareResponse result = revenueShareService.getCountryRevenueShares(start, end);

        assertEquals(new BigDecimal("0.00"), result.totalRevenue());
        assertTrue(result.slices().isEmpty());
        verify(revenueShareRepository, times(1)).findCountryRevenueShares(start, end);
    }

    @Test
    void testGetCountryRevenueShares_ComputesTotalsAndPercentages() {
        LocalDateTime start = LocalDateTime.of(2023, 1, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2023, 12, 31, 23, 59);

        when(revenueShareRepository.findCountryRevenueShares(start, end)).thenReturn(List.of(
            projection("United Kingdom", 100.0),
            projection("Netherlands", 25.0)
        ));

        RevenueShareResponse result = revenueShareService.getCountryRevenueShares(start, end);

        assertEquals(new BigDecimal("125.00"), result.totalRevenue());
        assertEquals(2, result.slices().size());
        assertEquals("United Kingdom", result.slices().get(0).country());
        assertEquals(new BigDecimal("100.00"), result.slices().get(0).revenue());
        assertEquals(new BigDecimal("80.0000"), result.slices().get(0).percentage());
        assertEquals("Netherlands", result.slices().get(1).country());
        assertEquals(new BigDecimal("25.00"), result.slices().get(1).revenue());
        assertEquals(new BigDecimal("20.0000"), result.slices().get(1).percentage());

        verify(revenueShareRepository, times(1)).findCountryRevenueShares(start, end);
    }

    @Test
    void testGetCountryRevenueShares_KeepsSmallPercentagesVisible() {
        LocalDateTime start = LocalDateTime.of(2023, 1, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2023, 12, 31, 23, 59);

        when(revenueShareRepository.findCountryRevenueShares(start, end)).thenReturn(List.of(
            projection("Large Market", 99999.0),
            projection("Tiny Market", 1.0)
        ));

        RevenueShareResponse result = revenueShareService.getCountryRevenueShares(start, end);

        assertEquals(new BigDecimal("100000.00"), result.totalRevenue());
        assertEquals(new BigDecimal("0.0010"), result.slices().get(1).percentage());
    }

    private CountryRevenueShareProjection projection(String country, Number revenue) {
        return new CountryRevenueShareProjection() {
            @Override
            public String getCountry() {
                return country;
            }

            @Override
            public Number getRevenue() {
                return revenue;
            }
        };
    }
}
