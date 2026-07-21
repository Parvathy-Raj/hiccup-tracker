import { useEffect, useState } from "react";
import { api } from "../api";
import { InteractiveColumnChart, InteractiveLineChart, StatusDonutChart } from "../components/Charts";

const monthOptions = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const currentDate = new Date();

export function Dashboard() {
  const [data, setData] = useState(null);
  const [selection, setSelection] = useState(null);
  const [filters, setFilters] = useState({
    period: "month",
    month: currentDate.getMonth() + 1,
    quarter: Math.floor(currentDate.getMonth() / 3) + 1,
    year: currentDate.getFullYear(),
  });

  useEffect(() => {
    setData(null);
    setSelection(null);
    api.dashboard(dashboardParams(filters)).then(setData);
  }, [filters]);

  if (!data) return <div>Loading dashboard...</div>;

  const cards = [
    ["Total hiccups", data.cards.total, `Rows for ${data.scope?.label || "selected period"}`],
    ["Open / pending", data.cards.open, "Rows that still need follow-up"],
    ["Closed hiccups", data.cards.closed, "Completed or resolved rows"],
    ["Overdue open", data.cards.overdue, "Open more than 7 days", "critical-card"],
  ];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Operations Dashboard</h1>
          <p className="page-subtitle">Department-wise hiccup overview for {data.scope?.label || "current month"}</p>
        </div>
        <div className="dashboard-filter-panel">
          <div className="field">
            <label>View</label>
            <select value={filters.period} onChange={(event) => setFilters({ ...filters, period: event.target.value })}>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
              <option value="all">All records</option>
            </select>
          </div>
          {filters.period === "month" && (
            <div className="field small-field">
              <label>Month</label>
              <select value={filters.month} onChange={(event) => setFilters({ ...filters, month: Number(event.target.value) })}>
                {monthOptions.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
              </select>
            </div>
          )}
          {filters.period === "quarter" && (
            <div className="field small-field">
              <label>Quarter</label>
              <select value={filters.quarter} onChange={(event) => setFilters({ ...filters, quarter: Number(event.target.value) })}>
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </select>
            </div>
          )}
          {filters.period !== "all" && (
            <div className="field small-field">
              <label>Year</label>
              <input type="number" value={filters.year} onChange={(event) => setFilters({ ...filters, year: Number(event.target.value) })} />
            </div>
          )}
        </div>
      </div>
      <section className="simple-cards kpi-grid">
        {cards.map(([label, value, helper, className]) => (
          <div className={`card kpi-card ${className || ""}`} key={label}>
            <div className="label">{label}</div>
            <div className="value">{value}</div>
            <div className="kpi-helper">{helper}</div>
          </div>
        ))}
      </section>
      <section className="dashboard-insight">
        <div>
          <strong>{selection ? `${selection.chart}: ${selection.label}` : "Select a chart item"}</strong>
          <span>
            {selection
              ? `${selection.value} hiccup${selection.value === 1 ? "" : "s"} in this slice.`
              : "Click a bar or trend point to quickly inspect the count."}
          </span>
        </div>
        {selection && <button className="btn" onClick={() => setSelection(null)}>Clear Selection</button>}
      </section>
      <section className="chart-grid">
        <InteractiveColumnChart
          title="Hiccups by Department"
          note="Department-wise count"
          xAxisLabel="Department"
          data={data.by_department}
          selectedKey={selection?.chart === "Hiccups by Department" ? selection.label : null}
          onSelect={setSelection}
        />
        <StatusDonutChart
          title="Hiccups by Status"
          note="Status-wise count"
          data={data.by_status}
          selectedKey={selection?.chart === "Hiccups by Status" ? selection.label : null}
          onSelect={setSelection}
        />
        <InteractiveLineChart
          title="Monthly Trend"
          note={`${data.scope?.year || filters.year} month comparison`}
          compact
          data={data.monthly_trend}
          selectedKey={selection?.chart === "Monthly Trend" ? selection.label : null}
          onSelect={setSelection}
        />
      </section>
    </>
  );
}

function dashboardParams(filters) {
  if (filters.period === "all") return { period: "all", year: filters.year };
  if (filters.period === "year") return { period: "year", year: filters.year };
  if (filters.period === "quarter") return { period: "quarter", quarter: filters.quarter, year: filters.year };
  return { period: "month", month: filters.month, year: filters.year };
}
