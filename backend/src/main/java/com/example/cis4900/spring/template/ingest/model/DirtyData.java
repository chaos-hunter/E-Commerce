package com.example.cis4900.spring.template.ingest.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;

@Entity //class is an entity that will be mapped to a database table called dirty_data
@Table(name = "dirty_data") //specifies the name of the table in the database
public class DirtyData {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) //auto incrementing id
    private Long id;
    
    private String invoice;
    private String stockCode;
    private String description;
    private String quantity;
    private String invoiceDate;
    private String price;
    private String customerID;
    private String country;

    //getters and setters for all fields

    //constructor
    public DirtyData() {
    }
    
    //Overloaded constructor to create a new DirtyData object with all fields except id (which is auto generated)
    public DirtyData(String invoice, String stockCode, String description, String quantity, String invoiceDate, String price, String customerID, String country) {
        this.invoice = invoice;
        this.stockCode = stockCode;
        this.description = description;
        this.quantity = quantity;
        this.invoiceDate = invoiceDate;
        this.price = price;
        this.customerID = customerID;
        this.country = country;
    }

    // getter for ID
    public Long getId() {
        return id;
    }

    //getter for invoice
    public String getInvoice() {
        return invoice;
    }

    //setter for invoice
    public void setInvoice(String invoice) {
        this.invoice = invoice;
    }

    //getter for stock code
    public String getStockCode() {
        return stockCode;
    }

    //setter for stock code
    public void setStockCode(String stockCode) {
        this.stockCode = stockCode;
    }

    //getter for description
    public String getDescription() {
        return description;
    }

    //setter for description
    public void setDescription(String description) {
        this.description = description;
    }

    //getter for quantity
    public String getQuantity() {
        return quantity;
    }

    //setter for quantity
    public void setQuantity(String quantity) {
        this.quantity = quantity;
    }

    //getter for invoice date
    public String getInvoiceDate() {
        return invoiceDate;
    }

    //setter for invoice date
    public void setInvoiceDate(String invoiceDate) {
        this.invoiceDate = invoiceDate;
    }
    
    //getter for price
    public String getPrice() {
        return price;
    }

    //setter for price
    public void setPrice(String price) {
        this.price = price;
    }

    //getter for customer ID
    public String getCustomerID() {
        return customerID;
    }

    //setter for customer ID
    public void setCustomerID(String customerID) {
        this.customerID = customerID;
    }
    
    //getter for country
    public String getCountry() {
        return country;
    }

    //setter for country
    public void setCountry(String country) {
        this.country = country;
    }

}
