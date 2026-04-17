package com.example.cis4900.spring.template.cleaning.controller;

import com.example.cis4900.spring.template.cleaning.dto.CreateCleaningJobRequest;
import com.example.cis4900.spring.template.cleaning.dto.CleaningJobResource;
import com.example.cis4900.spring.template.cleaning.model.CleaningRunSummary;
import com.example.cis4900.spring.template.cleaning.service.OnlineRetailCleaningPipelineService;
import com.example.cis4900.spring.template.cleaning.service.CleaningProgressStore;
import java.net.URI;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.ForkJoinPool;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/cleaning-jobs")
public class OnlineRetailCleaningController {
    private static final Logger LOGGER = LoggerFactory.getLogger(OnlineRetailCleaningController.class);

    /**
     * Simple REST controller exposing cleaning job endpoints.
     *
     * <p>POST creates a job resource immediately, then runs cleaning asynchronously.
     * The current status can be polled with GET by job id.
     *
     * <p>For this exercise jobs are stored in-memory. In production this would
     * typically use persistent storage.
     */

    private final OnlineRetailCleaningPipelineService cleaningPipelineService;
    private final Executor jobExecutor;
    // Shared singleton state used by both POST/GET handlers and the pipeline.
    private final CleaningProgressStore progressStore;

    @Autowired
    public OnlineRetailCleaningController(
        OnlineRetailCleaningPipelineService cleaningPipelineService,
        CleaningProgressStore progressStore
    ) {
        this(cleaningPipelineService, ForkJoinPool.commonPool(), progressStore);
    }

    // Convenience constructor used by unit tests to inject a direct executor.
    OnlineRetailCleaningController(
        OnlineRetailCleaningPipelineService cleaningPipelineService,
        Executor jobExecutor
    ) {
        this(cleaningPipelineService, jobExecutor, new CleaningProgressStore());
    }

    OnlineRetailCleaningController(
        OnlineRetailCleaningPipelineService cleaningPipelineService,
        Executor jobExecutor,
        CleaningProgressStore progressStore
    ) {
        this.cleaningPipelineService = cleaningPipelineService;
        this.jobExecutor = Objects.requireNonNull(jobExecutor, "jobExecutor");
        this.progressStore = progressStore == null ? new CleaningProgressStore() : progressStore;
    }

    @PostMapping
    public ResponseEntity<CleaningJobResource> createCleaningJob(
        @RequestBody(required = false) CreateCleaningJobRequest request
    ) {
        // Allow callers to override batch size for the run; null uses default.
        Integer batchSize = request == null ? null : request.batchSize();
        String jobId = UUID.randomUUID().toString();
        Instant createdAt = Instant.now();

        CleaningJobResource queuedJob = progressStore.createJob(jobId, createdAt);
        LOGGER.info("Queued cleaning job {} with batchSize={}", jobId, batchSize);

        URI location = ServletUriComponentsBuilder
            .fromCurrentRequest()
            .path("/{jobId}")
            .buildAndExpand(jobId)
            .toUri();

        CompletableFuture.runAsync(() -> runCleaningJob(jobId, createdAt, batchSize), jobExecutor);

        return ResponseEntity
            .accepted()
            .location(location)
            .cacheControl(CacheControl.noStore())
            .body(queuedJob);
    }

    private void runCleaningJob(String jobId, Instant createdAt, Integer batchSize) {
        LOGGER.info("Starting cleaning job {} (batchSize={})", jobId, batchSize);
        // Seed per-thread context so deep pipeline code can emit progress updates
        // without receiving jobId as an explicit parameter.
        progressStore.setCurrentJobId(jobId);
        progressStore.setRunning(jobId);

        try {
            CleaningRunSummary summary = cleaningPipelineService.runCleaning(batchSize);
            CleaningJobResource current = progressStore.getJob(jobId);
            long processed = current == null ? 0L : current.processedCount();
            long total = current == null ? 0L : current.totalCount();
            progressStore.completeJob(jobId, createdAt, summary, processed, total);
            // Always clear thread-local context before exiting this async task.
            progressStore.clearCurrentJobId();
            LOGGER.info(
                "Cleaning job {} completed: processed={}, inserted={}, rejected={}, autoCleaned={}, returns={}",
                jobId,
                summary.totalRowsProcessed(),
                summary.rowsInsertedIntoCleaned(),
                summary.rowsFlaggedRejected(),
                summary.rowsFlaggedAutoCleaned(),
                summary.returnsDetected()
            );
            // Catch broad failures so job state does not remain RUNNING forever.
        } catch (Exception exception) {
            progressStore.failJob(jobId, createdAt);
            progressStore.clearCurrentJobId();
            LOGGER.error("Cleaning job {} failed with exception", jobId, exception);
        } catch (Throwable throwable) {
            progressStore.failJob(jobId, createdAt);
            progressStore.clearCurrentJobId();
            LOGGER.error("Cleaning job {} failed with throwable", jobId, throwable);
        }
    }

    @GetMapping("/{jobId}")
    public ResponseEntity<CleaningJobResource> getCleaningJob(@PathVariable String jobId) {
        CleaningJobResource jobResource = progressStore.getJob(jobId);
        if (jobResource == null) {
            LOGGER.info("Cleaning job {} not found", jobId);
            return ResponseEntity.notFound().build();
        }

        // Debug-level polling logs are useful during long-running imports.
        LOGGER.debug("Cleaning job {} polled with status={}", jobId, jobResource.status());

        return ResponseEntity
            .ok()
            .cacheControl(CacheControl.noStore())
            .body(jobResource);
    }
}
