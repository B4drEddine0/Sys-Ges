export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequest {
  id: string;
  project_id: string;
  name: string;
  collection_name: string;
  method: ApiMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
  created_by: string;
  updated_at: string;
}

export interface ApiVariable {
  key: string;
  value: string;
}

export interface ApiResponseState {
  status: number;
  statusText: string;
  duration: number;
  headers: Record<string, string>;
  body: string;
  error?: string;
}