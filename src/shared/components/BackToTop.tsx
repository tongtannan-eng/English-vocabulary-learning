import { useEffect, useState } from 'react'
import { VerticalAlignTopOutlined } from '@ant-design/icons'
import { Button } from 'antd'

function pageCanScroll(): boolean {
  return document.documentElement.scrollHeight - document.documentElement.clientHeight > 1
}

export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 1 && pageCanScroll())
    update()
    const observer = new ResizeObserver(update)
    observer.observe(document.documentElement)
    const root = document.getElementById('root')
    if (root) observer.observe(root)
    const onChange = () => requestAnimationFrame(update)
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    window.addEventListener('hashchange', onChange)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('hashchange', onChange)
    }
  }, [])

  if (!visible) return null
  return (
    <Button
      className="back-to-top"
      shape="circle"
      icon={<VerticalAlignTopOutlined />}
      aria-label="返回页面顶部"
      title="返回页面顶部"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth',
        })
      }
    />
  )
}
