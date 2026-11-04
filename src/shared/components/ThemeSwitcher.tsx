import { HoverDropdown } from './HoverDropdown.tsx'
import { Button, Tooltip } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { themeOptions } from '../theme/theme.ts'
import type { AppTheme } from '../theme/theme.ts'
import { useAppTheme } from '../theme/themeContext.ts'

export function ThemeSwitcher() {
  const { theme, changeTheme, error } = useAppTheme()
  return (
    <div className="theme-switcher">
      <Tooltip title={error || undefined}>
        <HoverDropdown
          menu={{
            selectable: true,
            selectedKeys: [theme],
            items: themeOptions.map(({ value, label }) => ({
              key: value,
              label: (
                <span className="theme-option">
                  <span className={`theme-swatch swatch-${value}`} aria-hidden="true" />
                  {label}主题
                </span>
              ),
            })),
            onClick: ({ key }) => changeTheme(key as AppTheme),
          }}
        >
          <Button
            aria-label={`切换主题，当前${themeOptions.find((item) => item.value === theme)?.label}主题`}
          >
            <span className={`theme-swatch swatch-${theme}`} aria-hidden="true" />
            主题 · {theme === 'vivid' ? '活力' : '黑白'}
            <DownOutlined />
          </Button>
        </HoverDropdown>
      </Tooltip>
      {error ? (
        <span className="theme-save-error" role="status">
          {error}
        </span>
      ) : null}
    </div>
  )
}
