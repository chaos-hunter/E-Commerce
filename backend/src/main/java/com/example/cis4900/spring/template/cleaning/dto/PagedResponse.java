package com.example.cis4900.spring.template.cleaning.dto;

import java.util.List;

/**
 * Generic page wrapper returned by listing endpoints.
 *
 * <p>Includes the current slice of entries plus metadata needed by
 * frontend pagination controls.
 */
public record PagedResponse<T>(
    List<T> entries,
    int page,
    int size,
    long totalEntries,
    int totalPages,
    boolean hasPrevious,
    boolean hasNext
) {}
