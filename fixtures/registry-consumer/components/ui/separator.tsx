import * as React from "react";

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export function Separator({ orientation, ...props }: SeparatorProps) {
  return <div role="separator" aria-orientation={orientation} {...props} />;
}
