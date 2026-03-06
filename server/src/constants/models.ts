export const ALLOWED_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
  'deepseek-coder',
] as const;

export type AllowedModel = typeof ALLOWED_MODELS[number];

export const DEFAULT_MODEL: AllowedModel = 'deepseek-chat';
