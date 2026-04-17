package com.example.cis4900.spring.template.rfm.service;

import com.example.cis4900.spring.template.rfm.model.HistogramBin;
import com.example.cis4900.spring.template.rfm.model.HistogramResponse;
import com.example.cis4900.spring.template.rfm.model.RfmMetric;
import com.example.cis4900.spring.template.rfm.repository.InvoiceHistogramProjection;
import com.example.cis4900.spring.template.rfm.repository.RfmRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RfmServiceTest {

    private RfmService rfmService;
    private RfmRepository rfmRepository;

    @BeforeEach
    void setUp() {
        rfmRepository = mock(RfmRepository.class);
        rfmService = new RfmService(rfmRepository);
    }

    @Test
    void testGetRfmData_TrimsCountryBeforeRepositoryCall() {
        LocalDateTime start = LocalDateTime.of(2023, 1, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2023, 12, 31, 23, 59);
        List<RfmMetric> mockData = List.of();

        when(rfmRepository.findRfmStats(start, end, "Canada")).thenReturn(mockData);

        List<RfmMetric> result = rfmService.getRfmData(start, end, " Canada ");

        assertEquals(mockData, result);
        verify(rfmRepository, times(1)).findRfmStats(start, end, "Canada");
    }

    @Test
    void testGetRfmData_BlankCountryBecomesNull() {
        LocalDateTime start = LocalDateTime.of(2023, 1, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2023, 12, 31, 23, 59);
        List<RfmMetric> mockData = List.of();

        when(rfmRepository.findRfmStats(start, end, null)).thenReturn(mockData);

        List<RfmMetric> result = rfmService.getRfmData(start, end, "   ");

        assertEquals(mockData, result);
        verify(rfmRepository, times(1)).findRfmStats(start, end, null);
    }

    @Test
    void testGetHistogramData_ReturnsEmptyPayloadWhenNoInvoicesMatch() {
        LocalDateTime start = LocalDateTime.of(2023, 1, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2023, 12, 31, 23, 59);

        when(rfmRepository.findInvoiceHistogramBase(start, end, null)).thenReturn(List.of());

        HistogramResponse result = rfmService.getHistogramData(start, end, "   ");

        assertEquals(0, result.basketSize().summary().invoiceCount());
        assertNull(result.basketSize().summary().average());
        assertNull(result.basketSize().summary().median());
        assertNull(result.basketSize().summary().p90());
        assertTrue(result.basketSize().bins().isEmpty());

        assertEquals(0, result.orderValue().summary().invoiceCount());
        assertNull(result.orderValue().summary().average());
        assertNull(result.orderValue().summary().median());
        assertNull(result.orderValue().summary().p90());
        assertTrue(result.orderValue().bins().isEmpty());

        verify(rfmRepository, times(1)).findInvoiceHistogramBase(start, end, null);
    }

    @Test
    void testGetHistogramData_BuildsExpectedSummaryAndNormalBins() {
        LocalDateTime start = LocalDateTime.of(2023, 1, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2023, 12, 31, 23, 59);

        when(rfmRepository.findInvoiceHistogramBase(start, end, "Canada")).thenReturn(List.of(
            projection("INV-1", 10, 10),
            projection("INV-2", 60, 110),
            projection("INV-3", 110, 210),
            projection("INV-4", 160, 310),
            projection("INV-5", 210, 410)
        ));

        HistogramResponse result = rfmService.getHistogramData(start, end, " Canada ");

        assertEquals(5, result.basketSize().summary().invoiceCount());
        assertEquals(110.0, result.basketSize().summary().average());
        assertEquals(110.0, result.basketSize().summary().median());
        assertEquals(210.0, result.basketSize().summary().p90());
        assertEquals(5, result.basketSize().bins().size());
        assertEquals(1, result.basketSize().bins().get(0).count());
        assertEquals(1, result.basketSize().bins().get(4).count());
        assertFalse(result.basketSize().bins().get(4).isOutlier());
        assertEquals(0.0, result.basketSize().bins().get(0).rangeStart());
        assertEquals(50.0, result.basketSize().bins().get(0).rangeEnd());

        assertEquals(5, result.orderValue().summary().invoiceCount());
        assertEquals(210.0, result.orderValue().summary().average());
        assertEquals(210.0, result.orderValue().summary().median());
        assertEquals(410.0, result.orderValue().summary().p90());
        assertEquals(9, result.orderValue().bins().size());
        assertEquals(1, result.orderValue().bins().get(0).count());
        assertEquals(1, result.orderValue().bins().get(8).count());
        assertFalse(result.orderValue().bins().get(8).isOutlier());
        assertEquals(0.0, result.orderValue().bins().get(0).rangeStart());
        assertEquals(50.0, result.orderValue().bins().get(0).rangeEnd());

        verify(rfmRepository, times(1)).findInvoiceHistogramBase(start, end, "Canada");
    }

    @Test
    void testGetHistogramData_UsesSmallerReadableBinsForSmallRanges() {
        LocalDateTime start = LocalDateTime.of(2023, 1, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2023, 12, 31, 23, 59);

        when(rfmRepository.findInvoiceHistogramBase(start, end, null)).thenReturn(List.of(
            projection("INV-1", 101, 201),
            projection("INV-2", 105, 205),
            projection("INV-3", 109, 209)
        ));

        HistogramResponse result = rfmService.getHistogramData(start, end, null);

        assertTrue(result.basketSize().bins().size() > 2);
        assertEquals(101.0, result.basketSize().bins().get(0).rangeStart());
        assertEquals(1.0,
            result.basketSize().bins().get(0).rangeEnd() - result.basketSize().bins().get(0).rangeStart());

        assertTrue(result.orderValue().bins().size() > 2);
        assertEquals(200.0, result.orderValue().bins().get(0).rangeStart());
        assertEquals(2.0,
            result.orderValue().bins().get(0).rangeEnd() - result.orderValue().bins().get(0).rangeStart());
    }

    @Test
    void testGetHistogramData_MarksOnlyFinalOverflowBinAsOutlier() {
        LocalDateTime start = LocalDateTime.of(2023, 1, 1, 0, 0);
        LocalDateTime end = LocalDateTime.of(2023, 12, 31, 23, 59);
        List<InvoiceHistogramProjection> rows = new ArrayList<>();

        for (int i = 1; i <= 200; i++) {
            rows.add(projection("INV-" + i, i, i * 10.0));
        }
        rows.add(projection("INV-201", 10000, 500000));

        when(rfmRepository.findInvoiceHistogramBase(start, end, null)).thenReturn(rows);

        HistogramResponse result = rfmService.getHistogramData(start, end, null);

        assertEquals(201, result.basketSize().summary().invoiceCount());
        assertEquals(201, result.orderValue().summary().invoiceCount());

        assertOnlyLastBinIsOutlier(result.basketSize().bins());
        assertOnlyLastBinIsOutlier(result.orderValue().bins());

        HistogramBin basketOutlierBin =
            result.basketSize().bins().get(result.basketSize().bins().size() - 1);
        HistogramBin orderValueOutlierBin =
            result.orderValue().bins().get(result.orderValue().bins().size() - 1);

        assertEquals(2, basketOutlierBin.count());
        assertEquals(2, orderValueOutlierBin.count());
    }

    private void assertOnlyLastBinIsOutlier(List<HistogramBin> bins) {
        assertFalse(bins.isEmpty());

        for (int i = 0; i < bins.size() - 1; i++) {
            assertFalse(bins.get(i).isOutlier());
        }

        assertTrue(bins.get(bins.size() - 1).isOutlier());
    }

    private InvoiceHistogramProjection projection(String invoice, Number basketSize, Number orderValue) {
        return new InvoiceHistogramProjection() {
            @Override
            public String getInvoice() {
                return invoice;
            }

            @Override
            public Number getBasketSize() {
                return basketSize;
            }

            @Override
            public Number getOrderValue() {
                return orderValue;
            }
        };
    }
}
