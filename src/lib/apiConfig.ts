export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function buildApiUrl(path: string) {
  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  const nextPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${nextPath}`;
}
