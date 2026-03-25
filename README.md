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
| AI | DeepSeek API（deepseek-chat / deepseek-reasoner / deepseek-coder） |
| 后端 | Node.js + Express |
| 状态管理 | Zustand |

## ⚡ 本地 DeepSeek 模型优化建议

如果你是本地部署（例如通过兼容 OpenAI API 的本地服务）并希望更快、更稳、更省显存，可以按下面顺序优化：

### 1) 先做观测，再做调优

- 先记录 3 个核心指标：
  - **首 token 延迟（TTFT）**
  - **输出速度（tokens/s）**
  - **显存占用（VRAM）**
- 每次只改一个参数，避免“多变量同时变化”导致无法定位瓶颈。

### 2) 优先调上下文长度（最影响速度与显存）

- 将会话上下文限制在业务可接受范围（例如 4k / 8k），长对话用摘要替代全量历史。
- 代码场景建议只附加“当前文件 + 相关文件片段”，避免一次注入整个仓库内容。
- 通常上下文越长，显存与延迟会明显上升。

### 3) 根据任务切模型

- 日常代码补全/改小功能：优先用“更小或中等参数量模型”。
- 架构设计/复杂推理：再切到推理模型。
- 在本平台中可把“通用模型”设为默认，复杂任务再手动切换，整体体验会更流畅。

### 4) 量化与硬件匹配

- GPU 显存紧张时，优先尝试更低比特量化（如 4-bit / 5-bit），先保证可用性。
- 如果显存足够，适当提高量化精度可提升代码生成稳定性。
- CPU 推理时，注意线程数、NUMA 绑定和内存带宽；很多场景下“中小模型 + 合理线程”比大模型更快。

### 5) 生成参数建议（代码任务）

- `temperature`: 建议从 **0.1 ~ 0.4** 起步（更稳定）。
- `top_p`: 建议 **0.8 ~ 0.95**。
- `max_tokens`: 控制在“够用即可”，过大容易拖慢并增加跑偏概率。
- 对“严格改代码”类请求，优先低温度 + 更明确约束（文件路径、函数名、输出格式）。

### 6) Prompt 与上下文组织优化

- 把“项目规则/代码规范”写成短而硬的固定系统提示。
- 历史消息做“滚动摘要”，不要无限累积。
- 对长文件只截取必要片段，并提供精确行号或函数名。

### 7) 工程层优化（本项目可直接受益）

- 尽量减少无关文件注入到模型上下文（会直接影响 token 成本）。
- 将常用依赖说明、项目约定缓存为“项目记忆”，避免每轮重复发送。
- 如果你接的是本地 API 网关，建议开启 keep-alive、减少重复建连。

### 8) 推荐调参流程（实战）

1. 固定一个基准任务（例如“修改 2 个文件并通过构建”）。
2. 在相同输入下记录 TTFT / tokens/s / 成功率。
3. 先调上下文长度，再调模型大小，再调温度和 top_p。
4. 最后在“速度、质量、显存”三者中选一个你最看重的平衡点。

> 经验法则：本地模型优化中，**上下文管理**通常比“盲目换更大模型”更能提升体感速度与稳定性。

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
