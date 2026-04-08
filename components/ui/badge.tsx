import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border-2 border-foreground px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap shadow-[1px_1px_0_0_var(--foreground)] transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:brightness-105",
        catalog:
          "bg-electric/25 text-foreground [a]:hover:bg-electric/35",
        trail:
          "bg-forest text-secondary-foreground [a]:hover:brightness-110",
        /** Single black / ink — matches map trail ink; in dark mode reads as a neutral emphasis chip */
        ink:
          "bg-foreground text-card [a]:hover:brightness-110 dark:bg-card dark:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:brightness-105",
        destructive:
          "bg-destructive/20 text-destructive [a]:hover:bg-destructive/30",
        outline: "bg-card text-foreground [a]:hover:bg-muted",
        ghost:
          "border-transparent shadow-none hover:bg-muted hover:text-muted-foreground",
        link: "border-transparent text-electric shadow-none underline-offset-2 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
