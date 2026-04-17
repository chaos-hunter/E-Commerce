package com.example.cis4900.spring.template.cleaning.model;

import java.util.List;

public record CleaningDecision(
    CleanedRetailRecord cleanedRecord,
    CleaningReviewStatus reviewStatus,
    List<String> reviewReasons,
    List<String> validationErrors
) {

    public boolean shouldInsertCleanedRecord() {
        return cleanedRecord != null && validationErrors.isEmpty();
    }

    public boolean shouldInsertReviewRecord() {
        return reviewStatus != CleaningReviewStatus.NONE;
    }
}
