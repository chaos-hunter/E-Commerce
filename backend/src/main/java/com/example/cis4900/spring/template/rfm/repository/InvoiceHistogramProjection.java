package com.example.cis4900.spring.template.rfm.repository;

public interface InvoiceHistogramProjection {
    String getInvoice();

    Number getBasketSize();

    Number getOrderValue();
}
