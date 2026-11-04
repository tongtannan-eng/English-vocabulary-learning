import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import 'antd/dist/reset.css'
import { applyTheme, loadTheme } from './shared/theme/theme.ts'
import { ThemeProvider } from './shared/theme/ThemeProvider.tsx'
import './styles/index.css'
import App from './app/App.tsx'

dayjs.locale('zh-cn')
applyTheme(loadTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
