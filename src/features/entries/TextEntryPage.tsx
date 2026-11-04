import { useEffect, useState } from 'react'
import { Button, Input, Popconfirm, Table, Typography } from 'antd'
import { TopBar } from '../../shared/components/TopBar.tsx'

interface TextEntry {
  id: string
  english: string
  chinese: string
}

interface Props<T extends TextEntry> {
  items: T[]
  onSave: (items: T[]) => string | void
  title: string
  description: string
  englishLabel: string
  englishPlaceholder: string
  addLabel: string
  emptyText: string
  requiredMessage: string
  deleteTitle: string
  add: (items: readonly T[], english: string, chinese: string) => T[] | null
  update: (items: readonly T[], id: string, english: string, chinese: string) => T[] | null
  remove: (items: readonly T[], id: string) => T[]
}

export function TextEntryPage<T extends TextEntry>({
  items,
  onSave,
  title,
  description,
  englishLabel,
  englishPlaceholder,
  addLabel,
  emptyText,
  requiredMessage,
  deleteTitle,
  add,
  update,
  remove,
}: Props<T>) {
  const [english, setEnglish] = useState('')
  const [chinese, setChinese] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = `${title} · 每日单词`
  }, [title])

  function resetForm() {
    setEnglish('')
    setChinese('')
    setEditingId(null)
  }

  function submit() {
    const next = editingId
      ? update(items, editingId, english, chinese)
      : add(items, english, chinese)
    if (!next) {
      setError(requiredMessage)
      return
    }
    const failed = onSave(next)
    if (failed) {
      setError(failed)
      return
    }
    setError('')
    resetForm()
  }

  function edit(item: T) {
    setEditingId(item.id)
    setEnglish(item.english)
    setChinese(item.chinese)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <TopBar />
      <main className="page">
        <div className="page-head">
          <Typography.Title level={3}>{title}</Typography.Title>
          <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
        </div>
        {error ? (
          <Typography.Paragraph type="danger" role="alert">
            {error}
          </Typography.Paragraph>
        ) : null}
        <form
          className="entry-form"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <label>
            <span className="field-label">{englishLabel}</span>
            <Input.TextArea
              value={english}
              autoSize={{ minRows: 2, maxRows: 6 }}
              maxLength={1000}
              placeholder={englishPlaceholder}
              onChange={(event) => setEnglish(event.target.value)}
            />
          </label>
          <label>
            <span className="field-label">中文</span>
            <Input
              value={chinese}
              maxLength={1000}
              placeholder="可以不填"
              onChange={(event) => setChinese(event.target.value)}
            />
          </label>
          <div className="entry-actions">
            <Button type="primary" htmlType="submit">
              {editingId ? '保存修改' : addLabel}
            </Button>
            {editingId ? (
              <Button htmlType="button" onClick={resetForm}>
                取消
              </Button>
            ) : null}
          </div>
        </form>
        <Table<T>
          className="entry-table"
          rowKey="id"
          dataSource={items}
          pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{ emptyText }}
          scroll={{ x: 640 }}
          columns={[
            {
              title: englishLabel,
              dataIndex: 'english',
              render: (text: string) => <span lang="en">{text}</span>,
            },
            {
              title: '中文',
              dataIndex: 'chinese',
              width: 220,
              render: (text: string) => text || '—',
            },
            {
              title: '操作',
              width: 140,
              render: (_value, item) => (
                <div className="entry-row-actions">
                  <Button type="link" onClick={() => edit(item)}>
                    修改
                  </Button>
                  <Popconfirm
                    title={deleteTitle}
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => {
                      const failed = onSave(remove(items, item.id))
                      setError(failed ?? '')
                      if (!failed && editingId === item.id) resetForm()
                    }}
                  >
                    <Button type="link" danger>
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              ),
            },
          ]}
        />
      </main>
    </>
  )
}
