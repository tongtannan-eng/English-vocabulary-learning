import { Pagination } from 'antd'

export function DeckPagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}) {
  return (
    <Pagination
      current={page}
      pageSize={pageSize}
      total={total}
      showSizeChanger={false}
      showQuickJumper={total > 100}
      responsive
      onChange={onChange}
      showTotal={(count, range) => `${range[0]}–${range[1]} / ${count} 组`}
    />
  )
}
