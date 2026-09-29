import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close
const DialogTitle = DialogPrimitive.Title
const DialogDescription = DialogPrimitive.Description

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-[90] bg-[rgba(18,25,21,.38)] backdrop-blur-[2px] data-[state=closed]:animate-[qna-fade-out_150ms_ease-in] data-[state=open]:animate-[qna-fade-in_180ms_ease-out]",
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef(({ className, children, showClose = true, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-qna-modal
      className={cn(
        "fixed left-1/2 top-1/2 z-[91] grid max-h-[calc(100vh-48px)] w-[min(1040px,calc(100vw-64px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[16px] border border-[#d5e3ec] bg-white shadow-[0_24px_70px_rgba(15,23,42,.18)] outline-none data-[state=closed]:animate-[qna-dialog-out_160ms_ease-in] data-[state=open]:animate-[qna-dialog-in_200ms_ease-out]",
        className,
      )}
      {...props}
    >
      {children}
      {showClose ? (
        <DialogPrimitive.Close className="absolute right-5 top-5 z-10 grid size-9 place-items-center rounded-[8px] text-[#676c73] transition hover:bg-[#edf3f7] hover:text-[#0f2233] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(7,136,223,.22)]">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">닫기</span>
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger }
