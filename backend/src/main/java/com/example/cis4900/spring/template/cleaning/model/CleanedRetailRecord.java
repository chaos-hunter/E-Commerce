package com.example.cis4900.spring.template.cleaning.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

public record CleanedRetailRecord(
    int rawDataId,
    String invoice,
    String stockCode,
    String description,
    int quantity,
    LocalDateTime invoiceDate,
    BigDecimal price,
    Integer customerId,
    String country,
    boolean isReturn
) {

    public Map<String, Object> asMap() {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("rawDataId", rawDataId);
        values.put("Invoice", invoice);
        values.put("StockCode", stockCode);
        values.put("Description", description);
        values.put("Quantity", quantity);
        values.put("InvoiceDate", invoiceDate);
        values.put("Price", price);
        values.put("CustomerID", customerId);
        values.put("Country", country);
        values.put("isReturn", isReturn);
        return values;
    }
}
