import React, { useState, useCallback, useRef } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import './RFMHistogram.css';

// -- types --

interface HistogramSummary {
    invoiceCount: number;
    average: number | null;
    median: number | null;
    p90: number | null;
}

interface HistogramBin {
    rangeStart: number;
    rangeEnd: number;
    count: number;
    isOutlier: boolean;
}

interface HistogramMetric {
    summary: HistogramSummary;
    bins: HistogramBin[];
}

interface HistogramResponse {
    basketSize: HistogramMetric;
    orderValue: HistogramMetric;
}

interface RFMHistogramProps {
    initialStartDate?: string;
    initialEndDate?: string;
    initialCountry?: string;
}

// -- helpers --

// converts YYYY-MM-DD to ISO datetime string, optionally end of day
const toISOLocal = (dateStr: string, endOfDay = false): string => {
    return `${dateStr}T${endOfDay ? '23:59:59' : '00:00:00'}`;
};

// formats a number to 2 decimal places, or returns N/A if null
const fmt = (val: number | null, prefix = ''): string => {
    if (val === null || val === undefined) return 'N/A';
    return `${prefix}${val.toFixed(2)}`;
};

// -- custom tooltip --

interface BinTooltipProps {
    active?: boolean;
    payload?: { payload: HistogramBin }[];
    valuePrefix?: string;
}

const BinTooltip: React.FC<BinTooltipProps> = ({ active, payload, valuePrefix = '' }) => {
    if (!active || !payload?.length) return null;
    const bin = payload[0].payload;
    return (
        <div className="rfm-histogram-tooltip">
            <p className="rfm-histogram-tooltip-range">
                {valuePrefix}{bin.rangeStart.toFixed(2)} – {valuePrefix}{bin.rangeEnd.toFixed(2)}
            </p>
            <p className="rfm-histogram-tooltip-count">{bin.count.toLocaleString()} invoices</p>
            {bin.isOutlier && (
                <p className="rfm-histogram-tooltip-outlier">⚠ outlier bucket</p>
            )}
        </div>
    );
};

// -- summary stats card --

interface SummaryCardProps {
    summary: HistogramSummary;
    valuePrefix?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ summary, valuePrefix = '' }) => (
    <div className="rfm-histogram-summary-row">
        <div className="rfm-histogram-stat-card">
            <div className="rfm-histogram-stat-value">{summary.invoiceCount.toLocaleString()}</div>
            <div className="rfm-histogram-stat-label">Invoices</div>
        </div>
        <div className="rfm-histogram-stat-card">
            <div className="rfm-histogram-stat-value">{fmt(summary.average, valuePrefix)}</div>
            <div className="rfm-histogram-stat-label">Average</div>
        </div>
        <div className="rfm-histogram-stat-card">
            <div className="rfm-histogram-stat-value">{fmt(summary.median, valuePrefix)}</div>
            <div className="rfm-histogram-stat-label">Median</div>
        </div>
        <div className="rfm-histogram-stat-card">
            <div className="rfm-histogram-stat-value">{fmt(summary.p90, valuePrefix)}</div>
            <div className="rfm-histogram-stat-label">90th Percentile</div>
        </div>
    </div>
);

// -- single histogram panel --

interface HistogramPanelProps {
    title: string;
    metric: HistogramMetric;
    xAxisLabel: string;
    valuePrefix?: string;
}

