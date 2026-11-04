# 源码目录

根目录只保留浏览器入口 `main.tsx`，按业务和共享职责组织代码：

- `app/App.tsx`：应用状态、持久化调用和页面编排；`app/router.ts`：hash 路由。
- `features/decks/`：单词卡业务；`pages/` 放列表、编辑及回收站页，`components/` 放单词编辑行与中文候选。批量解析、分页筛选/删除撤销、候选浮层定位、回收站合并和重复词逻辑放在同目录纯函数模块中。
- `features/study/`：学习业务；`pages/` 放练习中心、复习、每周、生词本、历史错题本和记录页，`components/` 放今日概览、朗读、拼写控件；`learning.ts` 负责记录/排期/续接，`review.ts` 负责队列和重练，`quick.ts` 负责短时任务选词，`mistakes.ts` 负责历史错题收录、合并、状态及复习选词。
- `features/settings/pages/SettingsPage.tsx`：外观/发音、全局复习习惯、备份/恢复及回收站入口；复用已有存储和备份服务。
- `services/`：浏览器存储、草稿、偏好、备份解析与恢复。`storage.ts` 保持学习状态原子保存，`backup.ts` 处理完整及单组备份，`backupStatus.ts` 计算备份增量，`transaction.ts` 统一处理多键写入回滚。
- `shared/components/`：全站导航、主题切换、折叠模块及 HoverDropdown。
- `shared/hooks/`：共享 hover 交互逻辑；`shared/theme/`：主题与上下文；`shared/utils/`：日期等通用工具；`shared/types.ts`：跨业务基础类型。
- `styles/index.css`：样式汇总入口。基础/导航/单词卡/编辑/学习/设置/主题分别放在对应 CSS 文件，`responsive.css` 最后加载并集中维护窄屏断点。

除首页外的页面通过 React.lazy 加载，加载中和加载失败界面统一处理。首页筛选、分页及删除确认弹窗按需加载。

`features/study/spellingErrors.ts` 从真实错答聚合错误输入和次数，并选择专项重练词；`SpellingComparison` 复用差异展示。`services/speechRate.ts` 管理全局语速、校验与同步。

业务测试与对应模块同目录。新增功能放入相应业务，不把工具、存储或业务逻辑重新堆到 `src/` 根目录。页面可以调用服务，纯业务模块不依赖页面组件。规则入口与文档中的路径必须随目录移动同步更新。
