package com.example.cis4900.spring.template.cleaning.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.example.cis4900.spring.template.cleaning.dto.CleaningJobResource;
import com.example.cis4900.spring.template.cleaning.dto.CreateCleaningJobRequest;
import com.example.cis4900.spring.template.cleaning.model.CleaningRunSummary;
import com.example.cis4900.spring.template.cleaning.service.OnlineRetailCleaningPipelineService;
import java.util.concurrent.Executor;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.ResponseEntity;

/**
 * Controller-level unit tests for the cleaning job endpoints.
 *
 * <p>These tests exercise request/response shaping and job storage semantics.
 */
class OnlineRetailCleaningControllerTest {

    @Test
    void createAndGetJob_returnsAcceptedThenCompletedResource() {
        OnlineRetailCleaningPipelineService svc = Mockito.mock(OnlineRetailCleaningPipelineService.class);
        CleaningRunSummary summary = new CleaningRunSummary(1,1,0,0,0);
        Mockito.when(svc.runCleaning(Mockito.any())).thenReturn(summary);
        Executor directExecutor = Runnable::run;

        OnlineRetailCleaningController controller = new OnlineRetailCleaningController(svc, directExecutor);

        // Provide a mock servlet request so ServletUriComponentsBuilder can build a location
        org.springframework.mock.web.MockHttpServletRequest request = new org.springframework.mock.web.MockHttpServletRequest();
        org.springframework.web.context.request.RequestContextHolder.setRequestAttributes(new org.springframework.web.context.request.ServletRequestAttributes(request));

        ResponseEntity<CleaningJobResource> created = controller.createCleaningJob(new CreateCleaningJobRequest(10));
        // POST should acknowledge the queued job immediately.
        assertEquals(202, created.getStatusCodeValue());

        CleaningJobResource body = created.getBody();
        assertEquals("PENDING", body.status());
        assertNull(body.summary());

        ResponseEntity<CleaningJobResource> fetched = controller.getCleaningJob(body.jobId());
        assertEquals(200, fetched.getStatusCodeValue());
        assertEquals(body.jobId(), fetched.getBody().jobId());
        assertEquals("COMPLETED", fetched.getBody().status());
        assertNotNull(fetched.getBody().summary());
    }

    @Test
    void createAndGetJob_returnsFailedStatus_whenPipelineThrows() {
        OnlineRetailCleaningPipelineService svc = Mockito.mock(OnlineRetailCleaningPipelineService.class);
        Mockito.when(svc.runCleaning(Mockito.any())).thenThrow(new RuntimeException("boom"));
        Executor directExecutor = Runnable::run;

        OnlineRetailCleaningController controller = new OnlineRetailCleaningController(svc, directExecutor);

        org.springframework.mock.web.MockHttpServletRequest request = new org.springframework.mock.web.MockHttpServletRequest();
        org.springframework.web.context.request.RequestContextHolder.setRequestAttributes(new org.springframework.web.context.request.ServletRequestAttributes(request));

        ResponseEntity<CleaningJobResource> created = controller.createCleaningJob(new CreateCleaningJobRequest(10));
        assertEquals(202, created.getStatusCodeValue());

        CleaningJobResource body = created.getBody();
        ResponseEntity<CleaningJobResource> fetched = controller.getCleaningJob(body.jobId());
        assertEquals(200, fetched.getStatusCodeValue());
        assertEquals("FAILED", fetched.getBody().status());
        assertNull(fetched.getBody().summary());
    }
}
