import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-2 border-foreground bg-primary text-primary-foreground shadow-[3px_3px_0_0_var(--foreground)] hover:brightness-105 active:shadow-[2px_2px_0_0_var(--foreground)]",
        catalog:
          "border-2 border-foreground bg-primary text-primary-foreground uppercase tracking-wide shadow-[4px_4px_0_0_var(--foreground)] hover:brightness-105 active:shadow-[2px_2px_0_0_var(--foreground)]",
        outline:
          "border-2 border-foreground bg-background shadow-[2px_2px_0_0_var(--foreground)] hover:bg-muted aria-expanded:bg-muted aria-expanded:text-foreground",
        outlineThick:
          "border-2 border-foreground bg-card text-foreground shadow-[3px_3px_0_0_var(--foreground)] hover:bg-muted",
        secondary:
          "border-2 border-foreground bg-secondary text-secondary-foreground shadow-[2px_2px_0_0_var(--foreground)] hover:brightness-110 aria-expanded:bg-secondary",
        ghost:
          "hover:bg-muted/80 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        ghostMud:
          "text-foreground hover:bg-mud/90 aria-expanded:bg-mud",
        destructive:
          "border-2 border-foreground bg-destructive/15 text-destructive shadow-[2px_2px_0_0_var(--foreground)] hover:bg-destructive/25 focus-visible:border-destructive focus-visible:ring-destructive/25",
        link: "border-transparent text-electric underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
