import { useEffect, useState } from 'react'
import { App as AntApp, Alert, Button, Empty, Flex, Modal, Typography } from 'antd'
import { TopBar } from '../../../shared/components/TopBar.tsx'
import { formatDate } from '../../../shared/utils/format.ts'
import type { StudyState } from '../../study/learning.ts'
import type { TrashResult } from '../../../services/trash.ts'
import type { TrashEntry } from '../../../services/trashTypes.ts'

export function TrashPage({
  state,
  onRestore,
  onPurge,
}: {
  state: StudyState
  onRestore: (id: string) => TrashResult
  onPurge: (id: string) => TrashResult
}) {
  const { message: feedback } = AntApp.useApp()
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pending, setPending] = useState<TrashEntry | null>(null)
  useEffect(() => {
    document.title = '回收站 · 每日单词'
  }, [])
  function restore(id: string) {
    const result = onRestore(id)
    if (!('error' in result)) void feedback.success(result.message)
    else void feedback.error(result.error)
    setNotice(
      'error' in result
        ? { type: 'error', text: result.error }
        : { type: 'success', text: result.message },
    )
  }
  function purge() {
    if (!pending) return
    const result = onPurge(pending.id)
    if (!('error' in result)) void feedback.success(result.message)
    else void feedback.error(result.error)
    setNotice(
      'error' in result
        ? { type: 'error', text: result.error }
        : { type: 'success', text: result.message },
    )
    if (!('error' in result)) setPending(null)
  }
  return (
    <>
      <TopBar action={<Button href="#/settings/trash">返回偏好与数据</Button>} />
      <main className="page">
        <div className="page-head">
          <Typography.Title level={3}>回收站</Typography.Title>
          <Typography.Paragraph type="secondary">
            删除的单词卡会保留在这里，不自动清空。完整备份包含回收站；永久删除前请确认。
          </Typography.Paragraph>
        </div>
        {notice ? (
          <Alert
            type={notice.type}
            title={notice.text}
            showIcon
            closable
            onClose={() => setNotice(null)}
          />
        ) : null}
        {(state.trash ?? []).length === 0 ? (
          <Empty description="回收站为空" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="stack trash-list">
            {state.trash!.map((entry) => (
              <section key={entry.id} className="trash-card">
                <div>
                  <Typography.Title level={4}>
                    {entry.deck.title || formatDate(entry.deck.date)}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary">
                    {formatDate(entry.deck.date)} · {entry.deck.words.length} 个词 · 删除于{' '}
                    {new Date(entry.deletedAt).toLocaleString('zh-CN')}
                  </Typography.Paragraph>
                  {entry.draft || Object.keys(entry.sessions).length ? (
                    <Typography.Text type="secondary">
                      附有{entry.draft ? '编辑草稿' : ''}
                      {entry.draft && Object.keys(entry.sessions).length ? '和' : ''}
                      {Object.keys(entry.sessions).length ? '未完成复习' : ''}
                    </Typography.Text>
                  ) : null}
                </div>
                <Flex gap={8} wrap>
                  <Button type="primary" onClick={() => restore(entry.id)}>
                    {state.decks.some((deck) => deck.id === entry.deck.id)
                      ? '恢复为副本'
                      : '恢复单词卡'}
                  </Button>
                  <Button danger onClick={() => setPending(entry)}>
                    永久删除
                  </Button>
                </Flex>
              </section>
            ))}
          </div>
        )}
      </main>
      <Modal
        open={pending !== null}
        title="永久删除这条记录？"
        okText="永久删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        onOk={purge}
        onCancel={() => setPending(null)}
      >
        <Typography.Paragraph>
          这会删除回收站中的单词卡及附带草稿和进度，无法撤销。原有的真实学习成绩不会删除。
        </Typography.Paragraph>
      </Modal>
    </>
  )
}
