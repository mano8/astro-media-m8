import * as React from "react";

interface RootProps {
  children?: React.ReactNode;
}

interface ContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
}

interface TriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function Popover({ children }: RootProps) {
  return <>{children}</>;
}

export function PopoverContent({ align: _align, ...props }: ContentProps) {
  return <div {...props} />;
}

export function PopoverTrigger({ children, type = "button", ...props }: TriggerProps) {
  return <button type={type} {...props}>{children}</button>;
}
