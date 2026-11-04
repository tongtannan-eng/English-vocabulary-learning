import type { ReactNode } from 'react'
import { useSyncExternalStore } from 'react'
import { RightOutlined } from '@ant-design/icons'
import {
  parseUiPreferences,
  subscribeUiPreferences,
  togglePanel,
  uiSnapshot,
} from '../../services/preferences.ts'
import type { PanelId } from '../../services/preferences.ts'

export function CollapsibleSection({
  id,
  title,
  summary,
  action,
  className = '',
  children,
}: {
  id: PanelId
  title: string
  summary?: ReactNode
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  const raw = useSyncExternalStore(subscribeUiPreferences, uiSnapshot, () => null)
  const collapsed = parseUiPreferences(raw).collapsedPanels.includes(id)
  return (
    <section className={`collapsible-section ${className}`} aria-label={title}>
      <div className="collapsible-heading">
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={!collapsed}
          aria-controls={`panel-${id}`}
          onClick={() => togglePanel(id)}
        >
          <RightOutlined aria-hidden className={collapsed ? undefined : 'is-open'} />
          <span className="panel-title">{title}</span>
          {summary ? <span className="panel-summary">{summary}</span> : null}
          <span className="panel-toggle-label">{collapsed ? '展开' : '收起'}</span>
        </button>
        {action ? <div className="panel-action">{action}</div> : null}
      </div>
      <div id={`panel-${id}`} hidden={collapsed} className="collapsible-body">
        {collapsed ? null : children}
      </div>
    </section>
  )
}
