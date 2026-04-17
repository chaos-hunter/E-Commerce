import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RevenueSharePC } from '../components/RevenueSharePC';
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

// ─── Helpers ──

const mockRevenueData = {
    totalRevenue: 123456.78,
    slices: [
        { country: 'United Kingdom', revenue: 90000.00, percentage: 72.88 },
        { country: 'Germany', revenue: 20000.00, percentage: 16.20 },
        { country: 'Netherlands', revenue: 13456.78, percentage: 10.90 },
    ],
};

const mockEmptyRevenueData = {
    totalRevenue: 0.0,
    slices: [],
};

const mockFetchSuccess = (data = mockRevenueData) => {
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
const applyFilters = async (start = '2020-01-01', end = '2021-01-01') => {
    fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: start } });
    fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: end } });
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    });
};

// ─── Tests ───

describe('RevenueSharePC Component Unit Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ── Initial render ──

    test('renders the filter controls on mount', () => {
        render(<RevenueSharePC />);
        expect(screen.getByText(/Revenue Share by Country/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Start Date/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/End Date/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Apply/i })).toBeInTheDocument();
    });

    test('shows the empty state prompt before any fetch', () => {
        render(<RevenueSharePC />);
        expect(screen.getByText(/Select a date range and click Apply/i)).toBeInTheDocument();
    });

    test('Apply button is disabled when dates are missing', () => {
        render(<RevenueSharePC />);
        expect(screen.getByRole('button', { name: /Apply/i })).toBeDisabled();
    });

    test('Apply button is enabled once both dates are filled', () => {
        render(<RevenueSharePC />);
        fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2020-01-01' } });
        fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: '2021-01-01' } });
        expect(screen.getByRole('button', { name: /Apply/i })).not.toBeDisabled();
    });

    // ── Props pre-fill ──

    test('pre-fills date inputs from initialStartDate / initialEndDate props', () => {
        render(<RevenueSharePC initialStartDate="2020-06-01" initialEndDate="2021-06-01" />);
        expect(screen.getByLabelText(/Start Date/i)).toHaveValue('2020-06-01');
        expect(screen.getByLabelText(/End Date/i)).toHaveValue('2021-06-01');
    });

    test('accepts initialCountry prop without error even though it is not used as a filter', () => {
        render(<RevenueSharePC initialCountry="Germany" />);
        // Component should render without crashing — no country input exists on this component
        expect(screen.getByText(/Revenue Share by Country/i)).toBeInTheDocument();
    });

    // ── Successful fetch ──

    test('renders the pie chart container after a successful fetch', async () => {
        mockFetchSuccess();
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        });
    });

    test('displays all three summary stat cards after data loads', async () => {
        mockFetchSuccess();
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText('Total Revenue')).toBeInTheDocument();
            expect(screen.getByText('Countries')).toBeInTheDocument();
            expect(screen.getByText('Top Country')).toBeInTheDocument();
        });
    });

    test('stat card shows correct country count', async () => {
        mockFetchSuccess();
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => {
            // mockRevenueData has 3 slices
            expect(screen.getByText('3')).toBeInTheDocument();
        });
    });

    test('stat card shows the top country name', async () => {
        mockFetchSuccess();
        render(<RevenueSharePC />);
        await applyFilters();

        await waitFor(() => {
            const statCards = screen.getAllByText('Top Country');
            const topCountryCard = statCards[0].closest('.rfm-stat-card');

            expect(topCountryCard).toHaveTextContent('United Kingdom');
        });
    });

    test('renders the custom legend with all country names', async () => {
        mockFetchSuccess();
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText('Germany')).toBeInTheDocument();
            expect(screen.getByText('Netherlands')).toBeInTheDocument();
        });
    });

    test('renders legend percentage values for each slice', async () => {
        mockFetchSuccess();
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText('72.88%')).toBeInTheDocument();
            expect(screen.getByText('16.20%')).toBeInTheDocument();
            expect(screen.getByText('10.90%')).toBeInTheDocument();
        });
    });

    test('renders legend header labels', async () => {
        mockFetchSuccess();
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText('Country')).toBeInTheDocument();
            expect(screen.getByText('Revenue')).toBeInTheDocument();
            expect(screen.getByText('Share')).toBeInTheDocument();
        });
    });

    // ── Empty results ──

    test('shows empty state message when API returns no slices', async () => {
        mockFetchSuccess(mockEmptyRevenueData);
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText(/No revenue data found for this date range/i)).toBeInTheDocument();
        });
    });

    test('does not render stat cards when slices are empty', async () => {
        mockFetchSuccess(mockEmptyRevenueData);
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.queryByText('Total Revenue')).not.toBeInTheDocument();
            expect(screen.queryByText('Countries')).not.toBeInTheDocument();
        });
    });

    // ── API error handling ──

    test('displays an error banner when the server returns a non-OK response', async () => {
        mockFetchError(500, 'Internal Server Error');
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText(/Server error 500/i)).toBeInTheDocument();
        });
    });

    test('displays an error banner on network failure', async () => {
        mockFetchNetworkFailure();
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => {
            expect(screen.getByText(/Network Error/i)).toBeInTheDocument();
        });
    });

    test('clears a previous error when a subsequent fetch succeeds', async () => {
        mockFetchError();
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => expect(screen.getByText(/Server error/i)).toBeInTheDocument());

        mockFetchSuccess();
        await applyFilters('2020-02-01', '2021-02-01');
        await waitFor(() => {
            expect(screen.queryByText(/Server error/i)).not.toBeInTheDocument();
        });
    });

    // ── Fetch request shape ─

    test('sends startDate and endDate as ISO datetime strings in the request URL', async () => {
        mockFetchSuccess();
        render(<RevenueSharePC />);
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

    test('calls the RESTful rfm endpoint with the pie view selector', async () => {
        mockFetchSuccess();
        render(<RevenueSharePC />);
        await applyFilters();
        await waitFor(() => {
            const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
            expect(url).toContain('/api/rfm?');
            expect(url).toContain('view=pie');
            expect(url).not.toContain('view=histogram');
            expect(url).not.toContain('/api/rfm/scatter-plot');
        });
    });

    test('does not include a country param in the request URL', async () => {
        mockFetchSuccess();
        render(<RevenueSharePC initialCountry="Germany" />);
        await applyFilters();
        await waitFor(() => {
            const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
            expect(url).not.toContain('country=');
        });
    });

    // ── Loading state ─
    test('shows loading text while fetch is in progress', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => new Promise(jest.fn()));
        render(<RevenueSharePC />);
        fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2020-01-01' } });
        fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: '2021-01-01' } });
        fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
        expect(screen.getByRole('button', { name: /Loading/i })).toBeInTheDocument();
        expect(screen.getByText(/Fetching revenue data/i)).toBeInTheDocument();
    });

    test('Apply button is disabled while loading', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => new Promise(jest.fn()));
        render(<RevenueSharePC />);
        fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2020-01-01' } });
        fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: '2021-01-01' } });
        fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
        expect(screen.getByRole('button', { name: /Loading/i })).toBeDisabled();
    });
});