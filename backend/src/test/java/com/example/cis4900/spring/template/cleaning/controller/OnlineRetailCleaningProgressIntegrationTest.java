package com.example.cis4900.spring.template.cleaning.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.cis4900.spring.template.cleaning.dto.CreateCleaningJobRequest;
import com.example.cis4900.spring.template.cleaning.dto.CleaningJobResource;
import com.example.cis4900.spring.template.cleaning.model.CleaningRunSummary;
import com.example.cis4900.spring.template.cleaning.service.CleaningProgressStore;
import com.example.cis4900.spring.template.cleaning.service.OnlineRetailCleaningPipelineService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

/**
 * Integration-style test: simulates a pipeline that reports progress over time
 * and polls the controller to assert intermediate progress is visible.
 */
class OnlineRetailCleaningProgressIntegrationTest {

    static class SimulatedPipeline extends OnlineRetailCleaningPipelineService {
        private final CleaningProgressStore progressStore;

        SimulatedPipeline(CleaningProgressStore progressStore) {
            super(null, null, null, progressStore);
            this.progressStore = progressStore;
        }

        @Override
        public CleaningRunSummary runCleaning(Integer requestedBatchSize) {
            // Simulate 10 units of work, reporting progress each step.
            final long total = 10L;
            for (long i = 1; i <= total; i++) {
                try {
                    Thread.sleep(20);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                String jobId = progressStore.getCurrentJobId();
                if (jobId != null) {
                    progressStore.updateProgress(jobId, i, total);
                }
            }
            return new CleaningRunSummary(total, total, 0, 0, 0);
        }
    }

    @Test
    void controller_exposes_intermediate_progress() throws Exception {
        CleaningProgressStore progressStore = new CleaningProgressStore();
        SimulatedPipeline pipeline = new SimulatedPipeline(progressStore);

        ExecutorService jobExecutor = Executors.newSingleThreadExecutor();
        OnlineRetailCleaningController controller = new OnlineRetailCleaningController(pipeline, jobExecutor, progressStore);

        // Create job
        var created = controller.createCleaningJob(new CreateCleaningJobRequest(2));
        assertEquals(202, created.getStatusCodeValue());
        CleaningJobResource queued = created.getBody();
        assertEquals("PENDING", queued.status());

        String jobId = queued.jobId();

        boolean sawRunning = false;
        boolean sawProgress = false;

        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline) {
            var polled = controller.getCleaningJob(jobId);
            assertEquals(200, polled.getStatusCodeValue());
            CleaningJobResource res = polled.getBody();
            if ("RUNNING".equals(res.status())) {
                sawRunning = true;
            }
            if (res.processedCount() > 0) {
                sawProgress = true;
                break;
            }
            Thread.sleep(30);
        }

        // Wait for completion
        long finishDeadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < finishDeadline) {
            var polled = controller.getCleaningJob(jobId);
            CleaningJobResource res = polled.getBody();
            if ("COMPLETED".equals(res.status())) {
                assertEquals(1.0, res.progress());
                assertEquals(10L, res.processedCount());
                break;
            }
            Thread.sleep(30);
        }

        jobExecutor.shutdown();
        jobExecutor.awaitTermination(1, TimeUnit.SECONDS);

        assertTrue(sawRunning, "Did not observe running status");
        assertTrue(sawProgress, "Did not observe intermediate progress updates");
    }
}
