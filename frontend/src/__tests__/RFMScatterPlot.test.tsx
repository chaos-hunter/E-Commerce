import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RFMScatterPlot } from '../components/RFMScatterPlot';
import '@testing-library/jest-dom';
import React from 'react';

// Mock recharts — jsdom has no SVG layout engine so ResponsiveContainer
// would render nothing without this.
jest.mock('recharts', () => {
    const Recharts = jest.requireActual('recharts');
    return {
        ...Recharts,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
            <div data-testid="responsive-container">{children}</div>
        ),
    };
});

// Mock the global fetch API
global.fetch = jest.fn() as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockRfmData = [
    { customerId: 'C001', recency: 10,  frequency: 5,  monetary: 500.0,  country: 'United Kingdom', bubbleSize: 22.4 },
    { customerId: 'C002', recency: 45,  frequency: 2,  monetary: 120.0,  country: 'Germany',        bubbleSize: 10.9 },
    { customerId: 'C003', recency: 200, frequency: 1,  monetary: 30.0,   country: null,             bubbleSize: 5.5  },
];

const mockFetchSuccess = (data = mockRfmData) => {
    (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => data,
    });
};

const mockFetchError = (status = 500, statusText = 'Internal Server Error') => {
    (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status,
        statusText,
    });
};

const mockFetchNetworkFailure = () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network Error'));
};

/** Fill in dates and click Apply */
const applyFilters = async (start = '2020-01-01', end = '2021-01-01', country = '') => {
    fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: start } });
    fireEvent.change(screen.getByLabelText(/End Date/i),   { target: { value: end   } });
    if (country) {
        fireEvent.change(screen.getByPlaceholderText(/e.g. United Kingdom/i), { target: { value: country } });
    }
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    });
};

