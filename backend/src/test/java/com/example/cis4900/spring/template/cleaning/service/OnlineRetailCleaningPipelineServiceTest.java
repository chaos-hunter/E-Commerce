package com.example.cis4900.spring.template.cleaning.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.example.cis4900.spring.template.cleaning.model.CleanedRetailRecord;
import com.example.cis4900.spring.template.cleaning.model.CleaningDecision;
import com.example.cis4900.spring.template.cleaning.model.CleaningReviewStatus;
import com.example.cis4900.spring.template.cleaning.model.RawRetailRow;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Unit tests for {@link OnlineRetailCleaningPipelineService}.
 *
 * <p>These tests exercise the high-level pipeline behavior using a mocked
 * {@link OnlineRetailRowCleaner} and {@link org.springframework.jdbc.core.JdbcTemplate}.
 */
class OnlineRetailCleaningPipelineServiceTest {

    @Test
    void runCleaning_insertsCleanedRecord_whenRowCleanerReturnsCleaned() {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        OnlineRetailRowCleaner cleaner = Mockito.mock(OnlineRetailRowCleaner.class);
        ObjectMapper mapper = new ObjectMapper();

        RawRetailRow raw = new RawRetailRow(1, "INV", "SC", "D", "1", "2020-01-01 10:00", "1.00", "123", "UK");

        CleanedRetailRecord cleaned = new CleanedRetailRecord(
            1, "INV", "SC", "D", 1, LocalDateTime.of(2020,1,1,10,0), new BigDecimal("1.00"), 123, "UK", false
        );

        CleaningDecision decision = new CleaningDecision(cleaned, CleaningReviewStatus.NONE, List.of(), List.of());

        when(cleaner.cleanRow(any(RawRetailRow.class))).thenReturn(decision);
        when(jdbcTemplate.<RawRetailRow>query(anyString(), Mockito.<org.springframework.jdbc.core.RowMapper<RawRetailRow>>any(), anyInt(), anyInt()))
            .thenReturn(List.of(raw), List.of());

        OnlineRetailCleaningPipelineService svc = new OnlineRetailCleaningPipelineService(jdbcTemplate, cleaner, mapper);

        var result = svc.runCleaning(10);
        // verify summary counters reflect one cleaned insert
        assertEquals(1, result.rowsInsertedIntoCleaned());
        assertEquals(1, result.totalRowsProcessed());
    }

    @Test
    void runCleaning_recordsProcessingFailure_whenCleanerThrows() {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        OnlineRetailRowCleaner cleaner = Mockito.mock(OnlineRetailRowCleaner.class);
        ObjectMapper mapper = new ObjectMapper();

        RawRetailRow raw = new RawRetailRow(2, "INV2", "SC", "D", "bad", "not-a-date", "x", null, "UK");

        when(cleaner.cleanRow(any(RawRetailRow.class))).thenThrow(new RuntimeException("boom"));
        when(jdbcTemplate.<RawRetailRow>query(anyString(), Mockito.<org.springframework.jdbc.core.RowMapper<RawRetailRow>>any(), anyInt(), anyInt()))
            .thenReturn(List.of(raw), List.of());

        OnlineRetailCleaningPipelineService svc = new OnlineRetailCleaningPipelineService(jdbcTemplate, cleaner, mapper);

        var result = svc.runCleaning(5);
        // cleaner threw -> counted as flagged rejected (processing failure case)
        assertEquals(1, result.rowsFlaggedRejected());
        assertEquals(1, result.totalRowsProcessed());
    }
}
