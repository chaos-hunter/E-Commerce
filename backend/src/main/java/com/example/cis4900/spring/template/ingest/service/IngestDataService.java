package com.example.cis4900.spring.template.ingest.service;

import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Iterator;

import javax.xml.parsers.ParserConfigurationException;

import org.apache.poi.ooxml.util.SAXHelper;
import org.apache.poi.openxml4j.exceptions.OpenXML4JException;
import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.util.IOUtils;
import org.apache.poi.util.RecordFormatException;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.xssf.eventusermodel.ReadOnlySharedStringsTable;
import org.apache.poi.xssf.eventusermodel.XSSFReader;
import org.apache.poi.xssf.eventusermodel.XSSFSheetXMLHandler;
import org.apache.poi.xssf.model.StylesTable;
import org.apache.poi.xssf.usermodel.XSSFComment;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.Nullable;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;
import org.xml.sax.XMLReader;

import com.example.cis4900.spring.template.ingest.model.DirtyData;
import com.example.cis4900.spring.template.ingest.repository.DirtyDataRepository;
import com.opencsv.CSVReader;

import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;


@Service
public class IngestDataService {
    private static final Logger LOGGER = LoggerFactory.getLogger(IngestDataService.class);
    private static final int SAVE_BATCH_SIZE = 5_000;
    private static final int EXPECTED_COLUMNS = 8;
    private static final int XLSX_BYTE_ARRAY_OVERRIDE = 300_000_000;

    //auto injects the dirtyDataRepository into the service
    private final DirtyDataRepository dirtyDataRepository;
    private final EntityManager entityManager;
    private final DataFormatter dataFormatter = new DataFormatter();
    private final DirtyDataMapper dirtyDataMapper;

    public IngestDataService(DirtyDataRepository dirtyDataRepository, @Nullable EntityManager entityManager, DirtyDataMapper dirtyDataMapper) {
        this.dirtyDataRepository = dirtyDataRepository;
        this.entityManager = entityManager;
        this.dirtyDataMapper = dirtyDataMapper;
    }

    @Transactional
    public void processFile(MultipartFile file) {
        // file processing, e.g. read CSV and save to database
        String fileName = file.getOriginalFilename();
        String normalizedFileName = fileName == null ? null : fileName.toLowerCase();
        //check if correct file type has no information
        if (fileName == null || file.isEmpty() || fileName.trim().isEmpty()) {
            throw new IllegalArgumentException("File is empty");
        }
        LOGGER.info("Starting file ingest: fileName='{}', sizeBytes={}", fileName, file.getSize());
        //check if file type is supported (csv or xlsx)
        if (normalizedFileName.endsWith(".csv")) {
            LOGGER.info("Detected CSV ingest path for fileName='{}'", fileName);
            processCsv(file);
        } else if (normalizedFileName.endsWith(".xlsx")) {
            LOGGER.info("Detected XLSX ingest path for fileName='{}'", fileName);
            processXlsx(file);
        } else {
            throw new IllegalArgumentException("Unsupported file type: " + fileName);
        }
        LOGGER.info("Finished file ingest: fileName='{}'", fileName);
    }

    private void processCsv(MultipartFile file) {
        List<DirtyData> batch = new ArrayList<>(SAVE_BATCH_SIZE);
        int processedRows = 0;

        // Using OpenCSV to read the CSV file
        try (CSVReader reader = new CSVReader(new InputStreamReader(file.getInputStream()))) {
            String[] line;
            boolean isFirstLine = true;
            // Loop through each line in the CSV file and create DirtyData objects
            while ((line = reader.readNext()) != null) {
                //ignore header line since its not relevant data just column names
                if (isFirstLine) {
                    isFirstLine = false;
                    continue;
                }
                // Assuming CSV columns: id, name, value, timestamp
                DirtyData dirtyData = dirtyDataMapper.map(line);
                batch.add(dirtyData);
                processedRows++;

                if (batch.size() >= SAVE_BATCH_SIZE) {
                    // Persist periodically to avoid retaining the whole file in memory.
                    persistBatch(batch);
                    LOGGER.info("CSV ingest progress: processedRows={}", processedRows);
                }
            }
            persistBatch(batch);
            LOGGER.info("CSV ingest final row count: processedRows={}", processedRows);
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse CSV file", e);
        }

        //if parse is empty
        if (processedRows == 0) {
            throw new RuntimeException("CSV file is empty or only contains headers");
        }
    }

