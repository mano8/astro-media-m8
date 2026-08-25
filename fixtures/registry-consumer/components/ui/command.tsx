import * as React from "react";

export interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {
  shouldFilter?: boolean;
}

export function Command({ shouldFilter: _shouldFilter, ...props }: CommandProps) {
  return <div {...props} />;
}

export function CommandEmpty(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: React.ReactNode;
}

export function CommandGroup({ heading: _heading, ...props }: CommandGroupProps) {
  return <div {...props} />;
}

export function CommandInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export interface CommandItemProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  value?: string;
  onSelect?: (value: string) => void;
}

export function CommandItem({ onSelect, value: _value, ...props }: CommandItemProps) {
  return <div {...props} onClick={() => onSelect?.("")} />;
}

export function CommandList(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function CommandSeparator(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}
