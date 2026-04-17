import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import "./RFMScatterPlot.css";

// Types
export interface RfmMetric {
    customerId: string;
    recency: number;
    frequency: number;
    monetary: number;
    country: string | null;
    bubbleSize: number;
}

interface RFMScatterPlotProps {
    // if props given 
    initialStartDate?: string;
    initialEndDate?: string;
    initialCountry?: string;
}

// Helpers

// This helper converts to ISO format and appends time to ensure the full day is included in the filter.
const toISOLocal = (dateStr: string, endOfDay = false): string => {
    // Convert "YYYY-MM-DD" → ISO-8601 datetime accepted by Spring
    return `${dateStr}T${endOfDay ? '23:59:59' : '00:00:00'}`;
};

// Color function: maps monetary value to a color on a blue → teal → green gradient
const monetaryColor = (monetary: number, max: number): string => {
    const ratio = max > 0 ? Math.min(monetary / max, 1) : 0;
    // blue → teal → green gradient
    const r = Math.round(30 + ratio * 10);
    const g = Math.round(80 + ratio * 140);
    const b = Math.round(220 - ratio * 140);
    return `rgb(${r},${g},${b})`;
};

// Custom tooltip content for scatter points

interface TooltipPayload {
    payload: RfmMetric;
}

const CustomTooltip: React.FC<{ active?: boolean; payload?: TooltipPayload[] }> = ({
    active,
    payload,
}) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="rfm-tooltip">
            <p className="rfm-tooltip-title">Customer {d.customerId}</p>
            <table className="rfm-tooltip-table">
                <tbody>
                    <tr>
                        <td className="rfm-tooltip-key">Recency</td>
                        <td className="rfm-tooltip-val">{d.recency.toFixed(0)} days</td>
                    </tr>
                    <tr>
                        <td className="rfm-tooltip-key">Frequency</td>
                        <td className="rfm-tooltip-val">{d.frequency} orders</td>
                    </tr>
                    <tr>
                        <td className="rfm-tooltip-key">Monetary</td>
                        <td className="rfm-tooltip-val">${d.monetary.toFixed(2)}</td>
                    </tr>
                    {d.country && (
                        <tr>
                            <td className="rfm-tooltip-key">Country</td>
                            <td className="rfm-tooltip-val">{d.country}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

// Scatter plot component

export const RFMScatterPlot: React.FC<RFMScatterPlotProps> = ({
    initialStartDate = '',
    initialEndDate = '',
    initialCountry = '',
}) => {
    const [startDate, setStartDate] = useState(initialStartDate);
    const [endDate, setEndDate] = useState(initialEndDate);
    const [country, setCountry] = useState(initialCountry);
    const [countryInput, setCountryInput] = useState(initialCountry);

    const [data, setData] = useState<RfmMetric[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);

    const countryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleCountryInput = (val: string) => {
        setCountryInput(val);
        if (countryDebounce.current) clearTimeout(countryDebounce.current);
        countryDebounce.current = setTimeout(() => setCountry(val.trim()), 600);
    };

    // for custom bubble size and color scaling
    const maxMonetary = data.reduce((m, d) => Math.max(m, d.monetary), 0);
    const maxBubble = data.reduce((m, d) => Math.max(m, d.bubbleSize), 1);
    const scaledRadius = (bubbleSize: number) => 6 + Math.round((bubbleSize / maxBubble) * 34);

    // for dynamic axis domains with some padding
    // so that data is centered
    const recencyValues = data.map((d) => d.recency); // extract recency values
    const frequencyValues = data.map((d) => d.frequency); // extract frequency values

    // calculate min/max with padding, and ensure some minimum padding for visibility
    const recencyMin = recencyValues.length > 0 ? Math.min(...recencyValues) : 0;
    const recencyMax = recencyValues.length > 0 ? Math.max(...recencyValues) : 100;
    const frequencyMax = frequencyValues.length > 0 ? Math.max(...frequencyValues) : 10;
    const recencyPad = Math.max((recencyMax - recencyMin) * 0.12, 10);
    const frequencyPad = Math.max(frequencyMax * 0.12, 1);

    // set axis domains with padding, ensuring recency starts at 0 or below for better visualization
    const xDomain: [number, number] = [
        Math.max(0, Math.floor(recencyMin - recencyPad)),
        Math.ceil(recencyMax + recencyPad),
    ];
    const yDomain: [number, number] = [0, Math.ceil(frequencyMax + frequencyPad)];

    // custom interface for scatter plots  bubbles
    interface BubbleShapeProps {
        cx?: number;
        cy?: number;
        payload?: RfmMetric;
    }
    // custom bubble shape so recharts respects the radius we set in Cell
    const BubbleShape = ({ cx = 0, cy = 0, payload }: BubbleShapeProps) => {
        if (!payload) return null;
        const r = scaledRadius(payload.bubbleSize);
        return (
            <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={monetaryColor(payload?.monetary, maxMonetary)}
                fillOpacity={0.82}
                stroke="rgba(0,0,0,0.1)"
                strokeWidth={1}
            />
        );
    };

    // fetch data from backend API with current filters
    const fetchData = useCallback(async () => {
        if (!startDate || !endDate) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                // RESTful representation selector for /api/rfm.
                view: 'scatter',
                startDate: toISOLocal(startDate, false),
                endDate: toISOLocal(endDate, true),
            });
            if (country) params.set('country', country);
            const res = await fetch(`/api/rfm?${params.toString()}`);
            if (!res.ok) throw new Error(`Server error ${res.status}: ${res.statusText}`);
            const json: RfmMetric[] = await res.json();
            setData(json);
            setHasFetched(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, country]);

    useEffect(() => {
        if (hasFetched) fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [country]);

    return (
        <div className="rfm-wrapper">

            {/* Header + Filters */}
            <div className="rfm-header">
                <div>
                    <p className="rfm-title">RFM Customer Scatter Plot</p>
                    <p className="rfm-subtitle">Recency · Frequency · Monetary value</p>
                </div>
                <div className="rfm-filters">
                    <div>
                        <label htmlFor="start-date" className="rfm-filter-label">Start Date</label>
                        <input
                            type="date"
                            id="start-date"
                            className="rfm-input"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="end-date" className="rfm-filter-label">End Date</label>
                        <input
                            type="date"
                            id="end-date"
                            className="rfm-input"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="country" className="rfm-filter-label">Country (optional)</label>
                        <input
                            type="text"
                            id="country"
                            placeholder="e.g. United Kingdom"
                            className="rfm-input rfm-input-country"
                            value={countryInput}
                            onChange={(e) => handleCountryInput(e.target.value)}
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

            {/* Summary stats */}
            {hasFetched && data.length > 0 && (
                <div className="rfm-stats-row">
                    <div className="rfm-stat-card">
                        <div className="rfm-stat-value">{data.length.toLocaleString()}</div>
                        <div className="rfm-stat-label">Customers</div>
                    </div>
                    <div className="rfm-stat-card">
                        <div className="rfm-stat-value">
                            {Math.round(data.reduce((s, d) => s + d.recency, 0) / data.length)}
                        </div>
                        <div className="rfm-stat-label">Avg Recency (days)</div>
                    </div>
                    <div className="rfm-stat-card">
                        <div className="rfm-stat-value">
                            {(data.reduce((s, d) => s + d.frequency, 0) / data.length).toFixed(1)}
                        </div>
                        <div className="rfm-stat-label">Avg Frequency</div>
                    </div>
                    <div className="rfm-stat-card">
                        <div className="rfm-stat-value">
                            ${(data.reduce((s, d) => s + d.monetary, 0) / data.length).toFixed(0)}
                        </div>
                        <div className="rfm-stat-label">Avg Monetary</div>
                    </div>
                </div>
            )}

            {/* Chart */}
            <div className="rfm-chart-area">
                {!hasFetched && !loading && (
                    <div className="rfm-empty-state">
                        <span style={{ fontSize: '32px' }}>📊</span>
                        <span>Select a date range and click Apply to render the chart.</span>
                    </div>
                )}
                {loading && (
                    <div className="rfm-empty-state">
                        <span>Fetching RFM data…</span>
                    </div>
                )}
                {hasFetched && !loading && data.length === 0 && (
                    <div className="rfm-empty-state">
                        <span style={{ fontSize: '28px' }}>🔍</span>
                        <span>No customers found for this filter combination.</span>
                    </div>
                )}
                {hasFetched && !loading && data.length > 0 && (
                    <ResponsiveContainer width="100%" height={400}>
                        <ScatterChart margin={{ top: 10, right: 30, bottom: 40, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis
                                type="number"
                                dataKey="recency"
                                name="Recency"
                                domain={xDomain}
                                label={{
                                    value: 'Recency (days since last order)',
                                    position: 'insideBottom',
                                    offset: -28,
                                    fill: '#666',
                                    fontSize: 12,
                                    fontFamily: 'inherit',
                                }}
                                tick={{ fill: '#666', fontSize: 11 }}
                                axisLine={{ stroke: '#ccc' }}
                                tickLine={{ stroke: '#ccc' }}
                            />
                            <YAxis
                                type="number"
                                dataKey="frequency"
                                name="Frequency"
                                domain={yDomain}
                                label={{
                                    value: 'Frequency (order count)',
                                    angle: -90,
                                    position: 'insideLeft',
                                    offset: 10,
                                    fill: '#666',
                                    fontSize: 12,
                                    fontFamily: 'inherit',
                                }}
                                tick={{ fill: '#666', fontSize: 11 }}
                                axisLine={{ stroke: '#ccc' }}
                                tickLine={{ stroke: '#ccc' }}
                            />
                            <Tooltip
                                content={<CustomTooltip />}
                                cursor={{ stroke: '#aaa', strokeDasharray: '4 2' }}
                            />
                            <Scatter
                                data={data}
                                isAnimationActive={false}
                                shape={<BubbleShape />}
                            />
                        </ScatterChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Legend */}
            {hasFetched && data.length > 0 && (
                <div className="rfm-legend">
                    <div className="rfm-legend-item">
                        <span className="rfm-legend-dot" style={{ width: 12, height: 12, background: monetaryColor(0, 1) }} />
                        Low monetary
                    </div>
                    <div className="rfm-legend-item">
                        <span className="rfm-legend-dot" style={{ width: 12, height: 12, background: monetaryColor(0.5, 1) }} />
                        Mid monetary
                    </div>
                    <div className="rfm-legend-item">
                        <span className="rfm-legend-dot" style={{ width: 12, height: 12, background: monetaryColor(1, 1) }} />
                        High monetary
                    </div>
                    <div className="rfm-legend-item">
                        <span className="rfm-legend-dot" style={{ width: 8, height: 8, background: '#282c34' }} />
                        Small bubble = low spend
                    </div>
                    <div className="rfm-legend-item">
                        <span className="rfm-legend-dot" style={{ width: 18, height: 18, background: '#282c34' }} />
                        Large bubble = high spend
                    </div>
                </div>
            )}
        </div>
    );
};

export default RFMScatterPlot;