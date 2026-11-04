import { Component } from 'react'
import type { ReactNode } from 'react'

export class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <main className="page page-loading">
        <h2>页面暂时未能加载</h2>
        <p>请刷新后重试，已保存的数据会保留。</p>
        <button type="button" onClick={() => window.location.reload()}>
          刷新重试
        </button>
      </main>
    ) : (
      this.props.children
    )
  }
}
