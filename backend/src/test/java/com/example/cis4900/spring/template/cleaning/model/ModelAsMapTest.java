package com.example.cis4900.spring.template.cleaning.model;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Tests for the `asMap()` helpers on model classes.
 *
 * <p>These small tests provide quick validation that the map representation
 * used for diagnostics and persistence contains expected keys.
 */
class ModelAsMapTest {

    @Test
    void rawRetailRow_asMap_containsExpectedKeys() {
        RawRetailRow raw = new RawRetailRow(1, "INV", "SC", "Desc", "1", "d", "1.00", "123", "UK");
        Map<String, Object> map = raw.asMap();
        // Verify minimal keys are present and correctly mapped
        assertEquals(1, map.get("id"));
        assertEquals("INV", map.get("Invoice"));
    }

    @Test
    void cleanedRetailRecord_asMap_containsExpectedKeys() {
        CleanedRetailRecord cr = new CleanedRetailRecord(1, "INV", "SC", "D", 2, LocalDateTime.now(), new BigDecimal("1.00"), 123, "UK", false);
        Map<String, Object> map = cr.asMap();
        assertEquals(1, map.get("rawDataId"));
        assertEquals("INV", map.get("Invoice"));
    }
}
