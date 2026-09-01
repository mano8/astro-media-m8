import * as React from "react";

export function Toaster(_props: Record<string, unknown>): React.JSX.Element {
  return <div />;
}

type ToastOptions = { description?: string };

export const toast = {
  success(_title: string, _options?: ToastOptions): void {},
  error(_title: string, _options?: ToastOptions): void {},
  info(_title: string, _options?: ToastOptions): void {},
};
