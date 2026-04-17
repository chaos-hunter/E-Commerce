package com.example.cis4900.spring.template.cleaning.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.cis4900.spring.template.cleaning.model.RawRetailRow;
import com.example.cis4900.spring.template.cleaning.model.CleanedRetailRecord;
import com.example.cis4900.spring.template.cleaning.model.CleaningDecision;
import com.example.cis4900.spring.template.cleaning.model.CleaningReviewStatus;
import com.example.cis4900.spring.template.cleaning.model.CleaningRunSummary;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OnlineRetailCleaningPipelineService {
    private static final Logger LOGGER = LoggerFactory.getLogger(OnlineRetailCleaningPipelineService.class);

    /**
     * Pipeline service that reads raw rows from `dirty_data`, applies cleaning rules,
     * writes cleaned rows to `cleaned_online_retail_data` and records manual-review
     * information in `online_retail_manual_review`.
     *
     * <p>The pipeline processes rows in ascending `id` order in batches to avoid
     * loading the entire table into memory.
     */

    private static final int DEFAULT_BATCH_SIZE = 500;

    private final JdbcTemplate jdbcTemplate;
    private final OnlineRetailRowCleaner rowCleaner;
    private final ObjectMapper objectMapper;
    // Shared singleton store used by controller polling and pipeline updates.
    private final CleaningProgressStore progressStore;

    @Autowired
    public OnlineRetailCleaningPipelineService(
        JdbcTemplate jdbcTemplate,
        OnlineRetailRowCleaner rowCleaner,
        ObjectMapper objectMapper,
        CleaningProgressStore progressStore
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.rowCleaner = rowCleaner;
        this.objectMapper = objectMapper;
        this.progressStore = progressStore;
    }

    public OnlineRetailCleaningPipelineService(
        JdbcTemplate jdbcTemplate,
        OnlineRetailRowCleaner rowCleaner,
        ObjectMapper objectMapper
    ) {
        this(jdbcTemplate, rowCleaner, objectMapper, null);
    }

    @Transactional
    public CleaningRunSummary runCleaning(Integer requestedBatchSize) {
        int batchSize = requestedBatchSize == null || requestedBatchSize <= 0
            ? DEFAULT_BATCH_SIZE
            : requestedBatchSize;

        LOGGER.info("runCleaning started with batchSize={}", batchSize);

        long totalRowsProcessed = 0L;
        long rowsInsertedIntoCleaned = 0L;
        long rowsFlaggedRejected = 0L;
        long rowsFlaggedAutoCleaned = 0L;
        long returnsDetected = 0L;

        long totalCount = 0L;
        if (progressStore != null) {
            try {
                // Snapshot total rows at run start for progress and ETA calculations.
                totalCount = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM dirty_data", Long.class);
            } catch (Exception e) {
                // Keep cleaning resilient even if counting fails.
                totalCount = 0L;
            }
        }

        // Track the last processed id so each batch picks up after the previous one.
        int lastSeenId = 0;
        List<RawRetailRow> batch;

        do {
            // Load the next batch of raw rows and process them sequentially.
            batch = loadBatch(lastSeenId, batchSize);
            LOGGER.info("Loaded batch with {} rows after lastSeenId={}", batch.size(), lastSeenId);
            for (RawRetailRow rawRow : batch) {
                totalRowsProcessed++;
                lastSeenId = rawRow.id();

                try {
                    CleaningDecision decision = rowCleaner.cleanRow(rawRow);

                    // Persist cleaned records when the decision indicates it's safe.
                    if (decision.shouldInsertCleanedRecord()) {
                        insertCleanedRecord(decision.cleanedRecord());
                        rowsInsertedIntoCleaned++;
                    }

                    // Persist any record that requires manual review (rejected or auto-cleaned).
                    if (decision.shouldInsertReviewRecord()) {
                        insertManualReview(rawRow, decision);
                        if (decision.reviewStatus() == CleaningReviewStatus.REJECTED) {
                            rowsFlaggedRejected++;
                        }
                        if (decision.reviewStatus() == CleaningReviewStatus.AUTO_CLEANED) {
                            rowsFlaggedAutoCleaned++;
                        }
                    }

                    if (decision.cleanedRecord() != null && decision.cleanedRecord().isReturn()) {
                        returnsDetected++;
                    }
                } catch (RuntimeException exception) {
                    // Unexpected processing errors are recorded as rejections so
                    // they can be investigated, but they do not abort the whole run.
                    LOGGER.warn("Cleaning failed for rawRow id={}: {}", rawRow.id(), exception.getMessage());
                    rowsFlaggedRejected++;
                    insertProcessingFailure(rawRow, exception);
                }
                // Report progress if available
                try {
                    if (progressStore != null) {
                        String jobId = progressStore.getCurrentJobId();
                        if (jobId != null) {
                            // Publish near real-time progress after each processed row.
                            progressStore.updateProgress(jobId, totalRowsProcessed, totalCount);
                        }
                    }
                } catch (Exception e) {
                    LOGGER.debug("Failed to update progress: {}", e.getMessage());
                }
            }
        } while (!batch.isEmpty());

        LOGGER.info(
            "runCleaning finished: processed={}, inserted={}, rejected={}, autoCleaned={}, returns={}",
            totalRowsProcessed,
            rowsInsertedIntoCleaned,
            rowsFlaggedRejected,
            rowsFlaggedAutoCleaned,
            returnsDetected
        );

        return new CleaningRunSummary(
            totalRowsProcessed,
            rowsInsertedIntoCleaned,
            rowsFlaggedRejected,
            rowsFlaggedAutoCleaned,
            returnsDetected
        );
    }

    private List<RawRetailRow> loadBatch(int lastSeenId, int batchSize) {
        return jdbcTemplate.query(
            """
            SELECT id, Invoice, StockCode, Description, Quantity, InvoiceDate, Price, CustomerID, Country
            FROM dirty_data
            WHERE id > ?
            ORDER BY id ASC
            LIMIT ?
            """,
            rawRetailRowMapper(),
            lastSeenId,
            batchSize
        );
    }

    private RowMapper<RawRetailRow> rawRetailRowMapper() {
        return (resultSet, rowNum) -> mapRawRow(resultSet);
    }

    private RawRetailRow mapRawRow(ResultSet resultSet) throws SQLException {
        return new RawRetailRow(
            resultSet.getInt("id"),
            resultSet.getString("Invoice"),
            resultSet.getString("StockCode"),
            resultSet.getString("Description"),
            resultSet.getString("Quantity"),
            resultSet.getString("InvoiceDate"),
            resultSet.getString("Price"),
            resultSet.getString("CustomerID"),
            resultSet.getString("Country")
        );
    }

    private void insertCleanedRecord(CleanedRetailRecord record) {
        jdbcTemplate.update(
            """
            INSERT INTO cleaned_online_retail_data
            (raw_data_id, Invoice, StockCode, Description, Quantity, InvoiceDate, Price, CustomerID, Country, is_return)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                Invoice = VALUES(Invoice),
                StockCode = VALUES(StockCode),
                Description = VALUES(Description),
                Quantity = VALUES(Quantity),
                InvoiceDate = VALUES(InvoiceDate),
                Price = VALUES(Price),
                CustomerID = VALUES(CustomerID),
                Country = VALUES(Country),
                is_return = VALUES(is_return)
            """,
            record.rawDataId(),
            record.invoice(),
            record.stockCode(),
            record.description(),
            record.quantity(),
            Timestamp.valueOf(record.invoiceDate()),
            record.price(),
            record.customerId(),
            record.country(),
            record.isReturn()
        );
    }

    private void insertManualReview(RawRetailRow rawRow, CleaningDecision decision) {
        jdbcTemplate.update(
            """
            INSERT INTO online_retail_manual_review
            (raw_data_id, review_status, reason, validation_errors, raw_values, cleaned_values)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                review_status = VALUES(review_status),
                reason = VALUES(reason),
                validation_errors = VALUES(validation_errors),
                raw_values = VALUES(raw_values),
                cleaned_values = VALUES(cleaned_values)
            """,
            rawRow.id(),
            decision.reviewStatus().name(),
            String.join("; ", decision.reviewReasons()),
            decision.validationErrors().isEmpty() ? null : String.join("; ", decision.validationErrors()),
            safeJson(rawRow.asMap()),
            decision.cleanedRecord() == null ? null : safeJson(decision.cleanedRecord().asMap())
        );
    }

    private void insertProcessingFailure(RawRetailRow rawRow, RuntimeException exception) {
        jdbcTemplate.update(
            """
            INSERT INTO online_retail_manual_review
            (raw_data_id, review_status, reason, validation_errors, raw_values, cleaned_values)
            VALUES (?, 'REJECTED', ?, ?, ?, NULL)
            ON DUPLICATE KEY UPDATE
                review_status = VALUES(review_status),
                reason = VALUES(reason),
                validation_errors = VALUES(validation_errors),
                raw_values = VALUES(raw_values),
                cleaned_values = VALUES(cleaned_values)
            """,
            rawRow.id(),
            "Unhandled exception during cleaning",
            exception.getClass().getSimpleName() + ": " + exception.getMessage(),
            safeJson(rawRow.asMap())
        );
    }

    private String safeJson(Object payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            // Avoid throwing from logging/diagnostic code; return a minimal JSON
            // fragment describing the serialization error.
            return "{\"serializationError\":\"" + exception.getMessage() + "\"}";
        }
    }
}
