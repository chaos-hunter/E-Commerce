package com.example.cis4900.spring.template.ingest.controller;

import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import com.example.cis4900.spring.template.ingest.service.IngestDataService;

@RestController
@RequestMapping("/api/ingests")
public class IngestDataController {
    private static final Logger LOGGER = LoggerFactory.getLogger(IngestDataController.class);

    private final IngestDataService ingestDataService;

    public IngestDataController(IngestDataService ingestDataService) {
        this.ingestDataService = ingestDataService;
    }

    // RESTful create endpoint: posting multipart content creates a new ingest resource.
    // We intentionally use the collection noun path (/api/ingests) and HTTP POST for Create.
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<String> uploadFile(@RequestParam("file") MultipartFile file) {
        String originalFilename = file.getOriginalFilename();
        long fileSizeBytes = file.getSize();
        // Request-scoped log line to correlate frontend upload timing with backend processing.
        LOGGER.info("Upload request received: fileName='{}', sizeBytes={}", originalFilename, fileSizeBytes);

        try {
            long startedAt = System.currentTimeMillis();
            ingestDataService.processFile(file);
            long elapsedMs = System.currentTimeMillis() - startedAt;
            LOGGER.info("Upload request succeeded: fileName='{}', elapsedMs={}", originalFilename, elapsedMs);
            return ResponseEntity.ok("File uploaded successfully");
        } catch (IllegalArgumentException e) {
            // Validation/input errors are surfaced to the client as 400 responses.
            LOGGER.warn("Upload request rejected: fileName='{}', message='{}'", originalFilename, e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (RuntimeException e) {
            // Unexpected processing failures are masked behind a generic 500 body.
            LOGGER.error("Upload request failed: fileName='{}'", originalFilename, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body("Failed to process uploaded file.");
        }
    }

}
