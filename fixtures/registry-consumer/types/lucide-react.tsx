import * as React from "react";

export type IconProps = React.SVGProps<SVGSVGElement>;
export type Icon = React.ComponentType<IconProps>;

function createIcon(name: string): Icon {
  const Component = (props: IconProps) => <svg aria-label={name} {...props} />;
  Component.displayName = name;
  return Component;
}

export const AlertCircle = createIcon("AlertCircle");
export const AlertTriangle = createIcon("AlertTriangle");
export const ArrowDown = createIcon("ArrowDown");
export const ArrowUp = createIcon("ArrowUp");
export const Boxes = createIcon("Boxes");
export const Check = createIcon("Check");
export const ChevronLeft = createIcon("ChevronLeft");
export const ChevronRight = createIcon("ChevronRight");
export const ChevronsLeft = createIcon("ChevronsLeft");
export const ChevronsRight = createIcon("ChevronsRight");
export const ChevronsUpDown = createIcon("ChevronsUpDown");
export const Clock = createIcon("Clock");
export const CloudOff = createIcon("CloudOff");
export const Database = createIcon("Database");
export const EyeOff = createIcon("EyeOff");
export const HardDrive = createIcon("HardDrive");
export const Inbox = createIcon("Inbox");
export const LayoutDashboard = createIcon("LayoutDashboard");
export const PlusCircle = createIcon("PlusCircle");
export const Search = createIcon("Search");
export const Settings2 = createIcon("Settings2");
export const ShieldAlert = createIcon("ShieldAlert");
export const Trash2 = createIcon("Trash2");
export const Wrench = createIcon("Wrench");
export const X = createIcon("X");
