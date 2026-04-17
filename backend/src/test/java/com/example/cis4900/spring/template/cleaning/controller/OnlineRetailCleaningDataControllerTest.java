package com.example.cis4900.spring.template.cleaning.controller;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.example.cis4900.spring.template.cleaning.dto.CleanedRetailDataItem;
import com.example.cis4900.spring.template.cleaning.dto.DirtyRetailDataItem;
import com.example.cis4900.spring.template.cleaning.dto.ManualReviewItem;
import com.example.cis4900.spring.template.cleaning.dto.PagedResponse;
import com.example.cis4900.spring.template.cleaning.service.OnlineRetailCleaningExportService;
import com.example.cis4900.spring.template.cleaning.service.OnlineRetailCleaningQueryService;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/**
 * Unit tests for pagination endpoint request validation and response wiring.
 */
class OnlineRetailCleaningDataControllerTest {

    @Test
    void getCleanedDataPage_usesDefaultPageSize_whenSizeNotProvided() {
        OnlineRetailCleaningQueryService queryService = Mockito.mock(
            OnlineRetailCleaningQueryService.class
        );
        PagedResponse<CleanedRetailDataItem> page = new PagedResponse<>(
            List.of(
                new CleanedRetailDataItem(
                    1,
                    10,
                    "INV",
                    "SC",
                    "Item",
                    2,
                    LocalDateTime.of(2020, 1, 1, 0, 0),
                    new BigDecimal("9.99"),
                    123,
                    "UK",
                    false,
                    Instant.parse("2026-03-07T00:00:00Z"),
                    Instant.parse("2026-03-07T00:00:00Z")
                )
            ),
            0,
            15,
            1,
            1,
            false,
            false
        );

        Mockito.when(queryService.getCleanedDataPage(0, 15)).thenReturn(page);

        OnlineRetailCleaningDataController controller = createController(queryService);

        ResponseEntity<PagedResponse<CleanedRetailDataItem>> response =
            controller.getCleanedDataPage(0, null);

        // Missing size should default to the smallest supported page size.
        assertEquals(200, response.getStatusCodeValue());
        assertEquals(15, response.getBody().size());
        Mockito.verify(queryService).getCleanedDataPage(0, 15);
    }

    @Test
    void exportCleanedData_returnsNotFound_whenNoRowsExist() {
        OnlineRetailCleaningQueryService queryService = Mockito.mock(
            OnlineRetailCleaningQueryService.class
        );
        OnlineRetailCleaningExportService exportService = Mockito.mock(
            OnlineRetailCleaningExportService.class
        );

        // Stop before opening a streamed response when no rows exist
        Mockito.when(exportService.hasExportRows()).thenReturn(false);

        OnlineRetailCleaningDataController controller = createController(
            queryService,
            exportService
        );

        ResponseEntity<StreamingResponseBody> response = controller.exportCleanedDataAsXlsx();

        assertEquals(404, response.getStatusCodeValue());
        assertEquals(null, response.getBody());
        Mockito.verify(exportService).hasExportRows();
        Mockito.verify(exportService, Mockito.never()).writeWorkbook(Mockito.any());
    }

    @Test
    void exportCleanedData_streamsWorkbookBytes_whenRowsExist() throws Exception {
        OnlineRetailCleaningQueryService queryService = Mockito.mock(
            OnlineRetailCleaningQueryService.class
        );
        OnlineRetailCleaningExportService exportService = Mockito.mock(
            OnlineRetailCleaningExportService.class
        );
        byte[] workbookBytes = new byte[] {1, 2, 3, 4};

        // Pretend the service wrote workbook bytes into the response stream
        Mockito.when(exportService.hasExportRows()).thenReturn(true);
        Mockito.doAnswer(invocation -> {
            invocation.<java.io.OutputStream>getArgument(0).write(workbookBytes);
            return null;
        }).when(exportService).writeWorkbook(Mockito.any());

        OnlineRetailCleaningDataController controller = createController(
            queryService,
            exportService
        );

        ResponseEntity<StreamingResponseBody> response = controller.exportCleanedDataAsXlsx();

        assertEquals(200, response.getStatusCodeValue());
        assertEquals(
            MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ),
            response.getHeaders().getContentType()
        );
        assertEquals(
            "attachment; filename=\"cleaned-data.xlsx\"",
            response.getHeaders().getFirst("Content-Disposition")
        );

