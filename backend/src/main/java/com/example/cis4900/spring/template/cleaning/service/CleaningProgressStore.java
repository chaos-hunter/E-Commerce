package com.example.cis4900.spring.template.cleaning.service;

import com.example.cis4900.spring.template.cleaning.dto.CleaningJobResource;
import com.example.cis4900.spring.template.cleaning.model.CleaningRunSummary;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Simple in-memory progress store for cleaning jobs. ThreadLocal is used so the
 * controller can set the current job id before invoking the pipeline and the
 * pipeline can report progress without changing its method signature.
 */
@Component
public class CleaningProgressStore {
    // Central in-memory snapshot of each job's externally visible state.
    private final Map<String, CleaningJobResource> jobsById = new ConcurrentHashMap<>();
    // Carries the active job id through the async cleaning thread so the pipeline
    // can publish progress without threading jobId through every method call.
    private final ThreadLocal<String> currentJobId = new ThreadLocal<>();

    public void setCurrentJobId(String jobId) {
        currentJobId.set(jobId);
    }

    public void clearCurrentJobId() {
        currentJobId.remove();
    }

    public String getCurrentJobId() {
        return currentJobId.get();
    }

    public CleaningJobResource createJob(String jobId, Instant createdAt) {
        CleaningJobResource queued = new CleaningJobResource(jobId, "PENDING", createdAt, null, 0L, 0L, 0.0, null, null);
        jobsById.put(jobId, queued);
        return queued;
    }

    public void setRunning(String jobId) {
        Instant started = Instant.now();
        jobsById.computeIfPresent(jobId, (k, v) -> new CleaningJobResource(v.jobId(), "RUNNING", v.createdAt(), started, v.processedCount(), v.totalCount(), v.progress(), null, v.summary()));
    }

    public void updateProgress(String jobId, long processedCount, long totalCount) {
        if (jobId == null) {
            return;
        }
        double progress = totalCount <= 0 ? 0.0 : (double) processedCount / (double) totalCount;
        jobsById.computeIfPresent(jobId, (k, v) -> {
            Instant started = v.startedAt();
            Long eta = null;
            if (started != null && processedCount > 0 && totalCount > processedCount) {
                // ETA uses a simple linear estimate: average millis/item so far
                // multiplied by remaining items.
                long elapsedMillis = java.time.Duration.between(started, Instant.now()).toMillis();
                double perItem = (double) elapsedMillis / (double) processedCount;
                long remaining = (long) Math.ceil(perItem * (totalCount - processedCount));
                eta = remaining;
            }
            return new CleaningJobResource(v.jobId(), v.status(), v.createdAt(), v.startedAt(), processedCount, totalCount, progress, eta, v.summary());
        });
    }

    public void completeJob(String jobId, Instant createdAt, CleaningRunSummary summary, long processedCount, long totalCount) {
        double progress = totalCount <= 0 ? 1.0 : (double) processedCount / (double) totalCount;
        CleaningJobResource current = jobsById.get(jobId);
        Instant started = current == null ? null : current.startedAt();
        // Explicitly set final ETA to zero at terminal success.
        Long eta = 0L;
        CleaningJobResource completed = new CleaningJobResource(jobId, "COMPLETED", createdAt, started, processedCount, totalCount, progress, eta, summary);
        jobsById.put(jobId, completed);
    }

    public void failJob(String jobId, Instant createdAt) {
        CleaningJobResource failed = new CleaningJobResource(jobId, "FAILED", createdAt, null, 0L, 0L, 0.0, null, null);
        jobsById.put(jobId, failed);
    }

    public CleaningJobResource getJob(String jobId) {
        return jobsById.get(jobId);
    }
}
