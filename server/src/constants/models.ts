export const ALLOWED_MODELS = [
  'deepseek-chat',       // V4 最新旗舰
  'deepseek-reasoner',   // R1 深度推理
] as const;

export type AllowedModel = typeof ALLOWED_MODELS[number];

export const DEFAULT_MODEL: AllowedModel = 'deepseek-chat';

export function isAllowedModel(model: string): model is AllowedModel {
  return (ALLOWED_MODELS as readonly string[]).includes(model);
}

export function resolveModel(input: string): AllowedModel {
  if (isAllowedModel(input)) return input;
  return DEFAULT_MODEL;
}
