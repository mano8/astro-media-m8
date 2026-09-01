import * as React from "react";

interface RootProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface TriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function Dialog({ children }: RootProps) {
  return <>{children}</>;
}

export function DialogContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function DialogDescription(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} />;
}

export function DialogFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function DialogHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function DialogTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} />;
}

export function DialogTrigger({ children, type = "button", ...props }: TriggerProps) {
  return <button type={type} {...props}>{children}</button>;
}
