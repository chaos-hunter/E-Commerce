package com.example.cis4900.spring.template.cleaning.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import com.example.cis4900.spring.template.cleaning.model.RawRetailRow;
import com.example.cis4900.spring.template.cleaning.model.CleaningDecision;
import com.example.cis4900.spring.template.cleaning.model.CleaningReviewStatus;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link OnlineRetailRowCleaner} that exercise common
 *
 * <p>normalization, validation and return-detection rules.
 */
class OnlineRetailRowCleanerTest {

    private final OnlineRetailRowCleaner cleaner = new OnlineRetailRowCleaner();

    @Test
    void shouldRejectRowWhenCriticalFieldsInvalid() {
        RawRetailRow row = new RawRetailRow(
            1,
            "",
            "ABC",
            "Widget",
            "abc",
            "not-a-date",
            "-1.00",
            "12345",
            "UK"
        );

        // Run cleaning and verify rejection on critical invalid fields
        CleaningDecision decision = cleaner.cleanRow(row);

        assertEquals(CleaningReviewStatus.REJECTED, decision.reviewStatus());
        assertFalse(decision.validationErrors().isEmpty());
        assertNull(decision.cleanedRecord());
        assertFalse(decision.shouldInsertCleanedRecord());
        assertTrue(decision.shouldInsertReviewRecord());
    }

    @Test
    void shouldAutoCleanNormalizedValues() {
        RawRetailRow row = new RawRetailRow(
            2,
            "  536365  ",
            " 85123A ",
            " White Hanging Heart T-Light Holder ",
            " 6.0 ",
            "12/1/2010 8:26",
            "$2.55",
            " 17850 ",
            " United Kingdom "
        );

        // Expect auto-clean behavior: trimming, numeric normalization, currency parsing
        CleaningDecision decision = cleaner.cleanRow(row);

        assertEquals(CleaningReviewStatus.AUTO_CLEANED, decision.reviewStatus());
        assertTrue(decision.validationErrors().isEmpty());
        assertTrue(decision.shouldInsertCleanedRecord());
        assertTrue(decision.shouldInsertReviewRecord());
        assertEquals("536365", decision.cleanedRecord().invoice());
        assertEquals(6, decision.cleanedRecord().quantity());
        assertEquals(new BigDecimal("2.55"), decision.cleanedRecord().price());
        assertEquals(17850, decision.cleanedRecord().customerId());
    }

    @Test
    void shouldFlagReturnWhenQuantityIsNegative() {
        RawRetailRow row = new RawRetailRow(
            3,
            "C536379",
            "D",
            "Discount",
            "-1",
            "2010-12-01 09:41:00",
            "27.50",
            "14527",
            "United Kingdom"
        );

        // Negative quantity should be detected as a return and recorded in reasons
        CleaningDecision decision = cleaner.cleanRow(row);

        assertTrue(decision.shouldInsertCleanedRecord());
        assertEquals(CleaningReviewStatus.AUTO_CLEANED, decision.reviewStatus());
        assertTrue(decision.cleanedRecord().isReturn());
        assertTrue(
            decision.reviewReasons().stream().anyMatch(reason -> reason.contains("return transaction"))
        );
    }
}
