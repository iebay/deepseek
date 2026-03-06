import { ALLOWED_MODELS, DEFAULT_MODEL } from '../constants/models';

const COMPLEX_PATTERNS = /重构|架构|性能优化|设计模式|debug|诊断|为什么|分析.*问题/;
const SIMPLE_PATTERNS = /添加注释|格式化|改个名|加个按钮|修改颜色|改.*样式/;

export function selectModel(userMessage: string, requestedModel?: string): string {
  if (requestedModel && ALLOWED_MODELS.includes(requestedModel)) return requestedModel;

  if (COMPLEX_PATTERNS.test(userMessage)) return 'deepseek-reasoner';
  if (SIMPLE_PATTERNS.test(userMessage)) return 'deepseek-chat';
  return DEFAULT_MODEL;
}
