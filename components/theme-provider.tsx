'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export const TRAIL_OVERLAY_THEME_STORAGE_KEY = 'trail-overlay-theme'

export type ThemeMode = 'light' | 'dark'

function readStoredTheme(): ThemeMode | null {
  try {
    const v = localStorage.getItem(TRAIL_OVERLAY_THEME_STORAGE_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch {
    /* ignore */
  }
  return null
}

function applyDomTheme(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  root.style.colorScheme = mode === 'dark' ? 'dark' : 'light'
}

type ThemeContextValue = {
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = readStoredTheme()
    const initial = stored ?? 'light'
    applyDomTheme(initial)
    void Promise.resolve().then(() => {
      setThemeState(initial)
      setMounted(true)
    })
  }, [])

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode)
    try {
      localStorage.setItem(TRAIL_OVERLAY_THEME_STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
    applyDomTheme(mode)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(TRAIL_OVERLAY_THEME_STORAGE_KEY, next)
      } catch {
        /* ignore */
      }
      applyDomTheme(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, mounted }),
    [theme, setTheme, toggleTheme, mounted]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}
