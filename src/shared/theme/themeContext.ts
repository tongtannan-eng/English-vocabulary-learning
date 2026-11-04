import { createContext, useContext } from 'react'
import type { AppTheme } from './theme.ts'

export const ThemeContext = createContext<{
  theme: AppTheme
  changeTheme: (theme: AppTheme) => void
  error: string
}>({ theme: 'classic', changeTheme: () => {}, error: '' })
export function useAppTheme() {
  return useContext(ThemeContext)
}