const HistogramPanel: React.FC<HistogramPanelProps> = ({
    title,
    metric,
    xAxisLabel,
    valuePrefix = '',
}) => {
    // label each bin by its range start for the x axis
    const chartData = metric.bins.map((bin) => ({
        ...bin,
        label: `${valuePrefix}${bin.rangeStart.toFixed(0)}`,
    }));

    return (
        <div className="rfm-histogram-panel">
            <p className="rfm-histogram-panel-title">{title}</p>
            <SummaryCard summary={metric.summary} valuePrefix={valuePrefix} />

            {metric.bins.length === 0 ? (
                <div className="rfm-histogram-empty">No data for this filter.</div>
            ) : (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 50, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                        <XAxis
                            dataKey="label"
                            label={{
                                value: xAxisLabel,
                                position: 'insideBottom',
                                offset: -35,
                                fill: '#666',
                                fontSize: 12,
                            }}
                            tick={{ fill: '#666', fontSize: 11 }}
                            axisLine={{ stroke: '#ccc' }}
                            tickLine={{ stroke: '#ccc' }}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            label={{
                                value: 'Invoices',
                                angle: -90,
                                position: 'insideLeft',
                                offset: 10,
                                fill: '#666',
                                fontSize: 12,
                            }}
                            tick={{ fill: '#666', fontSize: 11 }}
                            axisLine={{ stroke: '#ccc' }}
                            tickLine={{ stroke: '#ccc' }}
                        />
                        <Tooltip
                            content={<BinTooltip valuePrefix={valuePrefix} />}
                            cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        />
                        <Bar dataKey="count" isAnimationActive={false}>
                            {chartData.map((entry, index) => (
                                // outlier bins are highlighted in amber to draw attention
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.isOutlier ? '#f0a500' : '#1e88e5'}
                                    fillOpacity={0.85}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}

            {/* outlier legend — only shown if at least one outlier bin exists */}
            {metric.bins.some((b) => b.isOutlier) && (
                <div className="rfm-histogram-legend">
                    <span className="rfm-histogram-legend-dot" style={{ background: '#1e88e5' }} />
                    Normal
                    <span className="rfm-histogram-legend-dot" style={{ background: '#f0a500', marginLeft: '12px' }} />
                    Outlier bucket
                </div>
            )}
        </div>
    );
};

// -- main component --

export const RFMHistogram: React.FC<RFMHistogramProps> = ({
    initialStartDate = '',
    initialEndDate = '',
    initialCountry = '',
}) => {
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [countryInput, setCountryInput] = useState(initialCountry);
    const [country, setCountry] = useState(initialCountry);

    const [data, setData] = useState<HistogramResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);

    const countryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    // debounce country input to avoid fetching on every keystroke
    const handleCountryInput = (val: string) => {
        setCountryInput(val);
        if (countryDebounce.current) clearTimeout(countryDebounce.current);
        countryDebounce.current = setTimeout(() => setCountry(val.trim()), 600);
    };

    const fetchData = useCallback(async () => {
        if (!startDate || !endDate) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                // RESTful representation selector for /api/rfm.
                view: 'histogram',
                startDate: toISOLocal(startDate, false),
                endDate: toISOLocal(endDate, true),
            });
            if (country) params.set('country', country);

            // fetch histogram data from backend
            const res = await fetch(`/api/rfm?${params.toString()}`);
            if (!res.ok) throw new Error(`Server error ${res.status}: ${res.statusText}`);
            const json: HistogramResponse = await res.json();
            setData(json);
            setHasFetched(true);


        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, country]);

    return (
        <div className="rfm-histogram-wrapper">

            {/* header + filters */}
            <div className="rfm-histogram-header">
                <div>
                    <p className="rfm-histogram-title">RFM Histograms</p>
                    <p className="rfm-histogram-subtitle">Basket Size · Order Value</p>
                </div>
                <div className="rfm-histogram-filters">
                    <div>
                        <label htmlFor="hist-start-date" className="rfm-histogram-filter-label">Start Date</label>
                        <input
                            type="date"
                            id="hist-start-date"
                            className="rfm-histogram-input"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="hist-end-date" className="rfm-histogram-filter-label">End Date</label>
                        <input
                            type="date"
                            id="hist-end-date"
                            className="rfm-histogram-input"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="hist-country" className="rfm-histogram-filter-label">Country (optional)</label>
                        <input
                            type="text"
                            id="hist-country"
                            placeholder="e.g. United Kingdom"
                            className="rfm-histogram-input rfm-histogram-input-country"
                            value={countryInput}
                            onChange={(e) => handleCountryInput(e.target.value)}
                        />
                    </div>
                    <button
                        className="rfm-histogram-apply-btn"
                        onClick={fetchData}
                        disabled={!startDate || !endDate || loading}
                    >
                        {loading ? 'Loading…' : 'Apply'}
                    </button>
                </div>
            </div>

            {/* error banner */}
            {error && <div className="rfm-histogram-error">⚠ {error}</div>}

            {/* pre-fetch empty state */}
            {!hasFetched && !loading && (
                <div className="rfm-histogram-empty-state">
                    <span style={{ fontSize: '32px' }}>📊</span>
                    <span>Select a date range and click Apply to render the histograms.</span>
                </div>
            )}

            {/* loading state */}
            {loading && (
                <div className="rfm-histogram-empty-state">
                    <span>Fetching histogram data…</span>
                </div>
            )}

            {/* histograms — side by side */}
            {hasFetched && !loading && data && (
                <div className="rfm-histogram-charts-row">
                    <HistogramPanel
                        title="Basket Size"
                        metric={data.basketSize}
                        xAxisLabel="Items per Invoice"
                    />
                    <HistogramPanel
                        title="Order Value"
                        metric={data.orderValue}
                        xAxisLabel="Order Value ($)"
                        valuePrefix="$"
                    />
                </div>
            )}
        </div>
    );
};

export default RFMHistogram;