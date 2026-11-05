import { useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Flex, Input, Modal, Pagination, Typography } from 'antd'
import { parseBulkWords } from '../bulk.ts'
import { findDuplicates } from '../duplicates.ts'
import type { BulkRow } from '../bulk.ts'
import type { Deck, DraftWord } from '../../../shared/types.ts'

type PreviewRow = BulkRow & { id: string; selected: boolean }
export function BulkImportModal({
  open,
  onClose,
  onAppend,
  words,
  decks,
  editingDeckId,
}: {
  open: boolean
  onClose: () => void
  onAppend: (rows: DraftWord[]) => void
  words: DraftWord[]
  decks: Deck[]
  editingDeckId?: string
}) {
  const [raw, setRaw] = useState('')
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [error, setError] = useState('')
  const [skipped, setSkipped] = useState(0)
  const [page, setPage] = useState(1)
  const selected = rows.filter((row) => row.selected)
  const invalid = selected.some((row) => row.error || !row.english.trim() || !row.chinese.trim())
  const duplicates = useMemo(
    () => findDuplicates([...words, ...rows.filter((row) => row.selected)], decks, editingDeckId),
    [words, rows, decks, editingDeckId],
  )
  function preview() {
    const parsed = parseBulkWords(raw)
    setError(parsed.error ?? '')
    setSkipped(parsed.skipped)
    setRows(parsed.rows.map((row) => ({ ...row, id: crypto.randomUUID(), selected: true })))
    setPage(1)
  }
  function patch(id: string, update: Partial<PreviewRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...update } : row)))
  }
  return (
    <Modal
      open={open}
      title="批量粘贴录入"
      onCancel={onClose}
      width={820}
      centered
      styles={{ body: { maxHeight: 'calc(100dvh - 240px)', overflowY: 'auto' } }}
      footer={
        <Flex justify="space-between" align="center" wrap gap={12}>
          <Typography.Text type="secondary">
            已选 {selected.length} / {rows.length} 行
            {skipped ? ` · 忽略 ${skipped} 个空行或表头` : ''}
          </Typography.Text>
          <Flex gap={8}>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              disabled={!selected.length || invalid}
              onClick={() => {
                onAppend(
                  selected.map(({ id, english, chinese, collocations, notes }) => ({
                    id,
                    english,
                    chinese,
                    collocations,
                    notes,
                  })),
                )
                setRaw('')
                setRows([])
                setError('')
                onClose()
              }}
            >
              添加所选单词
            </Button>
          </Flex>
        </Flex>
      }
    >
      <Typography.Paragraph type="secondary">
        可从 Excel 复制两至四列：英文、中文释义、搭配（选填）、备注（选填）。也支持 CSV 或每行“apple
        苹果”。重复词会提醒，可保留不同词义。
      </Typography.Paragraph>
      <div className="bulk-example">
        <table>
          <caption>四列录入示例</caption>
          <thead>
            <tr>
              <th scope="col">英文</th>
              <th scope="col">中文释义</th>
              <th scope="col">常用搭配</th>
              <th scope="col">个人备注</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td lang="en">apple</td>
              <td>苹果</td>
              <td lang="en">an apple a day</td>
              <td>记忆方法</td>
            </tr>
            <tr>
              <td lang="en">take care of</td>
              <td>照顾</td>
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <Input.TextArea
        allowClear
        aria-label="批量录入原文"
        value={raw}
        onChange={(event) => {
          setRaw(event.target.value)
          setRows([])
          setError('')
        }}
        rows={6}
        placeholder="在这里粘贴 Excel、CSV 或“英文 中文释义”文本"
      />
      <Button className="bulk-preview-button" onClick={preview} disabled={!raw.trim()}>
        解析并预览
      </Button>
      {error ? <Alert type="error" showIcon title={error} /> : null}
      {rows.length ? (
        <>
          <Flex justify="space-between" align="center" wrap gap={8} className="bulk-toolbar">
            <Checkbox
              checked={selected.length === rows.length}
              indeterminate={selected.length > 0 && selected.length < rows.length}
              onChange={(event) =>
                setRows((current) =>
                  current.map((row) => ({ ...row, selected: event.target.checked })),
                )
              }
            >
              选择全部
            </Checkbox>
            <Pagination
              size="small"
              current={page}
              pageSize={20}
              total={rows.length}
              showSizeChanger={false}
              onChange={setPage}
            />
          </Flex>
          <div className="bulk-preview-list">
            {rows.slice((page - 1) * 20, page * 20).map((row) => (
              <div className="bulk-preview-row" key={row.id}>
                <div className="bulk-preview-fields">
                  <Checkbox
                    aria-label={`选择原文第 ${row.line} 行`}
                    checked={row.selected}
                    onChange={(event) => patch(row.id, { selected: event.target.checked })}
                  />
                  <span className="bulk-row-number">第 {row.line} 行</span>
                  <Input
                    allowClear
                    aria-label={`第 ${row.line} 行英文`}
                    value={row.english}
                    onChange={(event) => patch(row.id, { english: event.target.value })}
                    placeholder="英文"
                  />
                  <Input
                    allowClear
                    aria-label={`第 ${row.line} 行释义`}
                    value={row.chinese}
                    onChange={(event) => patch(row.id, { chinese: event.target.value })}
                    placeholder="中文释义"
                  />
                </div>
                {row.error || !row.english.trim() || !row.chinese.trim() ? (
                  <Typography.Text type="danger">
                    {row.error || '请补全英文和释义，或取消选择这一行。'}
                  </Typography.Text>
                ) : null}
                {row.selected && duplicates.has(row.id) ? (
                  <Typography.Paragraph className="bulk-duplicate">
                    重复提醒：
                    {duplicates
                      .get(row.id)!
                      .slice(0, 2)
                      .map(
                        (match) =>
                          `${match.row ? `当前或预览第 ${match.row} 行` : `${match.date}${match.title ? ` · ${match.title}` : ''}`} · ${match.chinese || '未填释义'}`,
                      )
                      .join('；')}
                    。允许保留不同词义。
                  </Typography.Paragraph>
                ) : null}
                {row.collocations || row.notes ? (
                  <details>
                    <summary>搭配与备注</summary>
                    <p className="bulk-extra">
                      {row.collocations}
                      {row.collocations && row.notes ? '\n' : ''}
                      {row.notes}
                    </p>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
          {invalid ? (
            <Typography.Paragraph type="secondary">
              所选内容中还有未填完整或格式有误的行，请先修正；未选行不会添加。
            </Typography.Paragraph>
          ) : null}
        </>
      ) : null}
    </Modal>
  )
}
