"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { ChevronDown, Check } from "lucide-react";

import { cn } from "@/lib/utils";

// ---- Root & Label ----

function SelectRoot<Value>(props: SelectPrimitive.Root.Props<Value>) {
  return <SelectPrimitive.Root {...props} />;
}

// ---- Trigger: looks like Input ----

const SelectTrigger = ({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) => (
  <SelectPrimitive.Trigger
    className={cn(
      "flex h-9 w-full items-center justify-between rounded-sm border border-line bg-canvas px-3 text-sm text-ink",
      "shadow-[var(--shadow-xs)]",
      "hover:border-line-strong",
      "focus:outline-none focus:border-line-focus focus:shadow-[var(--shadow-focus)]",
      "disabled:bg-surface-1 disabled:text-ink-3 disabled:cursor-not-allowed disabled:opacity-45",
      "transition-[border-color,box-shadow] duration-quick",
      "data-[popup-open]:border-line-focus data-[popup-open]:shadow-[var(--shadow-focus)]",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.Value placeholder="Select…" />
    <ChevronDown className="size-4 text-ink-3 shrink-0 ml-1" aria-hidden="true" />
  </SelectPrimitive.Trigger>
);
SelectTrigger.displayName = "SelectTrigger";

// ---- Positioner + Popup ----

const SelectPositioner = ({
  className,
  ...props
}: SelectPrimitive.Positioner.Props) => (
  <SelectPrimitive.Positioner
    className={cn("z-[var(--z-overlay,20)]", className)}
    {...props}
  />
);
SelectPositioner.displayName = "SelectPositioner";

const SelectPopup = ({
  className,
  ...props
}: SelectPrimitive.Popup.Props) => (
  <SelectPrimitive.Popup
    className={cn(
      "bg-canvas border border-line shadow-[var(--shadow-lg)] rounded-lg p-1 min-w-[8rem]",
      "transition-[opacity,transform] duration-quick ease-out",
      "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[starting-style]:-translate-y-1",
      className,
    )}
    {...props}
  />
);
SelectPopup.displayName = "SelectPopup";

// ---- Item ----

const SelectItem = ({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) => (
  <SelectPrimitive.Item
    className={cn(
      "relative flex items-center gap-2 px-3 py-2 rounded-sm text-sm text-ink cursor-default select-none",
      "hover:bg-surface-1",
      "data-[selected]:bg-accent-soft data-[selected]:text-accent-ink",
      "focus:outline-none focus:bg-surface-1",
      "transition-colors duration-instant",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="ml-auto">
      <Check className="size-3.5 text-accent" aria-hidden="true" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
);
SelectItem.displayName = "SelectItem";

// ---- Portal ----
const SelectPortal = SelectPrimitive.Portal;

// ---- Convenience: full composed Select component ----
// Accepts standard <select> options pattern via `options` prop
type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type SelectProps<T extends string = string> = {
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T | null) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  name?: string;
  required?: boolean;
};

function Select<T extends string = string>({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  name,
  required,
}: SelectProps<T>) {
  return (
    <SelectRoot<T>
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      name={name}
      required={required}
      disabled={disabled}
    >
      <SelectTrigger className={className} />
      <SelectPortal>
        <SelectPositioner>
          <SelectPopup>
            {options.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value as never}
                disabled={opt.disabled}
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </SelectPositioner>
      </SelectPortal>
    </SelectRoot>
  );
}

export {
  Select,
  SelectRoot,
  SelectTrigger,
  SelectPositioner,
  SelectPopup,
  SelectItem,
  SelectPortal,
};
