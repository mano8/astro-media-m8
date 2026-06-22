"use client";

// Pure-shadcn bar chart preset (recharts-backed) for the media admin dashboard:
// storage bytes per category. Copied into the consumer via the @fa-m8-media
// registry; edit freely per app.
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface StorageDatum {
  category: string;
  bytes: number;
  count: number;
}

export interface MediaStorageChartProps {
  data: StorageDatum[];
  bytesLabel?: string;
  className?: string;
}

/** Compact, base-1024 byte humanizer shared by the axis + tooltip. */
export function humanizeBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function MediaStorageChart({
  data,
  bytesLabel = "Storage",
  className,
}: MediaStorageChartProps) {
  const chartConfig = {
    bytes: { label: bytesLabel, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className={className}>
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) => humanizeBytes(value)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => humanizeBytes(Number(value))}
            />
          }
        />
        <Bar dataKey="bytes" fill="var(--color-bytes)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
