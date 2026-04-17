package com.example.cis4900.spring.template.rfm.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "rfm_metrics")
public class RfmMetric {

    @Id
    private String customerId;
    private Double recency;
    private Integer frequency;
    private Double monetary;
    private String country;
    private Double bubbleSize;

    public RfmMetric() {}

    public String getCustomerId() { 
        return customerId; 
    }

    public void setCustomerId(String customerId) { 
        this.customerId = customerId; 
    }

    public Double getRecency() { 
        return recency; 
    }

    public void setRecency(Double recency) { 
        this.recency = recency; 
    }

    public Integer getFrequency() { 
        return frequency; 
    }

    public void setFrequency(Integer frequency) { 
        this.frequency = frequency; 
    }

    public Double getMonetary() { 
        return monetary; 
    }

    public void setMonetary(Double monetary) { 
        this.monetary = monetary; 
    }

    public String getCountry() { 
        return country; 
    }

    public void setCountry(String country) { 
        this.country = country; 
    }

    public Double getBubbleSize() { 
        return bubbleSize; 
    }

    public void setBubbleSize(Double bubbleSize) { 
        this.bubbleSize = bubbleSize; 
    }
}
