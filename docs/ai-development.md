# AI 开发规范与工具接入

本项目用根目录 `AGENTS.md` 维护一份共享规则，工具入口由 `scripts/ai-rules.mjs` 同步。规则保存在项目中，换电脑或更换工具时随项目一起使用，无需修改个人全局配置。

## 工具入口

- **Codex CLI、IDE 扩展及桌面应用**：根目录 `AGENTS.md`。从项目根目录启动任务，尤其本项目尚未使用 Git 时，避免从不包含该文件的其他目录启动。
- **Cursor**：`.cursor/rules/project.mdc` 和 `.cursor/rules/dropdown-hover.mdc`，均设置 `alwaysApply: true`。完整规则正文写入 `.mdc`，不依赖普通文件引用自动展开。
- **Claude Code**：根目录 `CLAUDE.md` 使用 `@AGENTS.md` 原生导入，兼容需要 CLAUDE.md 的会话和版本。
- **GitHub Copilot**：`.github/copilot-instructions.md` 包含完整共享规则，兼顾不同 Copilot 场景对 AGENTS.md 支持程度不同的情况。
- **Gemini CLI**：根目录 `GEMINI.md` 使用 `@./AGENTS.md` 原生导入。
- **Windsurf / Cascade**：`.windsurf/rules/project.md`，设置 `trigger: always_on`；同时提供 `.devin/rules/project.md` 兼容新版目录。两份内容完全相同。

这些文件是规则的加载入口，不会安装或登录相应工具，不会修改全局权限、审批或模型配置。实际加载受工具版本、项目受信任状态和项目指令开关影响；文件存在不代表所有工具都已完成实际加载验收。

## 规则涵盖什么

- 中文释义候选点击展开，其他下拉保留 hover 交互与组件复用，兼容键盘及触屏。
- 项目技术栈与业务模块位置，避免重复实现和无关重构。
- 黑白 / 活力主题的语义色、状态层次和窄屏布局。
- 用户数据保护、旧数据及备份兼容、原子保存和失败提示。
- 自动草稿、复习续接、首次成绩与去重口径、间隔排期、听写答案保护。
- 所需依赖可直接添加，保留用户修改，完成实际验证后再报告。

## 如何维护

1. 只修改根目录 `AGENTS.md` 中的共享规则。
2. 运行 `npm run rules:sync`，更新各工具的入口。
3. 运行 `npm run rules:check`，检查入口是否缺失、过期及普通 Dropdown 是否绕过共享组件。
4. 同时修改业务代码时，运行 `npm run lint`、`npm test`、`npm run build`，并做相关浏览器验收。

`npm run lint` 已包含 `rules:check`，`npm test` 包含规则脚本的隔离回归验证；可用 `npm run test:rules` 单独检查同步、漂移检测及下拉入口约束。带 `GENERATED` 注释的文件不要单独编辑，否则检查会报不同步；确需调整入口格式时，修改同步脚本后重新同步。新增工具入口也在同步脚本中登记。

静态检查只拦截常见的 Ant Design Dropdown 直接引入与共享组件 trigger 改动，不证明 Select、DatePicker、候选框或键盘/触屏行为正确。交互仍按 `AGENTS.md` 要求做浏览器验证。规则用于给 AI 提供上下文，不能保证模型永不违反；检查命令是额外的确定性约束。

## 如何确认生效

建议更新规则后在项目根目录开始新会话，要求 AI 复述「下拉触发方式、应复用的组件、保护哪些学习数据、需要运行哪些验证命令」，确认回答对应本项目。

- Cursor：检查项目 Rules 面板中两条 `.mdc` 均为始终应用。
- Codex：新会话询问已加载的项目指令，确认包含根目录 `AGENTS.md`。已有会话不要仅凭文件变更推断它已重载。
- Claude Code：使用 `/context` 检查 Memory files 中的项目指令，确认导入内容；如关闭了项目指令，需在工具中自行启用。
- Gemini CLI：用 `/memory reload` 重新加载、`/memory show` 查看共享内容。
- Copilot：在支持的 Chat 场景检查响应的 References / 引用或项目指令状态；不同 IDE、代码审查和补全场景的支持不完全相同。
- Windsurf / Cascade：在 Rules 面板检查项目规则与 Always On 状态。

本次完成了入口格式、文件一致性和本项目构建检查；未逐个启动或登录以上 AI 工具验证上下文加载。

## 官方依据

入口格式按以下官方文档核对，工具后续升级时以对应文档为准：

- [Cursor Rules](https://cursor.com/docs/rules)
- [Codex 的 AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Claude Code 项目记忆与导入](https://code.claude.com/docs/en/memory)
- [GitHub Copilot 仓库指令](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions)
- [Gemini CLI 的 GEMINI.md](https://geminicli.com/docs/cli/gemini-md/)
- [Windsurf / Cascade Memories & Rules](https://docs.windsurf.com/windsurf/cascade/memories)
