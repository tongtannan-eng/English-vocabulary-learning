import type { ThemeConfig } from 'antd'

export type AppTheme = 'classic' | 'vivid'
export const DEFAULT_THEME: AppTheme = 'vivid'
export const THEME_STORAGE_KEY = 'english-daily-theme'
export const themeOptions: { value: AppTheme; label: string }[] = [
  { value: 'classic', label: '黑白' },
  { value: 'vivid', label: '活力' },
]

// Shared by custom styles and Ant Design, including menus rendered outside the page.
export const palettes = {
  classic: {
    canvas: '#f5f5f4',
    surface: '#ffffff',
    soft: '#f0f0ee',
    text: '#202020',
    secondary: '#5f5f5b',
    muted: '#73736e',
    border: '#d6d6d1',
    divider: '#e5e5e0',
    primary: '#242424',
    buttonBg: '#242424',
    buttonBorder: '#242424',
    buttonText: '#ffffff',
    buttonHover: '#454545',
    info: '#555550',
    headerBg: '#deded9',
    headerText: '#333330',
    taskBg: '#eaeae6',
    taskText: '#30302e',
    taskBorder: '#cecec7',
    achievementBg: '#ffffff',
    achievementText: '#4d4d48',
    achievementBorder: '#cacac3',
    blueBg: '#f0f0ed',
    blueText: '#40403c',
    blueBorder: '#d2d2ca',
    orangeBg: '#ecece8',
    orangeText: '#4b4b44',
    orangeBorder: '#cecec6',
    purpleBg: '#e6e6e2',
    purpleText: '#42423d',
    purpleBorder: '#c9c9c1',
    exampleHighlight: '#b42318',
  },
  vivid: {
    canvas: '#f5faef',
    surface: '#ffffff',
    soft: '#f1f8e9',
    text: '#24351d',
    secondary: '#52634b',
    muted: '#65765c',
    border: '#cfdfc1',
    divider: '#e3ecd9',
    primary: '#287b00',
    buttonBg: '#e5f1d7',
    buttonBorder: '#c0d7a9',
    buttonText: '#355b20',
    buttonHover: '#d8ebc4',
    info: '#1769a3',
    headerBg: '#e1f2c9',
    headerText: '#305313',
    taskBg: '#ebf8db',
    taskText: '#326014',
    taskBorder: '#bfdf98',
    achievementBg: '#eaf5ff',
    achievementText: '#175e91',
    achievementBorder: '#bcdcf3',
    blueBg: '#edf7ff',
    blueText: '#175e91',
    blueBorder: '#bedef4',
    orangeBg: '#fff4df',
    orangeText: '#8e5008',
    orangeBorder: '#f1d19c',
    purpleBg: '#f5eeff',
    purpleText: '#7044a2',
    purpleBorder: '#dac8ef',
    exampleHighlight: '#b42318',
  },
} as const

export function loadTheme(): AppTheme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'classic' ? 'classic' : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function saveTheme(value: AppTheme): boolean {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value)
    window.dispatchEvent(new Event('english-daily-theme-changed'))
    return true
  } catch {
    return false
  }
}

export function applyTheme(value: AppTheme) {
  const palette = palettes[value]
  document.documentElement.dataset.theme = value
  for (const [key, color] of Object.entries(palette)) {
    const name = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    document.documentElement.style.setProperty(`--${name}`, color)
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.canvas)
}

export function getAntTheme(value: AppTheme): ThemeConfig {
  const p = palettes[value]
  return {
    token: {
      colorPrimary: p.primary,
      colorInfo: p.info,
      colorLink: p.primary,
      colorBgLayout: p.canvas,
      colorBgContainer: p.surface,
      colorBgElevated: p.surface,
      colorText: p.text,
      colorTextSecondary: p.secondary,
      colorTextTertiary: p.muted,
      colorBorder: p.border,
      colorBorderSecondary: p.divider,
      colorFillAlter: p.soft,
      colorFillSecondary: p.soft,
      borderRadius: value === 'vivid' ? 12 : 8,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", sans-serif',
      controlHeight: 40,
      boxShadow: 'none',
      boxShadowSecondary: '0 6px 20px #00000012',
    },
    components: {
      Button: {
        fontWeight: 400,
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
      },
      Card: { bodyPadding: 20 },
      Table: { headerBg: p.headerBg, headerColor: p.headerText },
      Segmented: { trackBg: p.soft, itemSelectedBg: p.surface, itemSelectedColor: p.primary },
    },
  }
}
