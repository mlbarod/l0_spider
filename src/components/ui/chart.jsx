import * as React from "react"
import { Tooltip as RechartsTooltip } from "recharts"

import { cn } from "@/lib/utils"

const ChartContext = React.createContext({ config: {} })

export const ChartContainer = React.forwardRef(function ChartContainer(
  { className, children, config, ...props },
  ref
) {
  return (
    <ChartContext.Provider value={{ config: config ?? {} }}>
      <div
        ref={ref}
        className={cn("relative h-[320px] w-full", className)}
        {...props}
      >
        {children}
      </div>
    </ChartContext.Provider>
  )
})

export function useChartConfig() {
  return React.useContext(ChartContext)
}

export function ChartTooltip(props) {
  return <RechartsTooltip {...props} />
}

export const ChartTooltipContent = React.forwardRef(function ChartTooltipContent(
  { active, payload, label, hideLabel = false, className, indicator = "line" },
  ref
) {
  const { config } = useChartConfig()

  if (!active || !payload || payload.length === 0) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn(
        "grid gap-1 rounded-md border bg-background p-2 text-xs shadow-sm",
        className
      )}
    >
      {!hideLabel && (
        <div className="font-medium text-foreground">{label}</div>
      )}
      <div className="grid gap-1">
        {payload.map((entry) => {
          const key = entry.dataKey ?? entry.name
          const color = entry.color ?? config?.[key]?.color
          const name = config?.[key]?.label ?? key
          const value = entry.value

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-4"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-2 w-2 flex-shrink-0 rounded-full",
                    indicator === "dashed" && "border border-muted-foreground "
                  )}
                  style={{ backgroundColor: indicator !== "dashed" ? color : undefined }}
                />
                <span className="text-muted-foreground">{name}</span>
              </span>
              <span className="font-mono text-foreground">{value}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
})
