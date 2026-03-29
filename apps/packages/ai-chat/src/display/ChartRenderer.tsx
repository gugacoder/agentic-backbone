import type { DisplayChart } from "@agentic-backbone/ai-sdk";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

const DEFAULT_COLORS = [
  "var(--ai-chat-chart-color-1, #6366f1)",
  "var(--ai-chat-chart-color-2, #22d3ee)",
  "var(--ai-chat-chart-color-3, #f59e0b)",
  "var(--ai-chat-chart-color-4, #10b981)",
  "var(--ai-chat-chart-color-5, #f43f5e)",
  "var(--ai-chat-chart-color-6, #8b5cf6)",
  "var(--ai-chat-chart-color-7, #0ea5e9)",
  "var(--ai-chat-chart-color-8, #84cc16)",
];

function formatValue(value: number, format?: DisplayChart["format"]): string {
  if (!format) return String(value);
  const locale = format.locale ?? "pt-BR";
  // Detect monetary by prefix containing currency symbols
  const prefix = format.prefix ?? "";
  const suffix = format.suffix ?? "";
  if (prefix.includes("R$") || prefix.includes("$") || prefix.includes("€")) {
    const currencyMap: Record<string, string> = {
      "R$": "BRL",
      "$": "USD",
      "€": "EUR",
    };
    const currency = Object.keys(currencyMap).find(k => prefix.includes(k));
    if (currency) {
      return new Intl.NumberFormat(locale, { style: "currency", currency: currencyMap[currency] }).format(value);
    }
  }
  if (suffix.includes("%")) {
    return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(value / 100);
  }
  const formatted = new Intl.NumberFormat(locale).format(value);
  return `${prefix}${formatted}${suffix}`;
}

function makeTooltipFormatter(format?: DisplayChart["format"]) {
  return (value: number): [string, string] => [formatValue(value, format), ""];
}

export function ChartRenderer({ type, title, data, format }: DisplayChart) {
  const chartData = data.map((d) => ({ name: d.label, value: d.value, color: d.color }));
  const tooltipFormatter = makeTooltipFormatter(format);

  const sharedProps = {
    data: chartData,
    margin: { top: 4, right: 8, left: 8, bottom: 4 },
  };

  return (
    <div className="ai-chat-display ai-chat-display-chart">
      {title && <p className="ai-chat-display-chart-title">{title}</p>}
      <div className="ai-chat-display-chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(type, chartData, sharedProps, tooltipFormatter)}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function renderChart(
  type: DisplayChart["type"],
  data: Array<{ name: string; value: number; color?: string }>,
  sharedProps: { data: typeof data; margin: { top: number; right: number; left: number; bottom: number } },
  tooltipFormatter: (v: number) => [string, string]
) {
  switch (type) {
    case "bar":
      return (
        <BarChart {...sharedProps}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <Tooltip formatter={tooltipFormatter} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      );

    case "line":
      return (
        <LineChart {...sharedProps}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <Tooltip formatter={tooltipFormatter} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={DEFAULT_COLORS[0]}
            strokeWidth={2}
            dot={{ r: 4, fill: DEFAULT_COLORS[0] }}
          />
        </LineChart>
      );

    case "area":
      return (
        <AreaChart {...sharedProps}>
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={48} />
          <Tooltip formatter={tooltipFormatter} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={DEFAULT_COLORS[0]}
            fill={DEFAULT_COLORS[0]}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      );

    case "pie":
      return (
        <PieChart>
          <Tooltip formatter={tooltipFormatter} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="70%"
            label={({ name }) => name}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      );

    case "donut":
      return (
        <PieChart>
          <Tooltip formatter={tooltipFormatter} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="40%"
            outerRadius="70%"
            label={({ name }) => name}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      );
  }
}
