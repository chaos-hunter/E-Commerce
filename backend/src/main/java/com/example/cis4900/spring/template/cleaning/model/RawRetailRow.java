package com.example.cis4900.spring.template.cleaning.model;

import java.util.LinkedHashMap;
import java.util.Map;

public record RawRetailRow(
    int id,
    String invoice,
    String stockCode,
    String description,
    String quantity,
    String invoiceDate,
    String price,
    String customerId,
    String country
) {

    public Map<String, Object> asMap() {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("id", id);
        values.put("Invoice", invoice);
        values.put("StockCode", stockCode);
        values.put("Description", description);
        values.put("Quantity", quantity);
        values.put("InvoiceDate", invoiceDate);
        values.put("Price", price);
        values.put("CustomerID", customerId);
        values.put("Country", country);
        return values;
    }
}
