import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataIngestion } from '../DataIngestion';
import '@testing-library/jest-dom';

// Mock the global fetch API
global.fetch = jest.fn() as jest.Mock;

// Mock RFMScatterPlot so tests don't need recharts/fetch wiring for it
jest.mock('../components/RFMScatterPlot', () => ({
    RFMScatterPlot: ({
        initialStartDate,
        initialEndDate,
        initialCountry,
    }: {
        initialStartDate?: string;
        initialEndDate?: string;
        initialCountry?: string;
    }) => (
        <div data-testid="rfm-scatter-plot">
            <span data-testid="rfm-start">{initialStartDate}</span>
            <span data-testid="rfm-end">{initialEndDate}</span>
            <span data-testid="rfm-country">{initialCountry}</span>
        </div>
    ),
}));

// mock RFMHistogram to verify it gets rendered and receives the correct props 
jest.mock('../components/RFMHistogram', () => ({
    RFMHistogram: ({
        initialStartDate,
        initialEndDate,
        initialCountry,
    }: {
        initialStartDate?: string;
        initialEndDate?: string;
        initialCountry?: string;
    }) => (
        <div data-testid="rfm-histogram">
            <span data-testid="rfm-histogram-start">{initialStartDate}</span>
            <span data-testid="rfm-histogram-end">{initialEndDate}</span>
            <span data-testid="rfm-histogram-country">{initialCountry}</span>
        </div>
    ),
}));

// mock RS Pie chart
jest.mock('../components/RevenueSharePC', () => ({
    RevenueSharePC: ({
        initialStartDate,
        initialEndDate,
        initialCountry,
    }: {
        initialStartDate?: string;
        initialEndDate?: string;
        initialCountry?: string;
    }) => (
        <div data-testid="revenue-share-pc">
            <span data-testid="rs-start">{initialStartDate}</span>
            <span data-testid="rs-end">{initialEndDate}</span>
            <span data-testid="rs-country">{initialCountry}</span>
        </div>
    ),
}));

