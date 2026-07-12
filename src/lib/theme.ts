import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const KEY = 'pc-theme'

function apply(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(KEY) as Theme | null) ?? 'system',
  )

  useEffect(() => {
    apply(theme)
    localStorage.setItem(KEY, theme)
  }, [theme])

  function toggle() {
    setTheme((t) => {
      const isDark =
        t === 'dark' ||
        (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      return isDark ? 'light' : 'dark'
    })
  }

  return { theme, setTheme, toggle }
}
