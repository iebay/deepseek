import OpenAI from 'openai';

// 缓存的 OpenAI 客户端实例和上次使用的 API Key
let _client: OpenAI | null = null;
let _lastApiKey: string | undefined;

/**
 * 获取 OpenAI 客户端单例（懒加载）
 * 如果 DEEPSEEK_API_KEY 未配置则返回 null
 * 当 API Key 发生变化时会自动重建客户端
 */
export function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  // API Key 发生变化时重建客户端
  if (!_client || _lastApiKey !== apiKey) {
    _lastApiKey = apiKey;
    _client = new OpenAI({
      apiKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      timeout: 60_000,
      maxRetries: 2,
    });
  }

  return _client;
}
