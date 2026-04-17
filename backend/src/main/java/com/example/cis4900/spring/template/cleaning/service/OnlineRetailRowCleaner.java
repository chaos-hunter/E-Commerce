package com.example.cis4900.spring.template.cleaning.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Component;
import com.example.cis4900.spring.template.cleaning.model.CleanedRetailRecord;
import com.example.cis4900.spring.template.cleaning.model.CleaningDecision;
import com.example.cis4900.spring.template.cleaning.model.CleaningReviewStatus;
import com.example.cis4900.spring.template.cleaning.model.RawRetailRow;

/**
 * Encapsulates the parsing, normalization and validation rules for a single raw row.
 */
@Component
public class OnlineRetailRowCleaner {

    private static final List<DateTimeFormatter> SUPPORTED_DATE_PATTERNS = List.of(
        DateTimeFormatter.ofPattern("M/d/yyyy H:mm", Locale.US),
        DateTimeFormatter.ofPattern("M/d/yyyy H:mm:ss", Locale.US),
        DateTimeFormatter.ofPattern("M/d/yy H:mm", Locale.US),
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm", Locale.US),
        DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss", Locale.US),
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", Locale.US),
        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss", Locale.US)
    );

    /**
     * Clean a single raw retail row.
     *
     * <p>Steps taken:
     * - Normalize and trim textual fields
     * - Parse numeric and date fields with tolerant normalization rules
     * - Accumulate review reasons (non-fatal adjustments) and validation errors (fatal)
     * - Produce a {@link CleaningDecision} containing either a cleaned record or rejection info
     */
    public CleaningDecision cleanRow(RawRetailRow rawRow) {
        // Collect information about automatic adjustments (reviewReasons)
        // and fatal problems (validationErrors) discovered while parsing.
        List<String> reviewReasons = new ArrayList<>();
        List<String> validationErrors = new ArrayList<>();

        String invoice = normalizeRequiredText(rawRow.invoice(), "Invoice", 20, reviewReasons, validationErrors);
        String stockCode = normalizeOptionalText(rawRow.stockCode(), "StockCode", 20, reviewReasons);
        String description = normalizeOptionalText(rawRow.description(), "Description", null, reviewReasons);
        Integer quantity = parseRequiredInteger(rawRow.quantity(), "Quantity", reviewReasons, validationErrors);
        LocalDateTime invoiceDate = parseInvoiceDate(rawRow.invoiceDate(), reviewReasons, validationErrors);
        BigDecimal price = parseRequiredPrice(rawRow.price(), reviewReasons, validationErrors);
        Integer customerId = parseOptionalInteger(rawRow.customerId(), "CustomerID", reviewReasons);
        String country = normalizeOptionalText(rawRow.country(), "Country", 100, reviewReasons);

        if (!validationErrors.isEmpty()) {
            return new CleaningDecision(
                null,
                CleaningReviewStatus.REJECTED,
                reviewReasons,
                validationErrors
            );
        }

        // Detect returns: negative quantity indicates a return transaction.
        boolean isReturn = quantity != null && quantity < 0;
        if (isReturn) {
            reviewReasons.add("Quantity is negative; marked as return transaction");
        }

        CleanedRetailRecord cleanedRecord = new CleanedRetailRecord(
            rawRow.id(),
            invoice,
            stockCode,
            description,
            quantity,
            invoiceDate,
            price,
            customerId,
            country,
            isReturn
        );

        CleaningReviewStatus reviewStatus = reviewReasons.isEmpty()
            ? CleaningReviewStatus.NONE
            : CleaningReviewStatus.AUTO_CLEANED;

        return new CleaningDecision(
            cleanedRecord,
            reviewStatus,
            reviewReasons,
            validationErrors
        );
    }

    private String normalizeRequiredText(
        String rawValue,
        String fieldName,
        Integer maxLength,
        List<String> reviewReasons,
        List<String> validationErrors
    ) {
        // Reuse optional normalizer then enforce presence.
        String normalized = normalizeOptionalText(rawValue, fieldName, maxLength, reviewReasons);
        if (normalized == null || normalized.isBlank()) {
            validationErrors.add(fieldName + " is missing");
        }
        return normalized;
    }

