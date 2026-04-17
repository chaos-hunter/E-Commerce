package com.example.cis4900.spring.template.cleaning.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

class OnlineRetailCleaningExportServiceTest {

    @Test
    void hasExportRows_returnsTrueWhenAtLeastOneRowExists() {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        OnlineRetailCleaningExportService service = new OnlineRetailCleaningExportService(
            jdbcTemplate
        );

        // Simulate the quick existence check returning one row
        Mockito.when(jdbcTemplate.queryForList(Mockito.contains("SELECT 1")))
            .thenReturn(List.of(Map.of("present", 1)));

        assertTrue(service.hasExportRows());
        Mockito.verify(jdbcTemplate).queryForList(
            Mockito.contains("FROM cleaned_online_retail_data")
        );
    }

    @Test
    void writeWorkbook_writesExpectedSheetHeadersAndRowValuesAcrossBatches() throws Exception {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        final OnlineRetailCleaningExportService service = new OnlineRetailCleaningExportService(
            jdbcTemplate
        );

        // Return two data batches then stop
        Mockito.when(
            jdbcTemplate.queryForList(
                Mockito.contains("WHERE raw_data_id > ?"),
                Mockito.eq(0L),
                Mockito.eq(1000)
            )
        ).thenReturn(List.of(exportBatchRow(
            1L,
            "536365",
            "85123A",
            "WHITE HANGING HEART T LIGHT HOLDER",
            6,
            LocalDateTime.of(2010, 12, 1, 8, 26),
            new BigDecimal("2.55"),
            17850,
            "United Kingdom"
        )));

        Mockito.when(
            jdbcTemplate.queryForList(
                Mockito.contains("WHERE raw_data_id > ?"),
                Mockito.eq(1L),
                Mockito.eq(1000)
            )
        ).thenReturn(List.of(exportBatchRow(
            2L,
            "536366",
            "22633",
            "HAND WARMER",
            8,
            LocalDateTime.of(2010, 12, 1, 8, 28),
            new BigDecimal("1.85"),
            13047,
            "France"
        )));

        Mockito.when(
            jdbcTemplate.queryForList(
                Mockito.contains("WHERE raw_data_id > ?"),
                Mockito.eq(2L),
                Mockito.eq(1000)
            )
        ).thenReturn(List.of());

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        service.writeWorkbook(outputStream);
        byte[] workbookBytes = outputStream.toByteArray();

        // Read the generated workbook back to verify sheet content
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(workbookBytes))) {
            assertEquals(1, workbook.getNumberOfSheets());

            var sheet = workbook.getSheet("2010 cleaned");
            assertNotNull(sheet);

            var headerRow = sheet.getRow(0);
            assertEquals("Invoice", headerRow.getCell(0).getStringCellValue());
            assertEquals("StockCode", headerRow.getCell(1).getStringCellValue());
            assertEquals("Description", headerRow.getCell(2).getStringCellValue());
            assertEquals("Quantity", headerRow.getCell(3).getStringCellValue());
            assertEquals("InvoiceDate", headerRow.getCell(4).getStringCellValue());
            assertEquals("UnitPrice", headerRow.getCell(5).getStringCellValue());
            assertEquals("CustomerID", headerRow.getCell(6).getStringCellValue());
            assertEquals("Country", headerRow.getCell(7).getStringCellValue());

            var dataRow = sheet.getRow(1);
            assertEquals("536365", dataRow.getCell(0).getStringCellValue());
            assertEquals("85123A", dataRow.getCell(1).getStringCellValue());
            assertEquals(
                "WHITE HANGING HEART T LIGHT HOLDER",
                dataRow.getCell(2).getStringCellValue()
            );
            assertEquals(6.0, dataRow.getCell(3).getNumericCellValue(), 0.001);
            assertEquals("2010-12-01 08:26:00", dataRow.getCell(4).getStringCellValue());
            assertEquals(2.55, dataRow.getCell(5).getNumericCellValue(), 0.001);
            assertEquals(17850.0, dataRow.getCell(6).getNumericCellValue(), 0.001);
            assertEquals("United Kingdom", dataRow.getCell(7).getStringCellValue());

            var secondDataRow = sheet.getRow(2);
            assertEquals("536366", secondDataRow.getCell(0).getStringCellValue());
            assertEquals("France", secondDataRow.getCell(7).getStringCellValue());
        }
    }

    @Test
    void writeWorkbook_writesBlankCellsForNullableValues() throws Exception {
        JdbcTemplate jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        OnlineRetailCleaningExportService service = new OnlineRetailCleaningExportService(
            jdbcTemplate
        );

        // Return one batch with nullable fields
        Mockito.when(
            jdbcTemplate.queryForList(
                Mockito.contains("WHERE raw_data_id > ?"),
                Mockito.eq(0L),
                Mockito.eq(1000)
            )
        ).thenReturn(List.of(exportBatchRow(
            1L,
            "536366",
            "22633",
            null,
            6,
            LocalDateTime.of(2010, 12, 1, 8, 28),
            new BigDecimal("1.85"),
            null,
            null
        )));

        Mockito.when(
            jdbcTemplate.queryForList(
                Mockito.contains("WHERE raw_data_id > ?"),
                Mockito.eq(1L),
                Mockito.eq(1000)
            )
        ).thenReturn(List.of());

        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        service.writeWorkbook(outputStream);
        byte[] workbookBytes = outputStream.toByteArray();

        // Blank export cells should stay blank after workbook generation
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(workbookBytes))) {
            var sheet = workbook.getSheet("2010 cleaned");
            assertNotNull(sheet);

            var dataRow = sheet.getRow(1);
            assertEquals("", dataRow.getCell(2).getStringCellValue());
            assertEquals("", dataRow.getCell(6).getStringCellValue());
            assertEquals("", dataRow.getCell(7).getStringCellValue());
        }
    }

    private static Map<String, Object> exportBatchRow(
        long rawDataId,
        String invoice,
        String stockCode,
        String description,
        int quantity,
        LocalDateTime invoiceDate,
        BigDecimal price,
        Integer customerId,
        String country
    ) {
        // Match the shape returned by JdbcTemplate queryForList
        Map<String, Object> rowValues = new LinkedHashMap<>();
        rowValues.put("raw_data_id", rawDataId);
        rowValues.put("Invoice", invoice);
        rowValues.put("StockCode", stockCode);
        rowValues.put("Description", description);
        rowValues.put("Quantity", quantity);
        rowValues.put("InvoiceDate", Timestamp.valueOf(invoiceDate));
        rowValues.put("Price", price);
        rowValues.put("CustomerID", customerId);
        rowValues.put("Country", country);
        return rowValues;
    }
}
