import * as React from "react";

export function Command(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function CommandEmpty(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function CommandGroup(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function CommandInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export interface CommandItemProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  onSelect?: (value: string) => void;
}

export function CommandItem({ onSelect, ...props }: CommandItemProps) {
  return <div {...props} onClick={() => onSelect?.("")} />;
}

export function CommandList(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function CommandSeparator(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}