    private String normalizeOptionalText(
        String rawValue,
        String fieldName,
        Integer maxLength,
        List<String> reviewReasons
    ) {
        // Null means absent value -> keep as null to signal missing optional field.
        if (rawValue == null) {
            return null;
        }

        // Trim whitespace and record if trimming occurred (helpful for auditing).
        String trimmed = rawValue.trim();
        if (!rawValue.equals(trimmed)) {
            reviewReasons.add(fieldName + " had surrounding whitespace and was trimmed");
        }

        if (trimmed.isEmpty()) {
            return null;
        }

        // Truncate overly long values and record the truncation reason.
        if (maxLength != null && trimmed.length() > maxLength) {
            reviewReasons.add(fieldName + " exceeded max length and was truncated to " + maxLength + " chars");
            return trimmed.substring(0, maxLength);
        }

        return trimmed;
    }

    private Integer parseRequiredInteger(
        String rawValue,
        String fieldName,
        List<String> reviewReasons,
        List<String> validationErrors
    ) {
        // Delegate to optional parser then enforce presence and validity.
        Integer parsed = parseOptionalInteger(rawValue, fieldName, reviewReasons);
        if (parsed == null) {
            validationErrors.add(fieldName + " is missing or invalid");
        }
        return parsed;
    }

    private Integer parseOptionalInteger(String rawValue, String fieldName, List<String> reviewReasons) {
        // Empty or blank -> absent optional integer.
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }

        // Remove grouping commas and normalize trailing .0 (common from spreadsheets).
        String trimmed = rawValue.trim();
        String normalized = trimmed.replace(",", "");

        if (normalized.endsWith(".0")) {
            normalized = normalized.substring(0, normalized.length() - 2);
            reviewReasons.add(fieldName + " ended with .0 and was normalized");
        }

        if (!trimmed.equals(normalized)) {
            reviewReasons.add(fieldName + " formatting was normalized before parsing");
        }

        try {
            return Integer.valueOf(normalized);
        } catch (NumberFormatException ignored) {
            // Non-numeric -> treat as missing but record a review reason.
            reviewReasons.add(fieldName + " could not be parsed and was set to null");
            return null;
        }
    }

    private BigDecimal parseRequiredPrice(
        String rawValue,
        List<String> reviewReasons,
        List<String> validationErrors
    ) {
        // Missing price is a validation error.
        if (rawValue == null || rawValue.isBlank()) {
            validationErrors.add("Price is missing");
            return null;
        }

        // Strip common currency symbols and grouping separators.
        String trimmed = rawValue.trim();
        String normalized = trimmed.replace(",", "").replace("$", "").replace("£", "");
        if (!trimmed.equals(normalized)) {
            reviewReasons.add("Price formatting was normalized before parsing");
        }

        try {
            BigDecimal price = new BigDecimal(normalized).setScale(2, RoundingMode.HALF_UP);
            if (price.compareTo(BigDecimal.ZERO) < 0) {
                validationErrors.add("Price must be non-negative");
                return null;
            }
            if (new BigDecimal(normalized).compareTo(price) != 0) {
                reviewReasons.add("Price precision was normalized to 2 decimal places");
            }
            return price;
        } catch (NumberFormatException ignored) {
            validationErrors.add("Price is invalid");
            return null;
        }
    }

    private LocalDateTime parseInvoiceDate(
        String rawValue,
        List<String> reviewReasons,
        List<String> validationErrors
    ) {
        // Missing invoice date is a validation error.
        if (rawValue == null || rawValue.isBlank()) {
            validationErrors.add("InvoiceDate is missing");
            return null;
        }

        // Allow both date/time separators; normalize 'T' to space for common ISO variants.
        String trimmed = rawValue.trim();
        String normalized = trimmed.replace('T', ' ');
        if (!trimmed.equals(normalized)) {
            reviewReasons.add("InvoiceDate separator was normalized");
        }

        // Try supported patterns in order; first match wins.
        for (DateTimeFormatter formatter : SUPPORTED_DATE_PATTERNS) {
            try {
                LocalDateTime parsed = LocalDateTime.parse(normalized, formatter);
                reviewReasons.add("InvoiceDate format was normalized to database DATETIME format");
                return parsed;
            } catch (DateTimeParseException ignored) {
                continue;
            }
        }

        validationErrors.add("InvoiceDate is invalid");
        return null;
    }
}
