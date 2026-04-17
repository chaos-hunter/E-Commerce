import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RFMHistogram } from '../components/RFMHistogram';
import '@testing-library/jest-dom';
import React from 'react';

// mock recharts — jsdom has no SVG layout engine so ResponsiveContainer
// would render nothing without this
jest.mock('recharts', () => {
    const Recharts = jest.requireActual('recharts');
    return {
        ...Recharts,
        ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
            <div data-testid="responsive-container">{children}</div>
        ),
    };
});

// mock the global fetch API
global.fetch = jest.fn() as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockHistogramData = {
    basketSize: {
        summary: {
            invoiceCount: 120,
            average: 12.5,
            median: 10.0,
            p90: 25.0,
        },
        bins: [
            { rangeStart: 0, rangeEnd: 10, count: 60, isOutlier: false },
            { rangeStart: 10, rangeEnd: 20, count: 40, isOutlier: false },
            { rangeStart: 20, rangeEnd: 100, count: 20, isOutlier: true },
        ],
    },
    orderValue: {
        summary: {
            invoiceCount: 120,
            average: 85.75,
            median: 70.0,
            p90: 180.0,
        },
        bins: [
            { rangeStart: 0, rangeEnd: 50, count: 50, isOutlier: false },
            { rangeStart: 50, rangeEnd: 100, count: 45, isOutlier: false },
            { rangeStart: 100, rangeEnd: 500, count: 25, isOutlier: true },
        ],
    },
};

const mockEmptyHistogramData = {
    basketSize: {
        summary: { invoiceCount: 0, average: null, median: null, p90: null },
        bins: [],
    },
    orderValue: {
        summary: { invoiceCount: 0, average: null, median: null, p90: null },
        bins: [],
    },
};

