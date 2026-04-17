package com.example.cis4900.spring.template.rfm.controller;

import com.example.cis4900.spring.template.rfm.model.HistogramResponse;
import com.example.cis4900.spring.template.rfm.model.RfmMetric;
import com.example.cis4900.spring.template.rfm.service.RfmService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/rfm")
@CrossOrigin(origins = "*")
public class RfmController {

    private final RfmService rfmService;

    public RfmController(RfmService rfmService) {
        this.rfmService = rfmService;
    }

    /**
     * Returns the scatter-view representation for the RFM resource collection.
     *
     * <p>REST note:
     * - We keep a single resource path (/api/rfm) and select the representation
     *   via a query discriminator (view=scatter) instead of a presentation path.
     */
    @GetMapping(params = "view=scatter")
    public List<RfmMetric> getScatterPlotData(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(required = false) String country) {
        
        return rfmService.getRfmData(startDate, endDate, country);
    }

    /**
     * Returns the histogram-view representation for the RFM resource collection.
     *
     * <p>REST note:
     * - We keep a single resource path (/api/rfm) and select the representation
     *   via a query discriminator (view=histogram) instead of /histograms.
     */
    @GetMapping(params = "view=histogram")
    public HistogramResponse getHistogramData(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate,
            @RequestParam(required = false) String country) {

        return rfmService.getHistogramData(startDate, endDate, country);
    }
}
