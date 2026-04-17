package com.example.cis4900.spring.template.rfm.service;

import com.example.cis4900.spring.template.rfm.model.HistogramBin;
import com.example.cis4900.spring.template.rfm.model.HistogramMetric;
import com.example.cis4900.spring.template.rfm.model.HistogramResponse;
import com.example.cis4900.spring.template.rfm.model.HistogramSummary;
import com.example.cis4900.spring.template.rfm.model.RfmMetric;
import com.example.cis4900.spring.template.rfm.repository.InvoiceHistogramProjection;
import com.example.cis4900.spring.template.rfm.repository.RfmRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class RfmService {
    private static final double HISTOGRAM_CAP_PERCENTILE = 0.995;
    private static final double BASKET_SIZE_BIN_WIDTH = 50.0;
    private static final double ORDER_VALUE_BIN_WIDTH = 100.0;
    private static final int TARGET_NORMAL_BIN_COUNT = 8;

    private final RfmRepository rfmRepository;

    public RfmService(RfmRepository rfmRepository) {
        this.rfmRepository = rfmRepository;
    }

    public List<RfmMetric> getRfmData(LocalDateTime start, LocalDateTime end, String country) {
        return rfmRepository.findRfmStats(start, end, normalizeCountry(country));
    }

    public HistogramResponse getHistogramData(LocalDateTime start, LocalDateTime end, String country) {
        String normalizedCountry = normalizeCountry(country);

        List<InvoiceHistogramProjection> rows = rfmRepository.findInvoiceHistogramBase(
            start,
            end,
            normalizedCountry
        );

        List<Double> basketSizes = rows.stream()
            .map(InvoiceHistogramProjection::getBasketSize)
            .filter(Objects::nonNull)
            .map(Number::doubleValue)
            .toList();

        List<Double> orderValues = rows.stream()
            .map(InvoiceHistogramProjection::getOrderValue)
            .filter(Objects::nonNull)
            .map(Number::doubleValue)
            .toList();

        return new HistogramResponse(
            buildMetric(basketSizes, BASKET_SIZE_BIN_WIDTH),
            buildMetric(orderValues, ORDER_VALUE_BIN_WIDTH)
        );
    }

    private String normalizeCountry(String country) {
        if (country == null || country.isBlank()) {
            return null;
        }
        return country.trim();
    }

    private HistogramMetric buildMetric(List<Double> values, double binWidth) {
        if (values.isEmpty()) {
            return new HistogramMetric(
                new HistogramSummary(0, null, null, null),
                List.of()
            );
        }

        List<Double> sorted = values.stream()
            .sorted()
            .toList();

        double average = sorted.stream()
            .mapToDouble(Double::doubleValue)
            .average()
            .orElse(0.0);

        double median = calculateMedian(sorted);
        double p90 = calculatePercentileNearestRank(sorted, 0.90);

        return new HistogramMetric(
            new HistogramSummary(
                sorted.size(),
                round(average),
                round(median),
                round(p90)
            ),
            buildBins(sorted, binWidth)
        );
    }

    private double calculateMedian(List<Double> sorted) {
        int n = sorted.size();
        int mid = n / 2;

        if (n % 2 == 1) {
            return sorted.get(mid);
        }

        return (sorted.get(mid - 1) + sorted.get(mid)) / 2.0;
    }

    private double calculatePercentileNearestRank(List<Double> sorted, double percentile) {
        int index = (int) Math.ceil(percentile * sorted.size()) - 1;
        index = Math.max(0, Math.min(index, sorted.size() - 1));
        return sorted.get(index);
    }

    private List<HistogramBin> buildBins(List<Double> sorted, double binWidth) {
        if (sorted.isEmpty()) {
            return List.of();
        }

        double min = sorted.get(0);
        double max = sorted.get(sorted.size() - 1);
        double cappedMax = calculatePercentileNearestRank(sorted, HISTOGRAM_CAP_PERCENTILE);
        double effectiveBinWidth = chooseBinWidth(min, cappedMax, binWidth);
        double normalStart = roundDownToStep(min, effectiveBinWidth);
        double normalEnd = roundUpToStep(cappedMax, effectiveBinWidth);

        if (normalEnd <= normalStart) {
            normalEnd = normalStart + effectiveBinWidth;
        }

        boolean hasOverflow = max > normalEnd;
        int normalBinCount = (int) Math.max(1, Math.ceil((normalEnd - normalStart) / effectiveBinWidth));
        long[] counts = new long[normalBinCount + (hasOverflow ? 1 : 0)];

        for (double value : sorted) {
            if (hasOverflow && value >= normalEnd) {
                counts[counts.length - 1]++;
                continue;
            }

            int index = (int) ((value - normalStart) / effectiveBinWidth);
            if (index >= normalBinCount) {
                index = normalBinCount - 1;
            }
            counts[index]++;
        }

        List<HistogramBin> bins = new ArrayList<>();

        for (int i = 0; i < normalBinCount; i++) {
            double start = normalStart + (i * effectiveBinWidth);
            double end = start + effectiveBinWidth;

            bins.add(new HistogramBin(
                round(start),
                round(end),
                counts[i],
                false
            ));
        }

        if (hasOverflow) {
            bins.add(new HistogramBin(
                round(normalEnd),
                round(max),
                counts[counts.length - 1],
                true
            ));
        }

        return bins;
    }

    private double chooseBinWidth(double min, double cappedMax, double preferredMaxBinWidth) {
        double range = Math.max(cappedMax - min, preferredMaxBinWidth / TARGET_NORMAL_BIN_COUNT);
        double suggestedWidth = nextNiceStep(range / TARGET_NORMAL_BIN_COUNT);
        return Math.min(preferredMaxBinWidth, suggestedWidth);
    }

    private double nextNiceStep(double value) {
        double exponent = Math.pow(10, Math.floor(Math.log10(value)));
        double fraction = value / exponent;
        double niceFraction;

        if (fraction <= 1) {
            niceFraction = 1;
        } else if (fraction <= 2) {
            niceFraction = 2;
        } else if (fraction <= 5) {
            niceFraction = 5;
        } else {
            niceFraction = 10;
        }

        return niceFraction * exponent;
    }

    private double roundDownToStep(double value, double step) {
        return Math.floor(value / step) * step;
    }

    private double roundUpToStep(double value, double step) {
        return Math.ceil(value / step) * step;
    }

    private double round(double value) {
        return BigDecimal.valueOf(value)
            .setScale(2, RoundingMode.HALF_UP)
            .doubleValue();
    }

}
