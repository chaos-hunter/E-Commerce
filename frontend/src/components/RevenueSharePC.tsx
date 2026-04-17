import React, { useState, useCallback } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import './RevenueSharePC.css';

// types

interface RevenueSlice {
    country: string;
    revenue: number;
    percentage: number;
}

interface RevenueShareResponse {
    totalRevenue: number;
    slices: RevenueSlice[];
}

interface RevenueSharePCProps {
    initialStartDate?: string;
    initialEndDate?: string;
    initialCountry?: string;
}

// helpers

const toISOLocal = (dateStr: string, endOfDay = false): string =>
    `${dateStr}T${endOfDay ? '23:59:59' : '00:00:00'}`;

const SLICE_COLOURS = [
    '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
    '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
    '#9c755f', '#bab0ac',
];

const formatCurrency = (value: number): string =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

// custom tool tip

interface TooltipPayload {
    payload: RevenueSlice;
}

const CustomTooltip: React.FC<{ active?: boolean; payload?: TooltipPayload[] }> = ({
    active,
    payload,
}) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="rfm-tooltip">
            <p className="rfm-tooltip-title">{d.country}</p>
            <table className="rfm-tooltip-table">
                <tbody>
                    <tr>
                        <td className="rfm-tooltip-key">Revenue</td>
                        <td className="rfm-tooltip-val">{formatCurrency(d.revenue)}</td>
                    </tr>
                    <tr>
                        <td className="rfm-tooltip-key">Share</td>
                        <td className="rfm-tooltip-val">{d.percentage.toFixed(2)}%</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

// custom legend

const CustomLegend: React.FC<{ slices: RevenueSlice[] }> = ({ slices }) => (
    <div className="rs-legend">
        <div className="rs-legend-header">
            <span>Country</span>
            <span>Revenue</span>
            <span>Share</span>
        </div>
        {slices.map((s, i) => (
            <div key={s.country} className="rs-legend-row">
                <span className="rs-legend-country">
                    <span
                        className="rs-legend-swatch"
                        style={{ background: SLICE_COLOURS[i % SLICE_COLOURS.length] }}
                    />
                    {s.country}
                </span>
                <span className="rs-legend-revenue">{formatCurrency(s.revenue)}</span>
                <span className="rs-legend-pct">{s.percentage.toFixed(2)}%</span>
            </div>
        ))}
    </div>
);

// - main component --

export const RevenueSharePC: React.FC<RevenueSharePCProps> = ({
    initialStartDate = '',
    initialEndDate = '',
}) => {
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);

    const [response, setResponse] = useState<RevenueShareResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        if (!startDate || !endDate) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                view: 'pie',
                startDate: toISOLocal(startDate, false),
                endDate: toISOLocal(endDate, true),
            });
            const res = await fetch(`/api/rfm?${params.toString()}`);
            if (!res.ok) throw new Error(`Server error ${res.status}: ${res.statusText}`);
            const json: RevenueShareResponse = await res.json();
            setResponse(json);
            setHasFetched(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    const slices = response?.slices ?? [];
    const totalRevenue = response?.totalRevenue ?? 0;

    return (
        <div className="rfm-wrapper">

            {/* Header + Filters */}
            <div className="rfm-header">
                <div>
                    <p className="rfm-title">Revenue Share by Country</p>
                    <p className="rfm-subtitle">Proportion of total revenue contributed per country</p>
                </div>
                <div className="rfm-filters">
                    <div>
                        <label htmlFor="rs-start-date" className="rfm-filter-label">Start Date</label>
                        <input
                            id="rs-start-date"
                            type="date"
                            className="rfm-input"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="rs-end-date" className="rfm-filter-label">End Date</label>
                        <input
                            id="rs-end-date"
                            type="date"
                            className="rfm-input"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <button
                        className="rfm-apply-btn"
                        onClick={fetchData}
                        disabled={!startDate || !endDate || loading}
                    >
                        {loading ? 'Loading…' : 'Apply'}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && <div className="rfm-error">⚠ {error}</div>}

            {/* Summary stat cards */}
            {hasFetched && slices.length > 0 && (
                <div className="rfm-stats-row">
                    <div className="rfm-stat-card">
                        <div className="rfm-stat-value">{formatCurrency(totalRevenue)}</div>
                        <div className="rfm-stat-label">Total Revenue</div>
                    </div>
                    <div className="rfm-stat-card">
                        <div className="rfm-stat-value">{slices.length}</div>
                        <div className="rfm-stat-label">Countries</div>
                    </div>
                    <div className="rfm-stat-card">
                        <div className="rfm-stat-value">{slices[0]?.country ?? '—'}</div>
                        <div className="rfm-stat-label">Top Country</div>
                    </div>
                </div>
            )}

            {/* Chart */}
            <div className="rfm-chart-area">
                {!hasFetched && !loading && (
                    <div className="rfm-empty-state">
                        <span style={{ fontSize: '32px' }}>🥧</span>
                        <span>Select a date range and click Apply to render the chart.</span>
                    </div>
                )}
                {loading && (
                    <div className="rfm-empty-state">
                        <span>Fetching revenue data…</span>
                    </div>
                )}
                {hasFetched && !loading && slices.length === 0 && (
                    <div className="rfm-empty-state">
                        <span style={{ fontSize: '28px' }}>🔍</span>
                        <span>No revenue data found for this date range.</span>
                    </div>
                )}
                {hasFetched && !loading && slices.length > 0 && (
                    <div className="rs-chart-layout">
                        <ResponsiveContainer width="50%" height={380}>
                            <PieChart>
                                <Pie
                                    data={slices}
                                    dataKey="revenue"
                                    nameKey="country"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={150}
                                    innerRadius={60}
                                    paddingAngle={2}
                                    isAnimationActive={false}
                                    onMouseEnter={(_: RevenueSlice, index: number) => setActiveIndex(index)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                >
                                    {slices.map((slice, index) => (
                                        <Cell
                                            key={`cell-${slice.country}`}
                                            fill={SLICE_COLOURS[index % SLICE_COLOURS.length]}
                                            opacity={activeIndex === null || activeIndex === index ? 1 : 0.55}
                                            stroke={activeIndex === index ? '#282c34' : 'none'}
                                            strokeWidth={activeIndex === index ? 2 : 0}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>

                        <CustomLegend slices={slices} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default RevenueSharePC;