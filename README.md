# 🤖 DeepSeek Code Platform

> 类 Lovable.dev 的 AI 辅助代码平台，由 DeepSeek 驱动，支持本地运行

## 🎯 功能介绍

这是一个运行在本地的 AI 代码编辑平台，让你可以通过自然语言对话来修复、优化和升级你的项目代码。就像 Lovable.dev 一样，但完全运行在你自己的电脑上，支持读写本地文件。

## ✨ 功能特性

- 📁 **文件树浏览器** — 浏览你项目的所有文件
- ✏️ **Monaco 代码编辑器** — VS Code 同款编辑器，支持多标签页
- 💬 **AI 对话面板** — 用中文描述需求，DeepSeek 自动修改代码
- 👁️ **Diff 预览** — 查看 AI 建议的修改，确认后一键应用
- 🔄 **版本历史** — 每次修改前自动备份，支持一键回滚
- 🌐 **实时预览** — iframe 预览你的前端项目效果
- 🐙 **Git 集成** — 支持 commit、push，以及直接克隆 GitHub 仓库

## 🚀 快速开始

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

**Linux/macOS：**
```bash
cp .env.example .env
```

**Windows：**
```bash
copy .env.example .env
```

用文本编辑器打开 `.env` 文件，将 `your_deepseek_api_key_here` 替换为你的真实 API Key。

### 4. 配置文件访问路径（可选）

在 `.env` 中设置 `ALLOWED_ROOT_PATHS` 以限制可访问的目录（未设置时默认允许访问用户 home 目录）：

```env
# Linux/macOS
ALLOWED_ROOT_PATHS=/home/user/projects

# Windows（使用正斜杠或双反斜杠）
ALLOWED_ROOT_PATHS=C:/Users/YourName/projects
```

多个目录用逗号分隔：
```env
ALLOWED_ROOT_PATHS=/home/user/projects,/home/user/work
```

### 5. 启动平台

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

## 📖 使用教程

1. 打开平台后，在首页"打开项目"标签页输入你的项目路径（如 `/home/user/myapp` 或 `C:/Users/YourName/myapp`）
2. 也可以在"克隆仓库"标签页直接输入 GitHub URL 克隆项目
3. 点击"打开"或"克隆"后，左侧会显示项目文件树
4. 点击任意文件在编辑器中打开
5. 在右侧 AI 对话框中描述你的需求，例如：
   - "帮我修复登录页面的 TypeScript 错误"
   - "把所有按钮改成圆角样式"
   - "给这个函数添加错误处理"
   - "优化这个组件的性能"
6. AI 会显示建议的代码修改（Diff 视图）
7. 确认无误后点击"应用修改"，文件自动保存

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
A: 确保输入了正确的绝对路径，且该路径位于 `ALLOWED_ROOT_PATHS` 下（或在 home 目录内）。

**Q: 提示 "Access denied: path is outside allowed directories"？**
A: 在 `.env` 中将项目所在目录添加到 `ALLOWED_ROOT_PATHS`，参见"配置文件访问路径"章节。

**Q: AI 修改后如何撤销？**
A: 点击右上角"历史"按钮，选择对应的历史记录，点击"回滚"。

**Q: 端口 3001 或 5173 被占用？**
A: 修改 `.env` 中的 `SERVER_PORT`，以及 `client/vite.config.ts` 中的端口配置。
