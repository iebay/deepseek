# 🤖 DeepSeek Code Platform

> 类 Lovable.dev 的 AI 辅助代码平台，由 DeepSeek 驱动，支持 Windows 本地运行

## 🎯 功能介绍

这是一个运行在本地的 AI 代码编辑平台，让你可以通过自然语言对话来修复、优化和升级你的项目代码。就像 Lovable.dev 一样，但完全运行在你自己的电脑上，支持读写本地文件。

## ✨ 功能特性

- 📁 **文件树浏览器** — 浏览你项目的所有文件
- ✏️ **Monaco 代码编辑器** — VS Code 同款编辑器，支持多标签页
- 💬 **AI 对话面板** — 用中文描述需求，DeepSeek 自动修改代码
- 🤖 **Agent 代理模式** — AI 自主探索代码、执行修改、运行验证，无需手动操作
- 👁️ **Diff 预览** — 查看 AI 建议的修改，确认后一键应用
- 🔄 **版本历史** — 每次修改前自动备份，支持一键回滚
- 🌐 **实时预览** — iframe 预览你的前端项目效果

## 🚀 快速开始（Windows）

### 1. 克隆仓库

```bash
git clone https://github.com/iebay/deepseek.git
cd deepseek
```

### 2. 安装依赖

```bash
npm run install:all
```

### 3. 配置 DeepSeek API Key

```bash
copy .env.example .env
```

用记事本打开 `.env` 文件，将 `your_deepseek_api_key_here` 替换为你的真实 API Key。

### 4. 启动平台

```bash
npm run dev
```

浏览器打开 **http://localhost:5173** 即可使用！

## 🔑 获取 DeepSeek API Key

1. 访问 [platform.deepseek.com](https://platform.deepseek.com)
2. 注册/登录账号
3. 进入 API Keys 页面
4. 创建新的 API Key
5. 复制到 `.env` 文件中

## 🤖 Agent 代理模式

Agent 模式让 AI 能够像 GitHub Copilot Workspace 一样自主工作：

### 功能

点击顶栏的 **Bot 图标（🤖）** 即可打开 Agent 面板。

### 工作流程

1. 在 Agent 面板输入任务描述（如"帮我重构登录组件，添加表单验证"）
2. Agent 自动按以下步骤执行：
   - 🧠 **思考** — 分析需求，制定计划
   - 🔧 **工具调用** — 读取文件、搜索代码
   - ✏️ **执行修改** — 直接写入文件
   - ✅ **验证** — 运行 tsc/eslint 检查
   - 📋 **总结** — 报告完成情况

### 可用工具

| 工具 | 描述 |
|------|------|
| `read_file` | 读取项目文件内容 |
| `write_file` | 创建或修改文件 |
| `search_code` | 在项目中搜索代码 |
| `list_directory` | 列出目录结构 |
| `run_command` | 执行安全 shell 命令 |
| `git_status` | 获取 git 状态 |
| `task_complete` | 标记任务完成 |

### 安全说明

- `run_command` 仅允许: `npm`, `npx`, `tsc`, `eslint`, `prettier`, `cat`, `ls`, `echo`, `node -e`
- 禁止写入 `node_modules` 和 `.git` 目录
- 所有文件操作受 `ALLOWED_ROOT_PATHS` 安全限制
- Agent 任务最多执行 15 步，防止无限循环

## 📖 使用教程

1. 打开平台后，在首页输入你的项目路径（如 `C:\Users\你的名字\Projects\myapp`）
2. 点击"打开项目"，左侧会显示项目文件树
3. 点击任意文件在编辑器中打开
4. 在右侧 AI 对话框中描述你的需求，例如：
   - "帮我修复登录页面的 TypeScript 错误"
   - "把所有按钮改成圆角样式"
   - "给这个函数添加错误处理"
   - "优化这个组件的性能"
5. AI 会显示建议的代码修改（Diff 视图）
6. 确认无误后点击"应用修改"，文件自动保存

## 🛠️ 技术栈

| 部分 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| 编辑器 | Monaco Editor（VS Code 同款） |
| AI | DeepSeek API（deepseek-chat / deepseek-reasoner） |
| 后端 | Node.js + Express |
| 状态管理 | Zustand |

## ❓ 常见问题

**Q: 提示 "DEEPSEEK_API_KEY is not set"？**
A: 检查 `.env` 文件是否存在，且 API Key 已正确填写。

**Q: 文件树不显示我的项目？**
A: 确保输入了正确的 Windows 绝对路径，如 `C:\Users\xxx\myproject`。

**Q: AI 修改后如何撤销？**
A: 点击右上角"历史"按钮，选择对应的历史记录，点击"回滚"。

**Q: 端口 3001 或 5173 被占用？**
A: 修改 `.env` 中的 `SERVER_PORT`，以及 `client/vite.config.ts` 中的端口配置。
