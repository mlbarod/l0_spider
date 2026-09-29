import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] font-semibold leading-none",
  {
    variants: {
      variant: {
        default: "border-[#cce8da] bg-[#eaf7f1] text-[#187a50]",
        muted: "border-[#e2e5e3] bg-[#f5f7f6] text-[#676c73]",
        amber: "border-[#efd8b0] bg-[#fff6e5] text-[#94600f]",
        blue: "border-[#cbdceb] bg-[#eff6fb] text-[#3a6482]",
        outline: "border-[#dfe3e1] bg-white text-[#52585f]",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

function Badge({ className, variant, ...props }) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
