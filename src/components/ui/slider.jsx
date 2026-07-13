// src/components/ui/slider.jsx
import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef(
  ({ className, value, defaultValue, ...props }, ref) => {
    const resolvedValues = React.useMemo(() => {
      if (Array.isArray(value) && value.length > 0) return value
      if (Array.isArray(defaultValue) && defaultValue.length > 0) return defaultValue
      if (typeof value === "number") return [value]
      if (typeof defaultValue === "number") return [defaultValue]
      return [0]
    }, [value, defaultValue])
    const thumbCount = Math.max(resolvedValues.length, 1)

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center", className)}
        value={value}
        defaultValue={defaultValue}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        {Array.from({ length: thumbCount }).map((_, index) => (
          <SliderPrimitive.Thumb
            key={index}
            className="block size-4 rounded-full border border-primary/40 bg-background shadow ring-offset-background transition-[box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        ))}
      </SliderPrimitive.Root>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
