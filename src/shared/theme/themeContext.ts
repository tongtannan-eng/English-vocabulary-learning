import { createContext, useContext } from 'react'
import type { AppTheme } from './theme.ts'
import { DEFAULT_THEME } from './theme.ts'

export const ThemeContext = createContext<{
  theme: AppTheme
  changeTheme: (theme: AppTheme) => void
  error: string
}>({ theme: DEFAULT_THEME, changeTheme: () => {}, error: '' })
export function useAppTheme() {
  return useContext(ThemeContext)
}
