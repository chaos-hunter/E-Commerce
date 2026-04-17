package com.example.cis4900.spring.template.revenueshare.controller;

import com.example.cis4900.spring.template.revenueshare.model.CountryRevenueShareItem;
import com.example.cis4900.spring.template.revenueshare.model.RevenueShareResponse;
import com.example.cis4900.spring.template.revenueshare.service.RevenueShareService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RevenueShareController.class)
class RevenueShareControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RevenueShareService revenueShareService;

    @Test
    void testGetCountryRevenueShares_ReturnsOkAndJsonBody() throws Exception {
        RevenueShareResponse response = new RevenueShareResponse(
            new BigDecimal("125430.56"),
            List.of(
                new CountryRevenueShareItem("United Kingdom", new BigDecimal("98234.11"), new BigDecimal("78.3100")),
                new CountryRevenueShareItem("Netherlands", new BigDecimal("11234.09"), new BigDecimal("8.9600"))
            )
        );

        when(revenueShareService.getCountryRevenueShares(any(), any())).thenReturn(response);

        mockMvc.perform(get("/api/rfm")
                .param("view", "pie")
                .param("startDate", "2020-01-01T00:00:00")
                .param("endDate", "2021-01-01T00:00:00"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalRevenue").value(125430.56))
            .andExpect(jsonPath("$.slices[0].country").value("United Kingdom"))
            .andExpect(jsonPath("$.slices[0].revenue").value(98234.11))
            .andExpect(jsonPath("$.slices[0].percentage").value(78.31))
            .andExpect(jsonPath("$.slices[1].country").value("Netherlands"));
    }

    @Test
    void testGetCountryRevenueShares_MissingParams_ReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/rfm")
                .param("view", "pie")
                .param("endDate", "2021-01-01T00:00:00"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void testGetCountryRevenueShares_InvalidDate_ReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/rfm")
                .param("view", "pie")
                .param("startDate", "not-a-date")
                .param("endDate", "2021-01-01T00:00:00"))
            .andExpect(status().isBadRequest());
    }
}
