import type { ApiVariable } from './apiTesterTypes';

export function resolveVariables(value: string, variables: ApiVariable[]) {
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => {
    return variables.find((variable) => variable.key === key)?.value ?? `{{${key}}}`;
  });
}

export function getJsonPath(value: unknown, path: string): unknown {
  return path.split('.').filter(Boolean).reduce<unknown>((current, part) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(part)) return current[Number(part)];
    if (typeof current === 'object') return (current as Record<string, unknown>)[part];
    return undefined;
  }, value);
}