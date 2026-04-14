import { Cell, Label, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CostSummary } from "@/api/costs";

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic (nativo)",
  openrouter: "OpenRouter",
  groq: "Groq",
  openai: "OpenAI",
  unknown: "Desconhecido",
};

const PROVIDER_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

interface CostByProviderChartProps {
  data: CostSummary["byProvider"];
  totalCostUsd: number;
}

export function CostByProviderChart({
  data,
  totalCostUsd,
}: CostByProviderChartProps) {
  const chartData = data.map((item, i) => ({
    provider: PROVIDER_LABELS[item.provider] ?? item.provider,
    costUsd: item.costUsd,
    calls: item.calls,
    fill: PROVIDER_COLORS[i % PROVIDER_COLORS.length],
  }));

  const chartConfig = chartData.reduce<ChartConfig>((acc, item) => {
    acc[item.provider] = {
      label: item.provider,
      color: item.fill,
    };
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Custo por Provedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-square h-[250px] w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="provider"
                  formatter={(value) => [`$${Number(value).toFixed(4)}`, ""]}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="costUsd"
              nameKey="provider"
              innerRadius={60}
              outerRadius={90}
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-xl font-bold"
                        >
                          ${totalCostUsd.toFixed(2)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          className="fill-muted-foreground text-xs"
                        >
                          Total
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
