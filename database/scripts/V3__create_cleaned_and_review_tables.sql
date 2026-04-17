CREATE TABLE IF NOT EXISTS cleaned_online_retail_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    raw_data_id INT NOT NULL,
    Invoice VARCHAR(20) NOT NULL,
    StockCode VARCHAR(20) NULL,
    Description TEXT NULL,
    Quantity INT NOT NULL,
    InvoiceDate DATETIME NOT NULL,
    Price DECIMAL(10, 2) NOT NULL,
    CustomerID INT NULL,
    Country VARCHAR(100) NULL,
    is_return BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_cleaned_raw_data UNIQUE (raw_data_id)
);

CREATE TABLE IF NOT EXISTS online_retail_manual_review (
    id INT AUTO_INCREMENT PRIMARY KEY,
    raw_data_id INT NOT NULL,
    review_status VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL,
    validation_errors TEXT NULL,
    raw_values LONGTEXT NULL,
    cleaned_values LONGTEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT uq_manual_review_raw_data UNIQUE (raw_data_id)
);
