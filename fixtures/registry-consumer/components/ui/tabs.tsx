// Consumer-owned shadcn `tabs` primitive, stubbed at the shape the skins use.
import * as React from "react";

interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({ value: _value, defaultValue: _defaultValue, onValueChange: _onValueChange, ...props }: TabsProps) {
  return <div {...props} />;
}

export function TabsList(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" {...props} />;
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({ value, ...props }: TabsTriggerProps) {
  return <button type="button" role="tab" data-value={value} {...props} />;
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({ value, ...props }: TabsContentProps) {
  return <div role="tabpanel" data-value={value} {...props} />;
}
