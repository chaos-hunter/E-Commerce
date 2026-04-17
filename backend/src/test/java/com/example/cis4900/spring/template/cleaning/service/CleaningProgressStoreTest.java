package com.example.cis4900.spring.template.cleaning.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.cis4900.spring.template.cleaning.dto.CleaningJobResource;
import com.example.cis4900.spring.template.cleaning.model.CleaningRunSummary;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class CleaningProgressStoreTest {

    @Test
    void create_update_complete_and_fail_cycle() {
        CleaningProgressStore store = new CleaningProgressStore();
        String jobId = "job-1";
        Instant createdAt = Instant.now();

        CleaningJobResource queued = store.createJob(jobId, createdAt);
        assertNotNull(queued);
        assertEquals("PENDING", queued.status());

        store.setRunning(jobId);
        CleaningJobResource running = store.getJob(jobId);
        assertEquals("RUNNING", running.status());

        store.updateProgress(jobId, 5L, 10L);
        CleaningJobResource updated = store.getJob(jobId);
        assertEquals(5L, updated.processedCount());
        assertEquals(10L, updated.totalCount());
        assertTrue(updated.progress() > 0.0 && updated.progress() < 1.0);

        CleaningRunSummary summary = new CleaningRunSummary(10, 8, 1, 1, 0);
        store.completeJob(jobId, createdAt, summary, 10L, 10L);
        CleaningJobResource completed = store.getJob(jobId);
        assertEquals("COMPLETED", completed.status());
        assertEquals(1.0, completed.progress());

        String job2 = "job-2";
        store.createJob(job2, createdAt);
        store.failJob(job2, createdAt);
        CleaningJobResource failed = store.getJob(job2);
        assertEquals("FAILED", failed.status());
    }
}