describe('DataIngestion Component Unit Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup a mock for window.alert
        window.alert = jest.fn();
    });

    // HELPER 
    const simulateFileUpload = async (input: HTMLElement, file: File) => {
        await act(async () => {
            Object.defineProperty(input, 'files', { value: [file], configurable: true });
            fireEvent.change(input);
        });
        const uploadBtn = screen.getByRole('button', { name: /Upload and Clean Data/i });
        await waitFor(() => expect(uploadBtn).not.toBeDisabled());
    };

    // Helper to go through the full flow to results with provided mock data for results
    const goToResults = async (mockData: object) => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => mockData,
        });
        render(<DataIngestion />);
        const file = new File(['test'], 'test.csv', { type: 'text/csv' });
        const input = screen.getByLabelText(/Select Data File:/i);
        await simulateFileUpload(input, file);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload and Clean Data/i }));
        });
        await waitFor(() => expect(screen.getByText(/Results/i)).toBeInTheDocument());
    };

    // Initial Render
    test('renders the upload form by default', () => {
        render(<DataIngestion />);
        expect(screen.getByText(/File Upload \(.csv or .xlsx\)/i)).toBeInTheDocument();
    });

    // test for export logic - covers handleExport function
    test('calls alert when export button is clicked', async () => {
        const mockData = {
            entries: [{ invoice: '123', stockCode: 'ABC', description: 'T', quantity: 1, unitPrice: 10, customerId: 'C1', country: 'UK' }],
            totalEntries: 1,
            status: 'COMPLETED'
        };

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => (mockData)
        });

        render(<DataIngestion />);

        const file = new File(['test'], 'test.csv', { type: 'text/csv' });
        const input = screen.getByLabelText(/Select Data File:/i);

        await simulateFileUpload(input, file);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload and Clean Data/i }));
        });

        await waitFor(() => expect(screen.getByText(/Results/i)).toBeInTheDocument());

        const exportBtn = screen.getByRole('button', { name: /Download Cleaned Data/i });
        fireEvent.click(exportBtn);
        await waitFor(() => {
            // Ensure export now uses representation query against cleaned collection.
            expect(global.fetch).toHaveBeenCalledWith('/api/cleaning-data/cleaned?format=xlsx');
        });
    });

    // test for pagination - covers handlePageChange and fetchResults
    test('updates data when Next page is clicked', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ entries: [], totalEntries: 50, status: 'COMPLETED' })
        });

        render(<DataIngestion />);

        const file = new File(['test'], 'test.csv', { type: 'text/csv' });
        const input = screen.getByLabelText(/Select Data File:/i);

        await simulateFileUpload(input, file);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload and Clean Data/i }));
        });

        await waitFor(() => expect(screen.getByText(/Results/i)).toBeInTheDocument());

        const nextBtn = screen.getByRole('button', { name: /Next/i });
        await act(async () => {
            fireEvent.click(nextBtn);
        });

        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('page=1'));
    });

    // Tab Navigation Logic
    test('switches between Results tabs correctly', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ entries: [], totalEntries: 0, status: 'COMPLETED' })
        });

        render(<DataIngestion />);

        const file = new File(['test'], 'test.csv', { type: 'text/csv' });
        const input = screen.getByLabelText(/Select Data File:/i);

        await simulateFileUpload(input, file);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload and Clean Data/i }));
        });

        await waitFor(() => expect(screen.getByText(/Results/i)).toBeInTheDocument());

        const invalidTab = screen.getByRole('button', { name: /Invalid Items/i });
        fireEvent.click(invalidTab);
        expect(screen.getByText(/Could not clean \/ ERROR/i)).toBeInTheDocument();
    });

    // Mocking a successful data ingestion flow
    test('transitions to processing then results on successful upload', async () => {
        // mock every fetch call that happens in the sequence
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({ ok: true, text: async () => 'Upload Success' }) // Upload POST
            .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: '123' }) }) //  Cleaning POST
            .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'COMPLETED' }) }) // Polling status
            .mockResolvedValue({ // fetchResults (Multi calls happen here for Clean, Invalid, Dirty)
                ok: true, 
                json: async () => ({ entries: [], totalEntries: 0, status: 'COMPLETED' }) 
            });

        render(<DataIngestion />);
        const file = new File(['invoice,price\n1,10.0'], 'test.csv', { type: 'text/csv' });
        const input = screen.getByLabelText(/Select Data File:/i);
        await simulateFileUpload(input, file);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload and Clean Data/i }));
        });

        expect(screen.getByText(/Processing.../i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText(/Results/i)).toBeInTheDocument();
        }, { timeout: 5000 });
    });

    // Error Handling
    test('alerts user and reverts to upload step if API fails', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network Error'));

        render(<DataIngestion />);
        const file = new File(['test'], 'test.csv', { type: 'text/csv' });
        const input = screen.getByLabelText(/Select Data File:/i);
        await simulateFileUpload(input, file);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload and Clean Data/i }));
        });

        await waitFor(() => {
            expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Upload failed due to network error'));
            expect(screen.getByText(/File Upload \(.csv or .xlsx\)/i)).toBeInTheDocument();
        });
    });

    // provide mock data for all 3 tabs and clicking through them
    test('renders full data rows in all tabs', async () => {
        const mockFullData = {
            entries: [{
                invoice: 'INV001', stockCode: '85123A', description: 'TEST ITEM',
                quantity: 10, price: 2.5, customerId: '12345', country: 'UK',
                rawValues: JSON.stringify({ Invoice: 'INV001', Quantity: 10 }),
                reviewStatus: 'MANUAL_ERROR', reason: 'Missing Price'
            }],
            totalEntries: 1,
            status: 'COMPLETED'
        };

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => mockFullData
        });

        render(<DataIngestion />);

        const file = new File(['test'], 'test.csv', { type: 'text/csv' });
        const input = screen.getByLabelText(/Select Data File:/i);
        await simulateFileUpload(input, file);
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload and Clean Data/i }));
        });

        await waitFor(() => expect(screen.getByText(/Results/i)).toBeInTheDocument());

        expect(screen.getByText('INV001')).toBeInTheDocument();
        expect(screen.getByText('TEST ITEM')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Invalid Items/i }));
        expect(screen.getByText(/Missing Price/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Raw \/ Uncleaned Data/i }));
        expect(screen.getByText(/Uncleaned Raw Data/i)).toBeInTheDocument();
    });

    // cover previous button logic
    test('covers previous page logic', async () => {
        const mockData = {
            entries: [],
            totalEntries: 50,
            status: 'COMPLETED'
        };

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => mockData
        });

        render(<DataIngestion />);

        const file = new File(['test'], 'test.csv', { type: 'text/csv' });
        const input = screen.getByLabelText(/Select Data File:/i);

        await simulateFileUpload(input, file);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload and Clean Data/i }));
        });

        await waitFor(() => expect(screen.getByText(/Results/i)).toBeInTheDocument());

        const nextBtn = screen.getByRole('button', { name: /Next/i });
        await act(async () => {
            fireEvent.click(nextBtn);
        });

        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('page=1'));

        const prevBtn = screen.getByRole('button', { name: /Previous/i });
        expect(prevBtn).not.toBeDisabled();

        await act(async () => {
            fireEvent.click(prevBtn);
        });

        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('page=0'));
        expect(screen.getByText(/Page 1/i)).toBeInTheDocument();
    });

    test('renders dirty data rows to cover table mapping logic', async () => {
        render(<DataIngestion />);

        const file = new File(['invoice,price\n1,10.0'], 'test.csv', { type: 'text/csv' });
        const input = screen.getByLabelText(/Select Data File:/i);

        await simulateFileUpload(input, file);

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ entries: [], totalEntries: 0, status: 'COMPLETED' })
        });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Upload and Clean Data/i }));
        });

        await waitFor(() => expect(screen.getByText(/Results/i)).toBeInTheDocument());

        const dirtyTab = screen.getByRole('button', { name: /Raw \/ Uncleaned Data/i });
        fireEvent.click(dirtyTab);

        expect(screen.getByText(/Uncleaned Raw Data/i)).toBeInTheDocument();
    });

    // #75: NEW RFM tab tests to cover new implementation
    test('renders the RFM Scatter Plot tab button in results', async () => {
        await goToResults({ entries: [], totalEntries: 0, status: 'COMPLETED' });
        expect(screen.getByRole('button', { name: /RFM Scatter Plot/i })).toBeInTheDocument();
    });
 
    test('clicking RFM tab renders the RFMScatterPlot component', async () => {
        await goToResults({ entries: [], totalEntries: 0, status: 'COMPLETED' });
        fireEvent.click(screen.getByRole('button', { name: /RFM Scatter Plot/i }));
        expect(screen.getByTestId('rfm-scatter-plot')).toBeInTheDocument();
    });
 
    test('passes derived date range from clean data to RFMScatterPlot', async () => {
        const mockData = {
            entries: [
                { invoice: 'INV001', invoiceDate: '2020-03-15T00:00:00', country: 'United Kingdom' },
                { invoice: 'INV002', invoiceDate: '2021-11-20T00:00:00', country: 'United Kingdom' },
            ],
            totalEntries: 2,
            status: 'COMPLETED',
        };
        await goToResults(mockData);
 
        fireEvent.click(screen.getByRole('button', { name: /RFM Scatter Plot/i }));
 
        await waitFor(() => {
            expect(screen.getByTestId('rfm-start')).toHaveTextContent('2020-03-15');
            expect(screen.getByTestId('rfm-end')).toHaveTextContent('2021-11-20');
        });
    });
 
    test('passes most common country from clean data to RFMScatterPlot', async () => {
        const mockData = {
            entries: [
                { invoice: 'INV001', invoiceDate: '2020-01-01T00:00:00', country: 'Germany' },
                { invoice: 'INV002', invoiceDate: '2020-02-01T00:00:00', country: 'Germany' },
                { invoice: 'INV003', invoiceDate: '2020-03-01T00:00:00', country: 'France' },
            ],
            totalEntries: 3,
            status: 'COMPLETED',
        };
        await goToResults(mockData);
 
        fireEvent.click(screen.getByRole('button', { name: /RFM Scatter Plot/i }));
 
        await waitFor(() => {
            // Germany appears twice vs France once — should be passed as initialCountry
            expect(screen.getByTestId('rfm-country')).toHaveTextContent('Germany');
        });
    });
 
    test('passes empty strings to RFMScatterPlot when clean data has no dates', async () => {
        const mockData = {
            entries: [
                { invoice: 'INV001', invoiceDate: undefined, country: 'UK' },
            ],
            totalEntries: 1,
            status: 'COMPLETED',
        };
        await goToResults(mockData);
 
        fireEvent.click(screen.getByRole('button', { name: /RFM Scatter Plot/i }));
 
        await waitFor(() => {
            expect(screen.getByTestId('rfm-start')).toHaveTextContent('');
            expect(screen.getByTestId('rfm-end')).toHaveTextContent('');
        });
    });
 
    test('switching away from RFM tab and back still renders the component', async () => {
        await goToResults({ entries: [], totalEntries: 0, status: 'COMPLETED' });
 
        fireEvent.click(screen.getByRole('button', { name: /RFM Scatter Plot/i }));
        expect(screen.getByTestId('rfm-scatter-plot')).toBeInTheDocument();
 
        fireEvent.click(screen.getByRole('button', { name: /Invalid Items/i }));
        expect(screen.queryByTestId('rfm-scatter-plot')).not.toBeInTheDocument();
 
        fireEvent.click(screen.getByRole('button', { name: /RFM Scatter Plot/i }));
        expect(screen.getByTestId('rfm-scatter-plot')).toBeInTheDocument();
    });

    test('handles clean data with mixed valid and invalid date formats', async () => {
        const mockData = {
            entries: [
                { invoice: 'INV001', invoiceDate: '2021-06-01T00:00:00', country: 'UK' },
                { invoice: 'INV002', invoiceDate: 'not-a-date',           country: 'UK' },
                { invoice: 'INV003', invoiceDate: null,                   country: 'UK' },
            ],
            totalEntries: 3,
            status: 'COMPLETED',
        };
        await goToResults(mockData);
 
        fireEvent.click(screen.getByRole('button', { name: /RFM Scatter Plot/i }));
 
        await waitFor(() => {
            // Only the valid date should be used for both start and end
            expect(screen.getByTestId('rfm-start')).toHaveTextContent('2021-06-01');
            expect(screen.getByTestId('rfm-end')).toHaveTextContent('2021-06-01');
        });
    });
 
    test('handles clean data where no entries have a country', async () => {
        const mockData = {
            entries: [
                { invoice: 'INV001', invoiceDate: '2021-01-01T00:00:00', country: null },
                { invoice: 'INV002', invoiceDate: '2021-06-01T00:00:00', country: null },
            ],
            totalEntries: 2,
            status: 'COMPLETED',
        };
        await goToResults(mockData);
 
        fireEvent.click(screen.getByRole('button', { name: /RFM Scatter Plot/i }));
 
        await waitFor(() => {
            // No country should be passed — rfm-country span should be empty
            expect(screen.getByTestId('rfm-country')).toHaveTextContent('');
        });
    });

    // #95: NEW RFM Histogram tab tests

    test('renders the RFM Histograms tab button in results', async () => {
        await goToResults({ entries: [], totalEntries: 0, status: 'COMPLETED' });
        expect(screen.getByRole('button', { name: /RFM Histograms/i })).toBeInTheDocument();
    });

    test('clicking RFM Histograms tab renders the RFMHistogram component', async () => {
        await goToResults({ entries: [], totalEntries: 0, status: 'COMPLETED' });
        fireEvent.click(screen.getByRole('button', { name: /RFM Histograms/i }));
        expect(screen.getByTestId('rfm-histogram')).toBeInTheDocument();
    });

    test('passes derived date range from clean data to RFMHistogram', async () => {
        const mockData = {
            entries: [
                { invoice: 'INV001', invoiceDate: '2020-03-15T00:00:00', country: 'United Kingdom' },
                { invoice: 'INV002', invoiceDate: '2021-11-20T00:00:00', country: 'United Kingdom' },
            ],
            totalEntries: 2,
            status: 'COMPLETED',
        };
        await goToResults(mockData);

        fireEvent.click(screen.getByRole('button', { name: /RFM Histograms/i }));

        await waitFor(() => {
            expect(screen.getByTestId('rfm-histogram-start')).toHaveTextContent('2020-03-15');
            expect(screen.getByTestId('rfm-histogram-end')).toHaveTextContent('2021-11-20');
        });
    });

    test('passes most common country from clean data to RFMHistogram', async () => {
        const mockData = {
            entries: [
                { invoice: 'INV001', invoiceDate: '2020-01-01T00:00:00', country: 'Germany' },
                { invoice: 'INV002', invoiceDate: '2020-02-01T00:00:00', country: 'Germany' },
                { invoice: 'INV003', invoiceDate: '2020-03-01T00:00:00', country: 'France' },
            ],
            totalEntries: 3,
            status: 'COMPLETED',
        };
        await goToResults(mockData);

        fireEvent.click(screen.getByRole('button', { name: /RFM Histograms/i }));

        await waitFor(() => {
            expect(screen.getByTestId('rfm-histogram-country')).toHaveTextContent('Germany');
        });
    });

    test('switching away from RFM Histograms tab and back still renders the component', async () => {
        await goToResults({ entries: [], totalEntries: 0, status: 'COMPLETED' });

        fireEvent.click(screen.getByRole('button', { name: /RFM Histograms/i }));
        expect(screen.getByTestId('rfm-histogram')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Invalid Items/i }));
        expect(screen.queryByTestId('rfm-histogram')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /RFM Histograms/i }));
        expect(screen.getByTestId('rfm-histogram')).toBeInTheDocument();
    });

    test('RFM Histogram and RFM Scatter Plot tabs are independent', async () => {
        await goToResults({ entries: [], totalEntries: 0, status: 'COMPLETED' });

        fireEvent.click(screen.getByRole('button', { name: /RFM Scatter Plot/i }));
        expect(screen.getByTestId('rfm-scatter-plot')).toBeInTheDocument();
        expect(screen.queryByTestId('rfm-histogram')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /RFM Histograms/i }));
        expect(screen.getByTestId('rfm-histogram')).toBeInTheDocument();
        expect(screen.queryByTestId('rfm-scatter-plot')).not.toBeInTheDocument();
    });

    // REVENUE SHARE PIE CHART TAB
 
    test('renders the RS Pie Chart tab button in results', async () => {
        await goToResults({ entries: [], totalEntries: 0, status: 'COMPLETED' });
        expect(screen.getByRole('button', { name: /RS Pie Chart/i })).toBeInTheDocument();
    });
 
    test('clicking RS Pie Chart tab renders the RevenueSharePC component', async () => {
        await goToResults({ entries: [], totalEntries: 0, status: 'COMPLETED' });
        fireEvent.click(screen.getByRole('button', { name: /RS Pie Chart/i }));
        expect(screen.getByTestId('revenue-share-pc')).toBeInTheDocument();
    });
 
    test('passes derived date range from clean data to RevenueSharePC', async () => {
        const mockData = {
            entries: [
                { invoice: 'INV001', invoiceDate: '2020-03-15T00:00:00', country: 'United Kingdom' },
                { invoice: 'INV002', invoiceDate: '2021-11-20T00:00:00', country: 'United Kingdom' },
            ],
            totalEntries: 2,
            status: 'COMPLETED',
        };
        await goToResults(mockData);
        fireEvent.click(screen.getByRole('button', { name: /RS Pie Chart/i }));
        await waitFor(() => {
            expect(screen.getByTestId('rs-start')).toHaveTextContent('2020-03-15');
            expect(screen.getByTestId('rs-end')).toHaveTextContent('2021-11-20');
        });
    });
 
    test('passes most common country to RevenueSharePC', async () => {
        const mockData = {
            entries: [
                { invoice: 'INV001', invoiceDate: '2020-01-01T00:00:00', country: 'Germany' },
                { invoice: 'INV002', invoiceDate: '2020-02-01T00:00:00', country: 'Germany' },
                { invoice: 'INV003', invoiceDate: '2020-03-01T00:00:00', country: 'France' },
            ],
            totalEntries: 3,
            status: 'COMPLETED',
        };
        await goToResults(mockData);
        fireEvent.click(screen.getByRole('button', { name: /RS Pie Chart/i }));
        await waitFor(() => {
            expect(screen.getByTestId('rs-country')).toHaveTextContent('Germany');
        });
    });
 
    test('switching away from RS Pie Chart tab and back re-renders the component', async () => {
        await goToResults({ entries: [], totalEntries: 0, status: 'COMPLETED' });
        fireEvent.click(screen.getByRole('button', { name: /RS Pie Chart/i }));
        expect(screen.getByTestId('revenue-share-pc')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Invalid Items/i }));
        expect(screen.queryByTestId('revenue-share-pc')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /RS Pie Chart/i }));
        expect(screen.getByTestId('revenue-share-pc')).toBeInTheDocument();
    });
 
    // ── deriveDateRange edge cases ──
 
    test('handles clean data with mixed valid and invalid date formats', async () => {
        const mockData = {
            entries: [
                { invoice: 'INV001', invoiceDate: '2021-06-01T00:00:00', country: 'UK' },
                { invoice: 'INV002', invoiceDate: 'not-a-date',           country: 'UK' },
                { invoice: 'INV003', invoiceDate: null,                   country: 'UK' },
            ],
            totalEntries: 3,
            status: 'COMPLETED',
        };
        await goToResults(mockData);
        fireEvent.click(screen.getByRole('button', { name: /RFM Scatter Plot/i }));
        await waitFor(() => {
            expect(screen.getByTestId('rfm-start')).toHaveTextContent('2021-06-01');
            expect(screen.getByTestId('rfm-end')).toHaveTextContent('2021-06-01');
        });
    });
 
    test('handles clean data where no entries have a country', async () => {
        const mockData = {
            entries: [
                { invoice: 'INV001', invoiceDate: '2021-01-01T00:00:00', country: null },
                { invoice: 'INV002', invoiceDate: '2021-06-01T00:00:00', country: null },
            ],
            totalEntries: 2,
            status: 'COMPLETED',
        };
        await goToResults(mockData);
        fireEvent.click(screen.getByRole('button', { name: /RFM Scatter Plot/i }));
        await waitFor(() => {
            expect(screen.getByTestId('rfm-country')).toHaveTextContent('');
        });
    });

});