// Typed stand-in for the parts of `recharts` the chart skins render. A consumer
// brings the real package; the fixture only needs the surface to typecheck.
import * as React from "react";

type Common = { children?: React.ReactNode } & Record<string, unknown>;

export function BarChart(_props: Common): React.JSX.Element {
  return <svg />;
}

export function Bar(_props: Common): React.JSX.Element {
  return <g />;
}

export function CartesianGrid(_props: Common): React.JSX.Element {
  return <g />;
}

export function XAxis(_props: Common): React.JSX.Element {
  return <g />;
}

export function YAxis(_props: Common): React.JSX.Element {
  return <g />;
}

export function ResponsiveContainer(_props: Common): React.JSX.Element {
  return <div />;
}
