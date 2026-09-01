import * as React from "react";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label(props: LabelProps) {
  return <label {...props} />;
}
