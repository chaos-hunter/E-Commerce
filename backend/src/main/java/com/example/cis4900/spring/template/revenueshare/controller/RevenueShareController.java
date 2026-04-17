package com.example.cis4900.spring.template.revenueshare.controller;

import com.example.cis4900.spring.template.revenueshare.model.RevenueShareResponse;
import com.example.cis4900.spring.template.revenueshare.service.RevenueShareService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/rfm")
@CrossOrigin(origins = "*")
public class RevenueShareController {

    private final RevenueShareService revenueShareService;

    public RevenueShareController(RevenueShareService revenueShareService) {
        this.revenueShareService = revenueShareService;
    }

    // handles the pie view for the shared rfm route
    @GetMapping(params = "view=pie")
    public RevenueShareResponse getCountryRevenueShares(
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime startDate,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            LocalDateTime endDate) {

        // forwards the requested date range to the service
        return revenueShareService.getCountryRevenueShares(startDate, endDate);
    }
}
