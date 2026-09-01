import * as React from "react";

interface SelectProps {
  children?: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
}

interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left";
}

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function Select({ children }: SelectProps) {
  return <>{children}</>;
}

export function SelectContent({ side: _side, ...props }: SelectContentProps) {
  return <div {...props} />;
}

export function SelectItem({ value, ...props }: SelectItemProps) {
  return <div {...props} data-value={value} />;
}

export function SelectTrigger(props: React.HTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} />;
}

export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string | number;
}

export function SelectValue({ placeholder: _placeholder, ...props }: SelectValueProps) {
  return <span {...props} />;
}
