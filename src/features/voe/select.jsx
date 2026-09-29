import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between gap-3 rounded-[8px] border border-[#d5e3ec] bg-white px-3 text-[13px] text-[#263b4a] outline-none transition data-[placeholder]:text-[#989da3] focus:border-[#6ec0f7] focus:ring-[3px] focus:ring-[rgba(7,136,223,.12)]",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild><ChevronDown className="size-4 text-[#7a8086]" /></SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "z-[110] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[9px] border border-[#d5e3ec] bg-white p-1 shadow-[0_14px_38px_rgba(15,23,42,.14)]",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex min-h-9 cursor-default select-none items-center rounded-[6px] py-2 pl-8 pr-3 text-[12px] text-[#263b4a] outline-none data-[highlighted]:bg-[#e2f2fd] data-[highlighted]:text-[#0673bc]",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2.5 grid size-4 place-items-center">
      <SelectPrimitive.ItemIndicator><Check className="size-3.5" /></SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
