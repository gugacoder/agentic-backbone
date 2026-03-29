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
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "../ui/card";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const AXIS_PROPS = {
  stroke: "var(--border)",
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--card-foreground)",
    borderRadius: "0.375rem",
    fontSize: "0.75rem",
  },
};

function formatValue(value: number, format?: DisplayChart["format"]): string {
  if (!format) return String(value);
  const locale = format.locale ?? "pt-BR";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeTooltipFormatter(format?: DisplayChart["format"]): any {
  return (value: number | string | undefined): [string, string] => [
    typeof value === "number" ? formatValue(value, format) : String(value ?? ""),
    "",
  ];
}

export function ChartRenderer({ type, title, data, format }: DisplayChart) {
  const chartData = data.map((d) => ({ name: d.label, value: d.value, color: d.color }));
  const tooltipFormatter = makeTooltipFormatter(format);

  const sharedProps = {
    data: chartData,
    margin: { top: 4, right: 8, left: 8, bottom: 4 },
  };

  return (
    <Card className="p-4">
      {title && <p className="text-sm font-medium text-foreground mb-4">{title}</p>}
      <div className="min-h-[200px]">
        <ResponsiveContainer width="100%" height={200}>
          {renderChart(type, chartData, sharedProps, tooltipFormatter)}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function renderChart(
  type: DisplayChart["type"],
  data: Array<{ name: string; value: number; color?: string }>,
  sharedProps: { data: typeof data; margin: { top: number; right: number; left: number; bottom: number } },
  tooltipFormatter: (v: number | string | undefined) => [string, string]
) {
  switch (type) {
    case "bar":
      return (
        <BarChart {...sharedProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" {...AXIS_PROPS} />
          <YAxis width={48} {...AXIS_PROPS} />
          <Tooltip formatter={tooltipFormatter} {...TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      );

    case "line":
      return (
        <LineChart {...sharedProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" {...AXIS_PROPS} />
          <YAxis width={48} {...AXIS_PROPS} />
          <Tooltip formatter={tooltipFormatter} {...TOOLTIP_STYLE} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ r: 4, fill: CHART_COLORS[0] }}
          />
        </LineChart>
      );

    case "area":
      return (
        <AreaChart {...sharedProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" {...AXIS_PROPS} />
          <YAxis width={48} {...AXIS_PROPS} />
          <Tooltip formatter={tooltipFormatter} {...TOOLTIP_STYLE} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS[0]}
            fill={CHART_COLORS[0]}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      );

    case "pie":
      return (
        <PieChart>
          <Tooltip formatter={tooltipFormatter} {...TOOLTIP_STYLE} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="70%"
            label={({ name }) => name}
            labelLine={{ stroke: "var(--muted-foreground)" }}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      );

    case "donut":
      return (
        <PieChart>
          <Tooltip formatter={tooltipFormatter} {...TOOLTIP_STYLE} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="40%"
            outerRadius="70%"
            label={({ name }) => name}
            labelLine={{ stroke: "var(--muted-foreground)" }}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      );
  }
}
