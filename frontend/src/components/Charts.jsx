import { useMemo, useState } from "react";

const chartColors = ["#1d67a8", "#27a0d8", "#d99a2b", "#2f9e68", "#7a5aa6", "#c63f32", "#4e6475"];
const statusColors = {
  Open: "#c63f32",
  Closed: "#2f9e68",
  Escalated: "#8f3d68",
};

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function displayLabel(label) {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (!match) return label;
  const monthIndex = Number(match[2]) - 1;
  return monthLabels[monthIndex] || label;
}

function countTicks(maxValue) {
  const axisMax = Math.max(3, Math.ceil(maxValue));
  return Array.from({ length: axisMax + 1 }, (_, index) => index);
}

export function InteractiveBarChart({ data, title, note, onSelect, selectedKey }) {
  const [hovered, setHovered] = useState(null);
  const entries = useMemo(() => Object.entries(data || {}).sort((a, b) => b[1] - a[1]), [data]);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  const width = 520;
  const height = Math.max(210, entries.length * 34 + 44);
  const left = 140;
  const right = 42;
  const barHeight = 18;
  const gap = 16;
  const plotWidth = width - left - right;

  if (!entries.length) return <EmptyChart title={title} />;

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h2>{title}</h2>
        <span>{note}</span>
      </div>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <line x1={left} x2={left + plotWidth} y1={height - 24} y2={height - 24} className="axis-line" />
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line x1={left + plotWidth * tick} x2={left + plotWidth * tick} y1={18} y2={height - 24} className="grid-line" />
            <text x={left + plotWidth * tick} y={height - 8} textAnchor="middle" className="chart-tick">{Math.round(max * tick)}</text>
          </g>
        ))}
        {entries.map(([label, value], index) => {
          const y = 24 + index * (barHeight + gap);
          const barWidth = Math.max(3, (value / max) * plotWidth);
          const isActive = selectedKey === label || hovered === label;
          return (
            <g
              key={label}
              className={`chart-bar-group ${isActive ? "active" : ""}`}
              onMouseEnter={() => setHovered(label)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect?.({ chart: title, label, value })}
            >
              <text x={left - 10} y={y + 13} textAnchor="end" className="chart-label">{label}</text>
              <rect x={left} y={y} width={barWidth} height={barHeight} rx="3" fill={chartColors[index % chartColors.length]} />
              <text x={left + barWidth + 8} y={y + 13} className="chart-value">{value}</text>
              {isActive && <ChartTooltip x={Math.min(left + barWidth + 14, width - 132)} y={Math.max(10, y - 10)} label={label} value={value} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function InteractiveColumnChart({ data, title, note, xAxisLabel = "Department", wide = false, onSelect, selectedKey }) {
  const [hovered, setHovered] = useState(null);
  const entries = useMemo(() => Object.entries(data || {}).sort((a, b) => b[1] - a[1]), [data]);
  const max = Math.max(...entries.map(([, value]) => value), 1);
  const ticks = countTicks(max);
  const axisMax = ticks[ticks.length - 1];
  const width = 620;
  const height = 300;
  const pad = { top: 28, right: 28, bottom: 72, left: 46 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const slot = plotWidth / Math.max(entries.length, 1);
  const barWidth = Math.min(54, Math.max(24, slot * 0.58));

  if (!entries.length) return <EmptyChart title={title} />;

  return (
    <div className={`chart-card ${wide ? "chart-card-wide" : ""}`}>
      <div className="chart-head">
        <h2>{title}</h2>
        <span>{note}</span>
      </div>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <defs>
          {entries.map(([label], index) => (
            <linearGradient key={label} id={`barGradient${index}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={chartColors[index % chartColors.length]} stopOpacity="0.95" />
              <stop offset="100%" stopColor={chartColors[index % chartColors.length]} stopOpacity="0.58" />
            </linearGradient>
          ))}
          <filter id="barShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.16" />
          </filter>
        </defs>
        {ticks.map((tick) => {
          const y = pad.top + plotHeight - (tick / axisMax) * plotHeight;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="grid-line" />
              <text x={pad.left - 10} y={y + 4} textAnchor="end" className="chart-tick">{tick}</text>
            </g>
          );
        })}
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotHeight} y2={pad.top + plotHeight} className="axis-line" />
        <text x={pad.left - 32} y={pad.top + plotHeight / 2} textAnchor="middle" className="axis-title" transform={`rotate(-90 ${pad.left - 32} ${pad.top + plotHeight / 2})`}>Hiccups</text>
        <text x={pad.left + plotWidth / 2} y={height - 6} textAnchor="middle" className="axis-title">{xAxisLabel}</text>
        {entries.map(([label, value], index) => {
          const x = pad.left + index * slot + slot / 2 - barWidth / 2;
          const barHeight = (value / axisMax) * plotHeight;
          const y = pad.top + plotHeight - barHeight;
          const isActive = selectedKey === label || hovered === label;
          return (
            <g
              key={label}
              className={`chart-bar-group ${isActive ? "active" : ""}`}
              onMouseEnter={() => setHovered(label)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect?.({ chart: title, label, value })}
            >
              <rect x={x} y={y} width={barWidth} height={barHeight} rx="6" fill={`url(#barGradient${index})`} filter="url(#barShadow)" />
              <text x={x + barWidth / 2} y={y - 7} textAnchor="middle" className="chart-value">{value}</text>
              <text x={x + barWidth / 2} y={pad.top + plotHeight + 18} textAnchor="middle" className="chart-x-label">{label}</text>
              {isActive && <ChartTooltip x={Math.min(x + barWidth + 8, width - 132)} y={Math.max(10, y - 44)} label={label} value={value} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function StatusDonutChart({ data, title, note, onSelect, selectedKey }) {
  const [hovered, setHovered] = useState(null);
  const entries = useMemo(() => Object.entries(data || {}).filter(([, value]) => value > 0), [data]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const size = 300;
  const center = size / 2;
  const radius = 92;
  const strokeWidth = 34;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (!entries.length) return <EmptyChart title={title} />;

  return (
    <div className="chart-card bi-card">
      <div className="chart-head">
        <h2>{title}</h2>
        <span>{note}</span>
      </div>
      <div className="donut-layout">
        <svg className="donut-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#e7edf4" strokeWidth={strokeWidth} />
          {entries.map(([label, value]) => {
            const fraction = value / total;
            const dash = fraction * circumference;
            const active = selectedKey === label || hovered === label;
            const color = statusColors[label] || chartColors[entries.findIndex(([entryLabel]) => entryLabel === label) % chartColors.length];
            const segment = (
              <circle
                key={label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={active ? strokeWidth + 4 : strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                className="donut-segment"
                onMouseEnter={() => setHovered(label)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect?.({ chart: title, label, value })}
              />
            );
            offset += dash;
            return segment;
          })}
          <text x={center} y={center - 4} textAnchor="middle" className="donut-total">{total}</text>
          <text x={center} y={center + 22} textAnchor="middle" className="donut-caption">Total</text>
        </svg>
        <div className="legend-list">
          {entries.map(([label, value]) => {
            const color = statusColors[label] || chartColors[entries.findIndex(([entryLabel]) => entryLabel === label) % chartColors.length];
            const active = selectedKey === label || hovered === label;
            return (
              <button
                key={label}
                className={`legend-item ${active ? "active" : ""}`}
                onMouseEnter={() => setHovered(label)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect?.({ chart: title, label, value })}
              >
                <span className="legend-dot" style={{ background: color }} />
                <span>{label}</span>
                <strong>{value}</strong>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function InteractiveLineChart({ data, title, note, compact = false, onSelect, selectedKey }) {
  const [hovered, setHovered] = useState(null);
  const entries = useMemo(() => Object.entries(data || {}).sort(([a], [b]) => a.localeCompare(b)), [data]);
  const width = 620;
  const height = compact ? 190 : 260;
  const pad = compact ? { top: 22, right: 24, bottom: 42, left: 38 } : { top: 28, right: 28, bottom: 46, left: 42 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const max = Math.max(...entries.map(([, value]) => value), 1);
  const points = entries.map(([label, value], index) => {
    const x = pad.left + (entries.length === 1 ? plotWidth / 2 : (index / (entries.length - 1)) * plotWidth);
    const y = pad.top + plotHeight - (value / max) * plotHeight;
    return { label, value, x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  if (!entries.length) return <EmptyChart title={title} />;

  return (
    <div className={`chart-card chart-card-wide ${compact ? "trend-compact" : ""}`}>
      <div className="chart-head">
        <h2>{title}</h2>
        <span>{note}</span>
      </div>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1d67a8" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#1d67a8" stopOpacity="0.02" />
          </linearGradient>
          <filter id="lineShadow" x="-10%" y="-20%" width="120%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.12" />
          </filter>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = pad.top + plotHeight - plotHeight * tick;
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="grid-line" />
              <text x={pad.left - 10} y={y + 4} textAnchor="end" className="chart-tick">{Math.round(max * tick)}</text>
            </g>
          );
        })}
        {points.length > 1 && (
          <path
            d={`${path} L ${points[points.length - 1].x} ${pad.top + plotHeight} L ${points[0].x} ${pad.top + plotHeight} Z`}
            fill="url(#trendFill)"
          />
        )}
        <path d={path} fill="none" stroke="#1d67a8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter="url(#lineShadow)" />
        {points.map((point) => {
          const isActive = selectedKey === point.label || hovered === point.label;
          return (
            <g
              key={point.label}
              className={`chart-point-group ${isActive ? "active" : ""}`}
              onMouseEnter={() => setHovered(point.label)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSelect?.({ chart: title, label: point.label, value: point.value })}
            >
              <circle cx={point.x} cy={point.y} r={isActive ? 7 : 5} />
              <text x={point.x} y={height - 18} textAnchor="middle" className="chart-tick">{displayLabel(point.label)}</text>
              {isActive && <ChartTooltip x={Math.min(point.x + 10, width - 132)} y={Math.max(12, point.y - 46)} label={point.label} value={point.value} />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ChartTooltip({ x, y, label, value }) {
  return (
    <g className="chart-tooltip" pointerEvents="none">
      <rect x={x} y={y} width="118" height="38" rx="5" />
      <text x={x + 8} y={y + 16}>{label}</text>
      <text x={x + 8} y={y + 31}>{value} hiccups</text>
    </g>
  );
}

function EmptyChart({ title }) {
  return (
    <div className="chart-card">
      <div className="chart-head"><h2>{title}</h2></div>
      <div className="muted">No data for this period.</div>
    </div>
  );
}
