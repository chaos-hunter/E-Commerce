package com.example.cis4900.spring.template.rfm.controller;

import com.example.cis4900.spring.template.rfm.model.HistogramBin;
import com.example.cis4900.spring.template.rfm.model.HistogramMetric;
import com.example.cis4900.spring.template.rfm.model.HistogramResponse;
import com.example.cis4900.spring.template.rfm.model.HistogramSummary;
import com.example.cis4900.spring.template.rfm.service.RfmService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RfmController.class)
class RfmControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RfmService rfmService;

    @Test
    void testGetScatterPlotData_ReturnsOk() throws Exception {
        when(rfmService.getRfmData(any(), any(), nullable(String.class))).thenReturn(List.of());

        mockMvc.perform(get("/api/rfm")
            .param("view", "scatter")
                .param("startDate", "2020-01-01T00:00:00")
                .param("endDate", "2021-01-01T00:00:00")
                .param("country", "United Kingdom"))
                .andExpect(status().isOk());
    }

    @Test
    void testGetScatterPlotData_WithoutCountryPassesNull() throws Exception {
        when(rfmService.getRfmData(any(), any(), isNull())).thenReturn(List.of());

        mockMvc.perform(get("/api/rfm")
            .param("view", "scatter")
                .param("startDate", "2020-01-01T00:00:00")
                .param("endDate", "2021-01-01T00:00:00"))
                .andExpect(status().isOk());

        verify(rfmService).getRfmData(any(), any(), isNull());
    }

    @Test
    void testGetScatterPlotData_MissingParams_ReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/rfm")
            .param("view", "scatter")
                .param("endDate", "2021-01-01T00:00:00"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testGetHistogramData_ReturnsOkAndJsonBody() throws Exception {
        HistogramResponse response = new HistogramResponse(
            new HistogramMetric(
                new HistogramSummary(2, 120.0, 100.0, 220.0),
                List.of(
                    new HistogramBin(0.0, 50.0, 1, false),
                    new HistogramBin(50.0, 1000.0, 1, true)
                )
            ),
            new HistogramMetric(
                new HistogramSummary(2, 300.0, 250.0, 500.0),
                List.of(
                    new HistogramBin(0.0, 100.0, 1, false),
                    new HistogramBin(100.0, 10000.0, 1, true)
                )
            )
        );

        when(rfmService.getHistogramData(any(), any(), nullable(String.class))).thenReturn(response);

        mockMvc.perform(get("/api/rfm")
            .param("view", "histogram")
                .param("startDate", "2020-01-01T00:00:00")
                .param("endDate", "2021-01-01T00:00:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.basketSize.summary.invoiceCount").value(2))
                .andExpect(jsonPath("$.basketSize.summary.average").value(120.0))
                .andExpect(jsonPath("$.basketSize.bins[1].isOutlier").value(true))
                .andExpect(jsonPath("$.orderValue.bins[0].isOutlier").value(false));

        verify(rfmService).getHistogramData(any(), any(), isNull());
    }

    @Test
    void testGetHistogramData_MissingParams_ReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/rfm")
            .param("view", "histogram")
                .param("endDate", "2021-01-01T00:00:00"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testGetHistogramData_InvalidDate_ReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/rfm")
            .param("view", "histogram")
                .param("startDate", "not-a-date")
                .param("endDate", "2021-01-01T00:00:00"))
                .andExpect(status().isBadRequest());
    }
}