const mockFetchSuccess = (data = mockHistogramData) => {
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

/** fill in dates and click Apply */
const applyFilters = async (start = '2020-01-01', end = '2021-01-01', country = '') => {
    fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: start } });
    fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: end } });
    if (country) {
        fireEvent.change(screen.getByPlaceholderText(/e.g. United Kingdom/i), { target: { value: country } });
    }
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    });
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RFMHistogram Component Unit Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // initial render

    test('renders the filter controls on mount', () => {
        render(<RFMHistogram />);
        expect(screen.getByText(/RFM Histograms/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/e.g. United Kingdom/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Apply/i })).toBeInTheDocument();
    });

    test('shows the empty state prompt before any fetch', () => {
        render(<RFMHistogram />);
        expect(screen.getByText(/Select a date range and click Apply/i)).toBeInTheDocument();
    });

    test('Apply button is disabled when dates are missing', () => {
        render(<RFMHistogram />);
        expect(screen.getByRole('button', { name: /Apply/i })).toBeDisabled();
    });

    test('Apply button is enabled once both dates are filled', () => {
        render(<RFMHistogram />);
        fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2020-01-01' } });
        fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: '2021-01-01' } });
        expect(screen.getByRole('button', { name: /Apply/i })).not.toBeDisabled();
    });

    // props pre-fill

    test('pre-fills date inputs from initialStartDate / initialEndDate props', () => {
        render(<RFMHistogram initialStartDate="2020-06-01" initialEndDate="2021-06-01" />);
        expect(screen.getByLabelText(/Start Date/i)).toHaveValue('2020-06-01');
        expect(screen.getByLabelText(/End Date/i)).toHaveValue('2021-06-01');
    });

    test('pre-fills country input from initialCountry prop', () => {
        render(<RFMHistogram initialCountry="Germany" />);
        expect(screen.getByPlaceholderText(/e.g. United Kingdom/i)).toHaveValue('Germany');
    });

    // successful fetch

    test('renders both histogram panels after a successful fetch', async () => {
        mockFetchSuccess();
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText('Basket Size')).toBeInTheDocument();
            expect(screen.getByText('Order Value')).toBeInTheDocument();
        });
    });

    test('renders responsive containers for both charts', async () => {
        mockFetchSuccess();
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getAllByTestId('responsive-container')).toHaveLength(2);
        });
    });

    test('displays summary stat cards for both histograms after data loads', async () => {
        mockFetchSuccess();
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => {
            // both panels render an invoices stat card
            expect(screen.getAllByText('Invoices')).toHaveLength(2);
            expect(screen.getAllByText('Average')).toHaveLength(2);
            expect(screen.getAllByText('Median')).toHaveLength(2);
            expect(screen.getAllByText('90th Percentile')).toHaveLength(2);
        });
    });

    test('displays correct invoice count in summary cards', async () => {
        mockFetchSuccess();
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => {
            // both basketSize and orderValue have invoiceCount 120
            expect(screen.getAllByText('120')).toHaveLength(2);
        });
    });

    test('shows N/A for null summary values on empty response', async () => {
        mockFetchSuccess(mockEmptyHistogramData);
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
        });
    });

    // empty results

    test('shows no data message when bins are empty', async () => {
        mockFetchSuccess(mockEmptyHistogramData);
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getAllByText(/No data for this filter/i)).toHaveLength(2);
        });
    });

    // outlier bins

    test('renders outlier legend when outlier bins are present', async () => {
        mockFetchSuccess();
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getAllByText(/Outlier bucket/i).length).toBeGreaterThan(0);
        });
    });

    test('does not render outlier legend when no outlier bins exist', async () => {
        const noOutlierData = {
            basketSize: {
                summary: { invoiceCount: 50, average: 5.0, median: 4.0, p90: 10.0 },
                bins: [
                    { rangeStart: 0, rangeEnd: 5, count: 30, isOutlier: false },
                    { rangeStart: 5, rangeEnd: 10, count: 20, isOutlier: false },
                ],
            },
            orderValue: {
                summary: { invoiceCount: 50, average: 40.0, median: 35.0, p90: 80.0 },
                bins: [
                    { rangeStart: 0, rangeEnd: 50, count: 30, isOutlier: false },
                    { rangeStart: 50, rangeEnd: 100, count: 20, isOutlier: false },
                ],
            },
        };
        mockFetchSuccess(noOutlierData);
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.queryByText(/Outlier bucket/i)).not.toBeInTheDocument();
        });
    });

    // API error handling

    test('displays an error banner when the server returns a non-OK response', async () => {
        mockFetchError(500, 'Internal Server Error');
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText(/Server error 500/i)).toBeInTheDocument();
        });
    });

    test('displays an error banner on network failure', async () => {
        mockFetchNetworkFailure();
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
        });
    });

    test('clears a previous error when a subsequent fetch succeeds', async () => {
        mockFetchError();
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => expect(screen.getByText(/Server error/i)).toBeInTheDocument());

        mockFetchSuccess();
        await applyFilters('2020-02-01', '2021-02-01');
        await waitFor(() => {
            expect(screen.queryByText(/Server error/i)).not.toBeInTheDocument();
        });
    });

    // fetch request shape

    test('sends startDate and endDate as ISO datetime strings in the request URL', async () => {
        mockFetchSuccess();
        render(<RFMHistogram />);
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
        jest.useFakeTimers();
        mockFetchSuccess();
        render(<RFMHistogram />);

        fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2020-01-01' } });
        fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: '2021-01-01' } });
        fireEvent.change(screen.getByPlaceholderText(/e.g. United Kingdom/i), { target: { value: 'Germany' } });

        // advance past the 600ms country debounce
        act(() => { jest.advanceTimersByTime(600); });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('country=Germany')
            );
        });

        jest.useRealTimers();
    });

    test('omits country param when country field is empty', async () => {
        mockFetchSuccess();
        render(<RFMHistogram />);
        await applyFilters('2020-01-01', '2021-01-01');
        await waitFor(() => {
            const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
            expect(url).not.toContain('country=');
        });
    });

    test('calls RESTful rfm endpoint with histogram view selector', async () => {
        mockFetchSuccess();
        render(<RFMHistogram />);
        await applyFilters();
        await waitFor(() => {
            const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
            expect(url).toContain('/api/rfm?');
            expect(url).toContain('view=histogram');
            expect(url).not.toContain('/api/rfm/histograms');
            expect(url).not.toContain('/api/rfm/scatter-plot');
        });
    });

    // loading state

    test('shows loading text while fetch is in progress', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => new Promise(jest.fn()));
        render(<RFMHistogram />);
        fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2020-01-01' } });
        fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: '2021-01-01' } });
        fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
        expect(screen.getByRole('button', { name: /Loading/i })).toBeInTheDocument();
        expect(screen.getByText(/Fetching histogram data/i)).toBeInTheDocument();
    });

    test('Apply button is disabled while loading', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => new Promise(jest.fn()));
        render(<RFMHistogram />);
        fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2020-01-01' } });
        fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: '2021-01-01' } });
        fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
        expect(screen.getByRole('button', { name: /Loading/i })).toBeDisabled();
    });
});