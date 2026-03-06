export const ALLOWED_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
  'deepseek-coder',
] as const;

export type AllowedModel = typeof ALLOWED_MODELS[number];

export const DEFAULT_MODEL: AllowedModel = 'deepseek-chat';

export function resolveModel(input: string): AllowedModel {
  if ((ALLOWED_MODELS as readonly string[]).includes(input)) return input as AllowedModel;
  return DEFAULT_MODEL;
}