        // Execute the streaming callback and capture the bytes
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        response.getBody().writeTo(outputStream);
        assertArrayEquals(workbookBytes, outputStream.toByteArray());
        Mockito.verify(exportService).hasExportRows();
        Mockito.verify(exportService).writeWorkbook(Mockito.any());
    }

    @Test
    void exportCleanedData_propagatesStreamingFailure_whenWorkbookCreationFails() {
        OnlineRetailCleaningQueryService queryService = Mockito.mock(
            OnlineRetailCleaningQueryService.class
        );
        OnlineRetailCleaningExportService exportService = Mockito.mock(
            OnlineRetailCleaningExportService.class
        );

        // Streaming failures happen when the callback is executed
        Mockito.when(exportService.hasExportRows()).thenReturn(true);
        Mockito.doThrow(
            new IllegalStateException("boom")
        ).when(exportService).writeWorkbook(Mockito.any());

        OnlineRetailCleaningDataController controller = createController(
            queryService,
            exportService
        );

        ResponseEntity<StreamingResponseBody> response = controller.exportCleanedDataAsXlsx();

        IllegalStateException exception = assertThrows(
            IllegalStateException.class,
            () -> response.getBody().writeTo(new ByteArrayOutputStream())
        );

        assertEquals("boom", exception.getMessage());
        Mockito.verify(exportService).hasExportRows();
        Mockito.verify(exportService).writeWorkbook(Mockito.any());
    }

    @Test
    void getManualReviewPage_throwsBadRequest_whenSizeIsUnsupported() {
        OnlineRetailCleaningQueryService queryService = Mockito.mock(
            OnlineRetailCleaningQueryService.class
        );
        OnlineRetailCleaningDataController controller = createController(queryService);

        ResponseStatusException exception = assertThrows(
            ResponseStatusException.class,
            () -> controller.getManualReviewPage(0, 10, null)
        );

        // Unsupported sizes are rejected before the query layer is called.
        assertEquals(400, exception.getStatusCode().value());
        Mockito.verifyNoInteractions(queryService);
    }

    @Test
    void getManualReviewPage_returnsRequestedSize_whenSupported() {
        OnlineRetailCleaningQueryService queryService = Mockito.mock(
            OnlineRetailCleaningQueryService.class
        );
        PagedResponse<ManualReviewItem> page = new PagedResponse<>(
            List.of(
                new ManualReviewItem(
                    1,
                    11,
                    "REJECTED",
                    "Missing fields",
                    "Quantity invalid",
                    "{}",
                    null,
                    Instant.parse("2026-03-07T00:00:00Z"),
                    Instant.parse("2026-03-07T00:00:00Z")
                )
            ),
            1,
            25,
            26,
            2,
            true,
            false
        );

        Mockito.when(queryService.getManualReviewPage(1, 25, null)).thenReturn(page);

        OnlineRetailCleaningDataController controller = createController(queryService);

        ResponseEntity<PagedResponse<ManualReviewItem>> response =
            controller.getManualReviewPage(1, 25, null);

        assertEquals(200, response.getStatusCodeValue());
        assertEquals(25, response.getBody().size());
        assertEquals(1, response.getBody().page());
        Mockito.verify(queryService).getManualReviewPage(1, 25, null);
    }

    @Test
    void getManualReviewPage_passesReviewStatusFilterToQueryService() {
        // Confirms optional query param is forwarded unchanged to service layer.
        OnlineRetailCleaningQueryService queryService = Mockito.mock(
            OnlineRetailCleaningQueryService.class
        );
        PagedResponse<ManualReviewItem> page = new PagedResponse<>(
            List.of(),
            0,
            15,
            2,
            1,
            false,
            false
        );

        Mockito.when(queryService.getManualReviewPage(0, 15, "REJECTED")).thenReturn(page);

        OnlineRetailCleaningDataController controller = createController(queryService);

        ResponseEntity<PagedResponse<ManualReviewItem>> response =
            controller.getManualReviewPage(0, 15, "REJECTED");

        assertEquals(200, response.getStatusCodeValue());
        Mockito.verify(queryService).getManualReviewPage(0, 15, "REJECTED");
    }

    @Test
    void getDirtyDataPage_usesDefaultPageSize_whenSizeNotProvided() {
        // Dirty endpoint should follow same default page-size rule as other tabs.
        OnlineRetailCleaningQueryService queryService = Mockito.mock(
            OnlineRetailCleaningQueryService.class
        );
        PagedResponse<DirtyRetailDataItem> page = new PagedResponse<>(
            List.of(
                new DirtyRetailDataItem(
                    1,
                    "INV",
                    "SC",
                    "Item",
                    "2",
                    "2020-01-01 00:00",
                    "9.99",
                    "123",
                    "UK"
                )
            ),
            0,
            15,
            1,
            1,
            false,
            false
        );

        Mockito.when(queryService.getDirtyDataPage(0, 15)).thenReturn(page);

        OnlineRetailCleaningDataController controller = createController(queryService);

        ResponseEntity<PagedResponse<DirtyRetailDataItem>> response =
            controller.getDirtyDataPage(0, null);

        assertEquals(200, response.getStatusCodeValue());
        assertEquals(15, response.getBody().size());
        Mockito.verify(queryService).getDirtyDataPage(0, 15);
    }

    @Test
    void getCleanedDataPage_throwsBadRequest_whenPageNegative() {
        OnlineRetailCleaningQueryService queryService = Mockito.mock(
            OnlineRetailCleaningQueryService.class
        );
        OnlineRetailCleaningDataController controller = createController(queryService);

        ResponseStatusException exception = assertThrows(
            ResponseStatusException.class,
            () -> controller.getCleanedDataPage(-1, 15)
        );

        // Negative pages should be rejected consistently for both endpoints.
        assertEquals(400, exception.getStatusCode().value());
        Mockito.verifyNoInteractions(queryService);
    }

    private static OnlineRetailCleaningDataController createController(
        OnlineRetailCleaningQueryService queryService
    ) {
        return new OnlineRetailCleaningDataController(
            queryService,
            Mockito.mock(OnlineRetailCleaningExportService.class)
        );
    }

    private static OnlineRetailCleaningDataController createController(
        OnlineRetailCleaningQueryService queryService,
        OnlineRetailCleaningExportService exportService
    ) {
        return new OnlineRetailCleaningDataController(queryService, exportService);
    }
}