// tests
describe('RFMScatterPlot Component Unit Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    //  Initial render 

    test('renders the filter controls on mount', () => {
        render(<RFMScatterPlot />);
        expect(screen.getByText(/RFM Customer Scatter Plot/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/e.g. United Kingdom/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Apply/i })).toBeInTheDocument();
    });

    test('shows the empty state prompt before any fetch', () => {
        render(<RFMScatterPlot />);
        expect(screen.getByText(/Select a date range and click Apply/i)).toBeInTheDocument();
    });

    test('Apply button is disabled when dates are missing', () => {
        render(<RFMScatterPlot />);
        expect(screen.getByRole('button', { name: /Apply/i })).toBeDisabled();
    });

    test('Apply button is enabled once both dates are filled', () => {
        render(<RFMScatterPlot />);
        fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2020-01-01' } });
        fireEvent.change(screen.getByLabelText(/End Date/i),   { target: { value: '2021-01-01' } });
        expect(screen.getByRole('button', { name: /Apply/i })).not.toBeDisabled();
    });

    //  Props pre-fill 

    test('pre-fills date inputs from initialStartDate / initialEndDate props', () => {
        render(<RFMScatterPlot initialStartDate="2020-06-01" initialEndDate="2021-06-01" />);
        expect(screen.getByLabelText(/Start Date/i)).toHaveValue('2020-06-01');
        expect(screen.getByLabelText(/End Date/i)).toHaveValue('2021-06-01');
    });

    test('pre-fills country input from initialCountry prop', () => {
        render(<RFMScatterPlot initialCountry="Germany" />);
        expect(screen.getByPlaceholderText(/e.g. United Kingdom/i)).toHaveValue('Germany');
    });

    //  Successful fetch 

    test('renders the scatter chart after a successful fetch', async () => {
        mockFetchSuccess();
        render(<RFMScatterPlot />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        });
    });

    test('displays summary stat cards after data loads', async () => {
        mockFetchSuccess();
        render(<RFMScatterPlot />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText('Customers')).toBeInTheDocument();
            expect(screen.getByText('Avg Recency (days)')).toBeInTheDocument();
            expect(screen.getByText('Avg Frequency')).toBeInTheDocument();
            expect(screen.getByText('Avg Monetary')).toBeInTheDocument();
        });
    });

    test('stat card shows correct customer count', async () => {
        mockFetchSuccess();
        render(<RFMScatterPlot />);
        await applyFilters();
        await waitFor(() => {
            // mockRfmData has 3 entries
            expect(screen.getByText('3')).toBeInTheDocument();
        });
    });

    test('renders the legend after data loads', async () => {
        mockFetchSuccess();
        render(<RFMScatterPlot />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText(/Low monetary/i)).toBeInTheDocument();
            expect(screen.getByText(/Mid monetary/i)).toBeInTheDocument();
            expect(screen.getByText(/High monetary/i)).toBeInTheDocument();
            expect(screen.getByText(/Small bubble = low spend/i)).toBeInTheDocument();
            expect(screen.getByText(/Large bubble = high spend/i)).toBeInTheDocument();
        });
    });

    //  Empty results 

    test('shows empty state message when API returns no data', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
        render(<RFMScatterPlot />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText(/No customers found for this filter combination/i)).toBeInTheDocument();
        });
    });

    //  API error handling 

    test('displays an error banner when the server returns a non-OK response', async () => {
        mockFetchError(500, 'Internal Server Error');
        render(<RFMScatterPlot />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText(/Server error 500/i)).toBeInTheDocument();
        });
    });

    test('displays an error banner on network failure', async () => {
        mockFetchNetworkFailure();
        render(<RFMScatterPlot />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
        });
    });

    test('clears a previous error when a subsequent fetch succeeds', async () => {
        mockFetchError();
        render(<RFMScatterPlot />);
        await applyFilters();
        await waitFor(() => expect(screen.getByText(/Server error/i)).toBeInTheDocument());

        mockFetchSuccess();
        await applyFilters('2020-02-01', '2021-02-01');
        await waitFor(() => {
            expect(screen.queryByText(/Server error/i)).not.toBeInTheDocument();
        });
    });

    //  Fetch request shape 

    test('sends startDate and endDate as ISO datetime strings in the request URL', async () => {
        mockFetchSuccess();
        render(<RFMScatterPlot />);
        await applyFilters('2020-01-01', '2020-12-31');
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('startDate=2020-01-01T00%3A00%3A00')
            );
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('endDate=2020-12-31T23%3A59%3A59')
            );
        });
    });

    test('includes country param in request when country is entered', async () => {
        mockFetchSuccess();
        render(<RFMScatterPlot />);
        await applyFilters('2020-01-01', '2021-01-01', 'Germany');
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('country=Germany')
            );
        });
    });

    test('omits country param when country field is empty', async () => {
        mockFetchSuccess();
        render(<RFMScatterPlot />);
        await applyFilters('2020-01-01', '2021-01-01');
        await waitFor(() => {
            const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
            expect(url).not.toContain('country=');
        });
    });

    //  Loading state 

    test('shows loading text while fetch is in progress', async () => {
        // Never resolve so we can inspect the loading state
        (global.fetch as jest.Mock).mockImplementation(() => new Promise(jest.fn()));
        render(<RFMScatterPlot />);
        fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2020-01-01' } });
        fireEvent.change(screen.getByLabelText(/End Date/i),   { target: { value: '2021-01-01' } });
        fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
        expect(screen.getByRole('button', { name: /Loading/i })).toBeInTheDocument();
        expect(screen.getByText(/Fetching RFM data/i)).toBeInTheDocument();
    });

    test('Apply button is disabled while loading', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => new Promise(jest.fn()));
        render(<RFMScatterPlot />);
        fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2020-01-01' } });
        fireEvent.change(screen.getByLabelText(/End Date/i),   { target: { value: '2021-01-01' } });
        fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
        expect(screen.getByRole('button', { name: /Loading/i })).toBeDisabled();
    });
});