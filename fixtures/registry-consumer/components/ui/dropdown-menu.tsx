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

interface CheckboxItemProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function DropdownMenu({ children }: RootProps) {
  return <>{children}</>;
}

export function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  ...props
}: CheckboxItemProps) {
  return (
    <div
      {...props}
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    />
  );
}

export function DropdownMenuContent({ align: _align, ...props }: ContentProps) {
  return <div {...props} />;
}

export function DropdownMenuItem(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function DropdownMenuLabel(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function DropdownMenuSeparator(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function DropdownMenuTrigger({ children, type = "button", ...props }: TriggerProps) {
  return <button type={type} {...props}>{children}</button>;
}
