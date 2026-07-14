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
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#080A12' : '#F1F3F9')
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(KEY) as Theme | null) ?? 'system',
  )

  useEffect(() => {
    apply(theme)
    localStorage.setItem(KEY, theme)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const syncSystemTheme = () => {
      if (theme === 'system') apply(theme)
    }
    media.addEventListener('change', syncSystemTheme)
    return () => media.removeEventListener('change', syncSystemTheme)
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
