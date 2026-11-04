import { APP_DATA_RESTORED } from '../../services/events.ts'
import { useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { applyTheme, getAntTheme, loadTheme, saveTheme, THEME_STORAGE_KEY } from './theme.ts'
import type { AppTheme } from './theme.ts'
import { ThemeContext } from './themeContext.ts'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(loadTheme)
  const [error, setError] = useState('')
  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])
  useLayoutEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setTheme(loadTheme())
        setError('')
      }
    }
    const restored = () => {
      setTheme(loadTheme())
      setError('')
    }
    window.addEventListener(APP_DATA_RESTORED, restored)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(APP_DATA_RESTORED, restored)
    }
  }, [])
  function changeTheme(value: AppTheme) {
    setError(saveTheme(value) ? '' : '主题已切换，但浏览器未能保存，下次打开可能需要重新选择。')
    setTheme(value)
  }
  return (
    <ThemeContext.Provider value={{ theme, changeTheme, error }}>
      <ConfigProvider locale={zhCN} theme={getAntTheme(theme)}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
