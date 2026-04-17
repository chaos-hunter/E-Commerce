package com.example.cis4900.spring.template.cleaning.controller;

import com.example.cis4900.spring.template.cleaning.dto.CleanedRetailDataItem;
import com.example.cis4900.spring.template.cleaning.dto.DirtyRetailDataItem;
import com.example.cis4900.spring.template.cleaning.dto.ManualReviewItem;
import com.example.cis4900.spring.template.cleaning.dto.PagedResponse;
import com.example.cis4900.spring.template.cleaning.service.OnlineRetailCleaningExportService;
import com.example.cis4900.spring.template.cleaning.service.OnlineRetailCleaningQueryService;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

/**
 * REST endpoints for paged browsing of cleaned and manual-review data.
 */
@RestController
@RequestMapping("/api/cleaning-data")
public class OnlineRetailCleaningDataController {

    private static final int DEFAULT_SIZE = 15;
    private static final Set<Integer> ALLOWED_SIZES = Set.of(15, 25, 50, 100);
    // Constants for exporting excel header
    private static final MediaType XLSX_MEDIA_TYPE = MediaType.parseMediaType(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    private static final String EXPORT_FILE_NAME = "cleaned-data.xlsx";


    private final OnlineRetailCleaningQueryService cleaningQueryService;
    private final OnlineRetailCleaningExportService cleaningExportService;

    public OnlineRetailCleaningDataController(
        OnlineRetailCleaningQueryService cleaningQueryService,
        OnlineRetailCleaningExportService cleaningExportService
    ) {
        this.cleaningQueryService = cleaningQueryService;
        this.cleaningExportService = cleaningExportService;
    }

    /**
     * Reads one page of cleaned records for frontend table rendering.
     */
    @GetMapping("/cleaned")
    public ResponseEntity<PagedResponse<CleanedRetailDataItem>> getCleanedDataPage(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(required = false) Integer size
    ) {
        validatePage(page);
        int resolvedSize = resolveSize(size);

        return ResponseEntity
            .ok()
            .cacheControl(CacheControl.noStore())
            .body(cleaningQueryService.getCleanedDataPage(page, resolvedSize));
    }

    /**
     * Exports cleaned data as an XLSX representation of the cleaned collection.
     *
        * <p>REST note:
     * - This intentionally reuses the cleaned resource path (/cleaned) and uses
     *   a representation query parameter (format=xlsx) instead of an action path
     *   like /cleaned/export.
     * - The @GetMapping params selector prevents collisions with the paged JSON
     *   endpoint above that serves /cleaned without format=xlsx.
     */
    @GetMapping(value = "/cleaned", params = "format=xlsx")
    public ResponseEntity<StreamingResponseBody> exportCleanedDataAsXlsx() {
        // Handle no data case
        // Avoid sending an empty file
        if (!cleaningExportService.hasExportRows()) {
            return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .build();
        }

        // Attempts workbook creation
        // Stream workbook bytes straight to the response
        StreamingResponseBody responseBody = cleaningExportService::writeWorkbook;

        // Let the browser download the workbook as a file attachment
        return ResponseEntity
            .ok()
            .cacheControl(CacheControl.noStore())
            .contentType(XLSX_MEDIA_TYPE)
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + EXPORT_FILE_NAME + "\""
            )
            .body(responseBody);
    }


    /**
     * Reads one page of manual-review rows for frontend table rendering.
     */
    @GetMapping("/manual-review")
    public ResponseEntity<PagedResponse<ManualReviewItem>> getManualReviewPage(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(required = false) Integer size,
        // Optional filter used by frontend Invalid tab to request only REJECTED rows.
        @RequestParam(required = false) String reviewStatus
    ) {
        validatePage(page);
        int resolvedSize = resolveSize(size);

        return ResponseEntity
            .ok()
            .cacheControl(CacheControl.noStore())
            .body(cleaningQueryService.getManualReviewPage(page, resolvedSize, reviewStatus));
    }

    /**
     * Reads one page of original uploaded rows for frontend table rendering.
     */
    @GetMapping("/dirty")
    public ResponseEntity<PagedResponse<DirtyRetailDataItem>> getDirtyDataPage(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(required = false) Integer size
    ) {
        validatePage(page);
        int resolvedSize = resolveSize(size);

        return ResponseEntity
            .ok()
            .cacheControl(CacheControl.noStore())
            .body(cleaningQueryService.getDirtyDataPage(page, resolvedSize));
    }

    private static void validatePage(int page) {
        // Keep paging deterministic by rejecting negative offsets.
        if (page < 0) {
            throw new ResponseStatusException(BAD_REQUEST, "page must be >= 0");
        }
    }

    private static int resolveSize(Integer requestedSize) {
        if (requestedSize == null) {
            return DEFAULT_SIZE;
        }
        // Restrict page size to UI-supported options.
        if (!ALLOWED_SIZES.contains(requestedSize)) {
            throw new ResponseStatusException(
                BAD_REQUEST,
                "size must be one of 15, 25, 50, 100"
            );
        }
        return requestedSize;
    }
}
