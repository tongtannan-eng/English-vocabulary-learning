import { Modal, Typography } from 'antd'
import { formatDate } from '../../../shared/utils/format.ts'
import type { Deck } from '../../../shared/types.ts'

export function DeleteDeckModal({
  deck,
  onConfirm,
  onCancel,
}: {
  deck: Deck
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      open
      title="移入回收站？"
      okText="移入回收站"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      onOk={onConfirm}
      onCancel={onCancel}
    >
      <Typography.Paragraph
        style={{ marginBottom: 0 }}
      >{`确定删除 ${formatDate(deck.date)}${deck.title ? `「${deck.title}」` : ''} 吗？共 ${deck.words.length} 个单词，删除后可在回收站恢复，真实学习记录会保留。`}</Typography.Paragraph>
    </Modal>
  )
}