    private void processXlsx(MultipartFile file) {
        XlsxRowHandler rowHandler = new XlsxRowHandler();

        // Large workbooks can contain oversized zip/shared-string records.
        IOUtils.setByteArrayMaxOverride(XLSX_BYTE_ARRAY_OVERRIDE);
        LOGGER.info("XLSX ingest configured byte array override: {}", XLSX_BYTE_ARRAY_OVERRIDE);

        try (OPCPackage opcPackage = OPCPackage.open(file.getInputStream())) {
            ReadOnlySharedStringsTable sharedStrings = new ReadOnlySharedStringsTable(opcPackage);
            XSSFReader xssfReader = new XSSFReader(opcPackage);
            StylesTable styles = xssfReader.getStylesTable();

            Iterator<java.io.InputStream> sheets = xssfReader.getSheetsData();
            if (!sheets.hasNext()) {
                throw new RuntimeException("Excel file is empty or only contains headers");
            }

            // Parse every worksheet in the workbook
            while (sheets.hasNext()) {
                try (java.io.InputStream sheetStream = sheets.next()) {
                    // SAX parsing keeps memory bounded for very large spreadsheets.
                    XMLReader parser = SAXHelper.newXMLReader();
                    XSSFSheetXMLHandler handler = new XSSFSheetXMLHandler(
                        styles,
                        null,
                        sharedStrings,
                        rowHandler,
                        dataFormatter,
                        false
                    );

                    parser.setContentHandler(handler);
                    parser.parse(new InputSource(sheetStream));
                }
            }

            // Flush any rows still buffered after the final sheet
            rowHandler.flushRemaining();
        } catch (RecordFormatException e) {
            throw new IllegalArgumentException("Excel file is too large or malformed. Please upload a smaller valid .xlsx file.", e);
        } catch (OpenXML4JException | SAXException | ParserConfigurationException | IOException e) {
            throw new RuntimeException("Failed to parse Excel file", e);
        }
        
        //if parse is empty
        if (rowHandler.getProcessedRows() == 0) {
            throw new RuntimeException("Excel file is empty or only contains headers");
        }
        LOGGER.info("XLSX ingest final row count: processedRows={}", rowHandler.getProcessedRows());
    }

    private void persistBatch(List<DirtyData> batch) {
        if (batch.isEmpty()) {
            return;
        }

        try {
            // Save a copy so clearing the mutable buffer does not affect submitted entities.
            dirtyDataRepository.saveAll(new ArrayList<>(batch));
            dirtyDataRepository.flush();
            if (entityManager != null) {
                entityManager.clear();
            }
            batch.clear();
        } catch (DataAccessException e) {
            throw new RuntimeException("Failed to store parsed rows", e);
        }
    }

    private static int getColumnIndex(String cellReference) {
        if (cellReference == null || cellReference.isEmpty()) {
            return -1;
        }

        int column = 0;
        for (int i = 0; i < cellReference.length(); i++) {
            char c = cellReference.charAt(i);
            if (Character.isDigit(c)) {
                break;
            }
            column = (column * 26) + (Character.toUpperCase(c) - 'A' + 1);
        }
        return column - 1;
    }

    private class XlsxRowHandler implements XSSFSheetXMLHandler.SheetContentsHandler {
        private final List<DirtyData> batch = new ArrayList<>(SAVE_BATCH_SIZE);
        private String[] currentRowValues = new String[EXPECTED_COLUMNS];
        private int processedRows = 0;
        private int lastProgressLogAt = 0;

        @Override
        public void startRow(int rowNum) {
            currentRowValues = new String[EXPECTED_COLUMNS];
        }

        @Override
        public void endRow(int rowNum) {
            if (rowNum == 0) {
                // Skip header row.
                return;
            }

            DirtyData dirtyData = dirtyDataMapper.map(currentRowValues);

            batch.add(dirtyData);
            processedRows++;

            if (batch.size() >= SAVE_BATCH_SIZE) {
                persistBatch(batch);
            }

            if (processedRows - lastProgressLogAt >= 50_000) {
                LOGGER.info("XLSX ingest progress: processedRows={}", processedRows);
                lastProgressLogAt = processedRows;
            }
        }

        @Override
        public void cell(String cellReference, String formattedValue, XSSFComment comment) {
            int colIndex = getColumnIndex(cellReference);
            if (colIndex < 0 || colIndex >= EXPECTED_COLUMNS) {
                return;
            }
            currentRowValues[colIndex] = formattedValue;
        }

        @Override
        public void headerFooter(String text, boolean isHeader, String tagName) {
            // Not needed for ingestion.
        }

        public void flushRemaining() {
            persistBatch(batch);
        }

        public int getProcessedRows() {
            return processedRows;
        }
    }
}
