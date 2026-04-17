package com.example.cis4900.spring.template.cleaning.service;

import com.example.cis4900.spring.template.cleaning.dto.CleanedRetailDataItem;
import com.example.cis4900.spring.template.cleaning.dto.DirtyRetailDataItem;
import com.example.cis4900.spring.template.cleaning.dto.ManualReviewItem;
import com.example.cis4900.spring.template.cleaning.dto.PagedResponse;
import java.sql.Timestamp;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Read-only query service for paginated cleaned/manual-review listings.
 */
@Service
public class OnlineRetailCleaningQueryService {

    private final JdbcTemplate jdbcTemplate;

    public OnlineRetailCleaningQueryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Returns a single page from cleaned_online_retail_data.
     */
    public PagedResponse<CleanedRetailDataItem> getCleanedDataPage(int page, int size) {
        int offset = page * size;
        Long totalCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM cleaned_online_retail_data",
            Long.class
        );

        List<CleanedRetailDataItem> entries = jdbcTemplate.query(
            """
            SELECT id, raw_data_id, Invoice, StockCode, Description, Quantity, InvoiceDate,
                   Price, CustomerID, Country, is_return, created_at, updated_at
            FROM cleaned_online_retail_data
            ORDER BY id DESC
            LIMIT ? OFFSET ?
            """,
            (resultSet, rowNum) -> new CleanedRetailDataItem(
                resultSet.getInt("id"),
                resultSet.getInt("raw_data_id"),
                resultSet.getString("Invoice"),
                resultSet.getString("StockCode"),
                resultSet.getString("Description"),
                resultSet.getInt("Quantity"),
                resultSet.getTimestamp("InvoiceDate").toLocalDateTime(),
                resultSet.getBigDecimal("Price"),
                (Integer) resultSet.getObject("CustomerID"),
                resultSet.getString("Country"),
                resultSet.getBoolean("is_return"),
                toInstant(resultSet.getTimestamp("created_at")),
                toInstant(resultSet.getTimestamp("updated_at"))
            ),
            size,
            offset
        );

        return buildResponse(entries, page, size, totalCount == null ? 0L : totalCount);
    }

    /**
     * Returns a single page from online_retail_manual_review.
     */
    public PagedResponse<ManualReviewItem> getManualReviewPage(int page, int size, String reviewStatus) {
        int offset = page * size;

        // Frontend can request only one review status (for example, REJECTED).
        boolean hasStatusFilter = reviewStatus != null && !reviewStatus.isBlank();
        Long totalCount;
        List<ManualReviewItem> entries;

        if (hasStatusFilter) {
            String normalizedStatus = reviewStatus.trim().toUpperCase();
            totalCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM online_retail_manual_review WHERE review_status = ?",
                Long.class,
                normalizedStatus
            );

            entries = jdbcTemplate.query(
                """
                SELECT id, raw_data_id, review_status, reason, validation_errors,
                       raw_values, cleaned_values, created_at, updated_at
                FROM online_retail_manual_review
                WHERE review_status = ?
                ORDER BY id DESC
                LIMIT ? OFFSET ?
                """,
                (resultSet, rowNum) -> new ManualReviewItem(
                    resultSet.getInt("id"),
                    resultSet.getInt("raw_data_id"),
                    resultSet.getString("review_status"),
                    resultSet.getString("reason"),
                    resultSet.getString("validation_errors"),
                    resultSet.getString("raw_values"),
                    resultSet.getString("cleaned_values"),
                    toInstant(resultSet.getTimestamp("created_at")),
                    toInstant(resultSet.getTimestamp("updated_at"))
                ),
                normalizedStatus,
                size,
                offset
            );
        } else {
            // Default behavior returns all manual-review rows for backward compatibility.
            totalCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM online_retail_manual_review",
                Long.class
            );

            entries = jdbcTemplate.query(
                """
                SELECT id, raw_data_id, review_status, reason, validation_errors,
                       raw_values, cleaned_values, created_at, updated_at
                FROM online_retail_manual_review
                ORDER BY id DESC
                LIMIT ? OFFSET ?
                """,
                (resultSet, rowNum) -> new ManualReviewItem(
                    resultSet.getInt("id"),
                    resultSet.getInt("raw_data_id"),
                    resultSet.getString("review_status"),
                    resultSet.getString("reason"),
                    resultSet.getString("validation_errors"),
                    resultSet.getString("raw_values"),
                    resultSet.getString("cleaned_values"),
                    toInstant(resultSet.getTimestamp("created_at")),
                    toInstant(resultSet.getTimestamp("updated_at"))
                ),
                size,
                offset
            );
        }

        return buildResponse(entries, page, size, totalCount == null ? 0L : totalCount);
    }

    /**
     * Returns a single page from dirty_data.
     */
    public PagedResponse<DirtyRetailDataItem> getDirtyDataPage(int page, int size) {
        int offset = page * size;
        // Mirrors cleaned/manual-review pagination so tab switching stays consistent.
        Long totalCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM dirty_data",
            Long.class
        );

        List<DirtyRetailDataItem> entries = jdbcTemplate.query(
            """
            SELECT id, Invoice, StockCode, Description, Quantity, InvoiceDate, Price, CustomerID, Country
            FROM dirty_data
            ORDER BY id DESC
            LIMIT ? OFFSET ?
            """,
            (resultSet, rowNum) -> new DirtyRetailDataItem(
                resultSet.getInt("id"),
                resultSet.getString("Invoice"),
                resultSet.getString("StockCode"),
                resultSet.getString("Description"),
                resultSet.getString("Quantity"),
                resultSet.getString("InvoiceDate"),
                resultSet.getString("Price"),
                resultSet.getString("CustomerID"),
                resultSet.getString("Country")
            ),
            size,
            offset
        );

        return buildResponse(entries, page, size, totalCount == null ? 0L : totalCount);
    }

    private static <T> PagedResponse<T> buildResponse(
        List<T> entries,
        int page,
        int size,
        long totalEntries
    ) {
        // Compute page count once so frontend paging controls can be derived directly.
        int totalPages = totalEntries == 0
            ? 0
            : (int) Math.ceil((double) totalEntries / size);
        boolean hasPrevious = page > 0;
        boolean hasNext = page + 1 < totalPages;

        return new PagedResponse<>(
            entries,
            page,
            size,
            totalEntries,
            totalPages,
            hasPrevious,
            hasNext
        );
    }

    private static java.time.Instant toInstant(Timestamp timestamp) {
        // Keep null timestamps null instead of synthesizing a value.
        return timestamp == null ? null : timestamp.toInstant();
    }
}
