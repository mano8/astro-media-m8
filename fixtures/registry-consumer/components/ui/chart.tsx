// Consumer-owned shadcn `chart` primitive, stubbed at the shape the skins use.
import * as React from "react";

export interface ChartConfigEntry {
  label?: React.ReactNode;
  color?: string;
  icon?: React.ComponentType;
  theme?: Record<string, string>;
}

export type ChartConfig = Record<string, ChartConfigEntry>;

export interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig;
}

export function ChartContainer({ config: _config, ...props }: ChartContainerProps) {
  return <div {...props} />;
}

export function ChartTooltip(_props: Record<string, unknown>): React.JSX.Element {
  return <div />;
}

export interface ChartTooltipContentProps {
  formatter?: (
    value: string | number,
    name?: string,
    item?: unknown,
    index?: number,
  ) => React.ReactNode;
  labelFormatter?: (label: unknown) => React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelKey?: string;
  className?: string;
}

export function ChartTooltipContent(_props: ChartTooltipContentProps): React.JSX.Element {
  return <div />;
}

export function ChartLegend(_props: Record<string, unknown>): React.JSX.Element {
  return <div />;
}

export function ChartLegendContent(_props: Record<string, unknown>): React.JSX.Element {
  return <div />;
}
