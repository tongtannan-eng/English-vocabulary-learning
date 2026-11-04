import { Button, DatePicker, Input, Select } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useHoverPopup } from '../../../shared/hooks/useHoverPopup.ts'
import { defaultDeckListView } from '../deckList.ts'
import type { DeckListView, DeckStatusFilter } from '../deckList.ts'

export function DeckFilters({
  view,
  updateFilters,
}: {
  view: DeckListView
  updateFilters: (patch: Partial<DeckListView>) => void
}) {
  const datesPopup = useHoverPopup()
  const statusPopup = useHoverPopup()
  const hasFilters = Boolean(view.query || view.startDate || view.endDate || view.status !== 'all')
  return (
    <div className="deck-filters" aria-label="筛选单词卡">
      <Input
        className="deck-search"
        aria-label="搜索名称、英文或中文"
        placeholder="搜索名称、英文或中文"
        prefix={<SearchOutlined />}
        allowClear
        value={view.query}
        onChange={(event) => updateFilters({ query: event.target.value })}
      />
      <div className="deck-filter-options">
        <div
          {...datesPopup.triggerProps}
          className="deck-date-range"
          role="group"
          aria-label="学习日期范围"
        >
          <DatePicker.RangePicker
            open={datesPopup.open}
            onOpenChange={datesPopup.onOpenChange}
            panelRender={(panel) => <div {...datesPopup.panelProps}>{panel}</div>}
            style={{ width: '100%' }}
            placeholder={['开始日期', '结束日期']}
            allowEmpty={[true, true]}
            value={
              view.startDate || view.endDate
                ? [
                    view.startDate ? dayjs(view.startDate) : null,
                    view.endDate ? dayjs(view.endDate) : null,
                  ]
                : null
            }
            onChange={(dates) =>
              updateFilters({
                startDate: dates?.[0]?.format('YYYY-MM-DD') ?? '',
                endDate: dates?.[1]?.format('YYYY-MM-DD') ?? '',
              })
            }
          />
        </div>
        <div {...statusPopup.triggerProps} className="deck-status-filter">
          <Select<DeckStatusFilter>
            style={{ width: '100%' }}
            open={statusPopup.open}
            onOpenChange={statusPopup.onOpenChange}
            popupRender={(menu) => <div {...statusPopup.panelProps}>{menu}</div>}
            aria-label="生词状态"
            value={view.status}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '含生词', value: 'unfamiliar' },
              { label: '含未复习词', value: 'unreviewed' },
              { label: '全部认识', value: 'mastered' },
            ]}
            onChange={(status) => {
              updateFilters({ status })
              statusPopup.setOpen(false)
            }}
          />
        </div>
        <Button disabled={!hasFilters} onClick={() => updateFilters(defaultDeckListView())}>
          重置筛选
        </Button>
      </div>
    </div>
  )
}
