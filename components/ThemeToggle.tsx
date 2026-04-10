'use client'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

type ThemeToggleProps = {
  className?: string
  size?: 'sm' | 'md'
}

/** Segmented control matching the “All data / On map” viewport toggle in LeftDrawer. */
export default function ThemeToggle({ className, size = 'md' }: ThemeToggleProps) {
  const { theme, setTheme, mounted } = useTheme()
  const isDark = theme === 'dark'

  const pad = size === 'sm' ? 'py-1' : 'py-1.5'
  const text = size === 'sm' ? 'text-[11px]' : 'text-xs'
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'

  const blockThemeClicks = !mounted

  return (
    <div className={cn('flex w-full min-w-0 items-center gap-0', className)}>
      <button
        type="button"
        onClick={() => {
          if (!mounted || !isDark) return
          setTheme('light')
        }}
        aria-disabled={blockThemeClicks}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 border-2 border-r-0 border-foreground font-bold uppercase tracking-wide transition-colors',
          pad,
          text,
          !isDark
            ? 'bg-foreground text-background'
            : 'bg-card text-muted-foreground hover:bg-mud/80',
          blockThemeClicks && 'pointer-events-none cursor-not-allowed opacity-40'
        )}
        aria-pressed={!isDark}
        aria-label="Light mode"
        title="Light mode"
      >
        <FontAwesomeIcon icon={faSun} className={icon} aria-hidden />
        Light
      </button>
      <button
        type="button"
        onClick={() => {
          if (!mounted || isDark) return
          setTheme('dark')
        }}
        aria-disabled={blockThemeClicks}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 border-2 border-foreground font-bold uppercase tracking-wide transition-colors',
          pad,
          text,
          isDark
            ? 'bg-foreground text-background'
            : 'bg-card text-muted-foreground hover:bg-mud/80',
          blockThemeClicks && 'pointer-events-none cursor-not-allowed opacity-40'
        )}
        aria-pressed={isDark}
        aria-label="Dark mode"
        title="Dark mode"
      >
        <FontAwesomeIcon icon={faMoon} className={icon} aria-hidden />
        Dark
      </button>
    </div>
  )
}
