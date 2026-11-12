import { gateway, type LanguageModel } from 'ai';
import { codexLocal } from './codex-local';

export type ModelRole = 'player' | 'classifier' | 'judge' | 'narrator';
type V3Model = Extract<LanguageModel, { specificationVersion: 'v3' }>;
export function modelIdFor(id: string, role: ModelRole = 'player'): string {
  return process.env[`PULSE_${role.toUpperCase()}_MODEL`] || id;
}
export function resolveModel(id: string, role: 'narrator'): V3Model;
export function resolveModel(
  id: string,
  role?: Exclude<ModelRole, 'narrator'>,
): LanguageModel;
export function resolveModel(
  id: string,
  role: ModelRole = 'player',
): LanguageModel {
  const selected = modelIdFor(id, role);
  if (selected === 'codex-local') return codexLocal;
  // Preserve string-model default-provider routing for players, objects and judges.
  return role === 'narrator' ? gateway(selected) : selected;
}
