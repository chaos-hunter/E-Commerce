package com.example.cis4900.spring.template.ingest.service;

import org.springframework.stereotype.Component;
import com.example.cis4900.spring.template.ingest.model.DirtyData;

@Component
public class DirtyDataMapper {
    // Method to map an array of strings to a DirtyData object
    public DirtyData map(String[] values) {
        return new DirtyData(getSafeValue(values, 0),
            getSafeValue(values, 1),
            getSafeValue(values, 2),
            getSafeValue(values, 3),
            getSafeValue(values, 4),
            getSafeValue(values, 5),
            getSafeValue(values, 6),
            getSafeValue(values, 7)
        );
    }

    // Helper method to safely get a value from the array, returning an empty string if the index is out of bounds
    public String getSafeValue(String[] values, int index) {
        if (values.length <= index || values [index] == null || values[index].isEmpty()) {
            return "";
        } else {
            return values[index];
        }
    }
}
