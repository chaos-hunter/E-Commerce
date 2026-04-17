package com.example.cis4900.spring.template.cleaning.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;

import com.example.cis4900.spring.template.cleaning.dto.CleanedRetailDataItem;
import com.example.cis4900.spring.template.cleaning.dto.DirtyRetailDataItem;
import com.example.cis4900.spring.template.cleaning.dto.ManualReviewItem;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Unit tests for pagination metadata and row mapping in query service methods.
 */
class OnlineRetailCleaningQueryServiceTest {

    @Test
    void getCleanedDataPage_returnsExpectedMetadataAndEntries() {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        OnlineRetailCleaningQueryService service = new OnlineRetailCleaningQueryService(
            jdbcTemplate
        );

        Mockito
            .when(
                jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM cleaned_online_retail_data",
                    Long.class
                )
            )
            .thenReturn(31L);

        List<CleanedRetailDataItem> rows = List.of(
            new CleanedRetailDataItem(
                5,
                100,
                "INV-5",
                "STK-1",
                "desc",
                2,
                LocalDateTime.of(2020, 1, 1, 10, 0),
                new BigDecimal("1.99"),
                12,
                "CA",
                false,
                Instant.parse("2026-03-07T00:00:00Z"),
                Instant.parse("2026-03-07T00:00:00Z")
            )
        );

        Mockito
            .when(
                jdbcTemplate.<CleanedRetailDataItem>query(
                    anyString(),
                    any(org.springframework.jdbc.core.RowMapper.class),
                    eq(15),
                    eq(15)
                )
            )
            .thenReturn(rows);

        var page = service.getCleanedDataPage(1, 15);

        // 31 rows with size 15 -> 3 pages, middle page should have prev/next.
        assertEquals(1, page.page());
        assertEquals(15, page.size());
        assertEquals(31L, page.totalEntries());
        assertEquals(3, page.totalPages());
        assertTrue(page.hasPrevious());
        assertTrue(page.hasNext());
        assertEquals(1, page.entries().size());
        assertEquals("INV-5", page.entries().get(0).invoice());
    }

    @Test
    void getManualReviewPage_returnsNoNextPage_whenAtEnd() {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        OnlineRetailCleaningQueryService service = new OnlineRetailCleaningQueryService(
            jdbcTemplate
        );

        Mockito
            .when(
                jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM online_retail_manual_review",
                    Long.class
                )
            )
            .thenReturn(20L);

        List<ManualReviewItem> rows = List.of(
            new ManualReviewItem(
                9,
                90,
                "AUTO_CLEANED",
                "trimmed fields",
                null,
                "{}",
                "{}",
                Instant.parse("2026-03-07T00:00:00Z"),
                Instant.parse("2026-03-07T00:00:00Z")
            )
        );

        Mockito
            .when(
                jdbcTemplate.<ManualReviewItem>query(
                    anyString(),
                    any(org.springframework.jdbc.core.RowMapper.class),
                    eq(25),
                    eq(0)
                )
            )
            .thenReturn(rows);

        var page = service.getManualReviewPage(0, 25, null);

        // 20 rows with size 25 -> single-page result with no neighbors.
        assertEquals(0, page.page());
        assertEquals(25, page.size());
        assertEquals(20L, page.totalEntries());
        assertEquals(1, page.totalPages());
        assertFalse(page.hasPrevious());
        assertFalse(page.hasNext());
        assertEquals("AUTO_CLEANED", page.entries().get(0).reviewStatus());
    }

    @Test
    void getManualReviewPage_filtersByStatus_whenProvided() {
        // Ensures SQL filter path is used and metadata reflects filtered count.
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        OnlineRetailCleaningQueryService service = new OnlineRetailCleaningQueryService(
            jdbcTemplate
        );

        Mockito
            .when(
                jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM online_retail_manual_review WHERE review_status = ?",
                    Long.class,
                    "REJECTED"
                )
            )
            .thenReturn(2L);

        List<ManualReviewItem> rows = List.of(
            new ManualReviewItem(
                12,
                200,
                "REJECTED",
                "Invalid quantity",
                "Quantity must be > 0",
                "{}",
                null,
                Instant.parse("2026-03-07T00:00:00Z"),
                Instant.parse("2026-03-07T00:00:00Z")
            )
        );

        Mockito
            .when(
                jdbcTemplate.<ManualReviewItem>query(
                    anyString(),
                    any(org.springframework.jdbc.core.RowMapper.class),
                    eq("REJECTED"),
                    eq(25),
                    eq(0)
                )
            )
            .thenReturn(rows);

        var page = service.getManualReviewPage(0, 25, "REJECTED");

        assertEquals(2L, page.totalEntries());
        assertEquals("REJECTED", page.entries().get(0).reviewStatus());
    }

    @Test
    void getDirtyDataPage_returnsExpectedMetadataAndEntries() {
        // Verifies new dirty-data paging endpoint uses expected count/query mapping.
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        OnlineRetailCleaningQueryService service = new OnlineRetailCleaningQueryService(
            jdbcTemplate
        );

        Mockito
            .when(
                jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM dirty_data",
                    Long.class
                )
            )
            .thenReturn(541910L);

        List<DirtyRetailDataItem> rows = List.of(
            new DirtyRetailDataItem(
                1,
                "INV-1",
                "STK-1",
                "Desc",
                "2",
                "2011-01-01 10:00",
                "9.99",
                "12345",
                "UK"
            )
        );

        Mockito
            .when(
                jdbcTemplate.<DirtyRetailDataItem>query(
                    anyString(),
                    any(org.springframework.jdbc.core.RowMapper.class),
                    eq(15),
                    eq(0)
                )
            )
            .thenReturn(rows);

        var page = service.getDirtyDataPage(0, 15);

        assertEquals(0, page.page());
        assertEquals(15, page.size());
        assertEquals(541910L, page.totalEntries());
        assertEquals("INV-1", page.entries().get(0).invoice());
    }
}
