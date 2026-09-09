import { useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Clock3, Download, Eye, EyeOff, FolderOpen, Loader2, Paperclip, Play, Plus, Save, Trash2, Variable } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { Button, Card, Input, Modal, Select, Textarea } from '@/components/ui';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { readStoredValue, writeStoredValue } from '@/lib/storage';
import { cn } from '@/lib/cn';
import type { ApiMethod, ApiRequest, ApiResponseState, ApiVariable } from '@/features/apiTester/apiTesterTypes';
import { getJsonPath, resolveVariables } from '@/features/apiTester/variableResolver';

type AuthType = 'none' | 'bearer' | 'custom';
const methods: ApiMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const emptyRequest = { name: 'Untitled request', method: 'GET' as ApiMethod, url: '', headers: '{}', body: '' };
const variablesKey = (userId: string, projectId: string) => `sysges-api-env:${userId}:${projectId}`;

interface PostmanItem { name?: string; request?: { method?: string; url?: string | { raw?: string }; header?: Array<{ key?: string; value?: string }>; body?: { raw?: string } }; item?: PostmanItem[]; }
interface ImportedRequest { name: string; collection_name: string; method: ApiMethod; url: string; headers: Record<string, string>; body: string; }
interface PostmanCollection { name?: string; info?: { name?: string }; item?: PostmanItem[]; collection?: { item?: PostmanItem[] }; collections?: PostmanCollection[]; }
function flattenPostmanItems(items: PostmanItem[], parentPath = ''): ImportedRequest[] {
  return items.flatMap((item) => item.item ? flattenPostmanItems(item.item, parentPath ? `${parentPath}/${item.name || 'Folder'}` : (item.name || 'Imported collection')) : item.request ? [{
    name: item.name || 'Imported request',
    collection_name: parentPath || 'General',
    method: (methods.includes((item.request.method || 'GET').toUpperCase() as ApiMethod) ? item.request.method!.toUpperCase() : 'GET') as ApiMethod,
    url: typeof item.request.url === 'string' ? item.request.url : item.request.url?.raw || '',
    headers: Object.fromEntries((item.request.header || []).filter((header) => header.key).map((header) => [header.key!, header.value || ''])),
    body: item.request.body?.raw || '',
  }] : []);
}

function getImportedRequests(collection: PostmanCollection): ImportedRequest[] {
  if (collection.collections?.length) {
    return collection.collections.flatMap((child) => flattenPostmanItems(child.item ?? child.collection?.item ?? [], child.name || 'General'));
  }
  return flattenPostmanItems(collection.item ?? collection.collection?.item ?? [], collection.name || collection.info?.name || '');
}

export function ApiTesterPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const importInput = useRef<HTMLInputElement>(null);
  const [request, setRequest] = useState(emptyRequest);
  const [variables, setVariables] = useState<ApiVariable[]>([]);
  const [authType, setAuthType] = useState<AuthType>('none');
  const [authValue, setAuthValue] = useState('');
  const [customHeader, setCustomHeader] = useState('X-API-Key');
  const [showValues, setShowValues] = useState(false);
  const [response, setResponse] = useState<ApiResponseState | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [extractPath, setExtractPath] = useState('');
  const [extractKey, setExtractKey] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ApiRequest | null>(null);
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<string | null>(null);
  const [renameCollectionTarget, setRenameCollectionTarget] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState('General');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [openCollections, setOpenCollections] = useState<Record<string, boolean>>({ General: true });
  const [showCollectionMenu, setShowCollectionMenu] = useState(false);

  const { data: savedRequests = [] } = useQuery({
    queryKey: ['api-requests', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('api_requests').select('*').eq('project_id', projectId!).order('collection_name', { ascending: true }).order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as ApiRequest[]).map((item) => ({ ...item, collection_name: item.collection_name || 'General' }));
    },
    enabled: Boolean(projectId),
  });

  useEffect(() => {
    if (!user || !projectId) return;
    const stored = readStoredValue<ApiVariable[]>(variablesKey(user.id, projectId), []);
    setVariables(stored);
    if (stored.some((item) => item.key === 'accessToken')) { setAuthType('bearer'); setAuthValue('accessToken'); }
  }, [user, projectId]);

  useEffect(() => {
    if (savedRequests.length === 0) return;
    setOpenCollections(Object.fromEntries(Array.from(new Set(savedRequests.map((saved) => saved.collection_name || 'General'))).map((name) => [name, false])));
  }, [savedRequests]);

  const updateRequest = (field: keyof typeof request, value: string) => setRequest((current) => ({ ...current, [field]: value }));
  const saveVariables = (next: ApiVariable[] = variables) => { if (user && projectId) writeStoredValue(variablesKey(user.id, projectId), next.filter((item) => item.key.trim())); };
  const newRequest = () => { setRequest(emptyRequest); setSelectedRequestId(null); setCollectionName('General'); setAuthType('none'); setAuthValue(''); setResponse(null); };
  const loadRequest = (saved: ApiRequest) => { setRequest({ name: saved.name, method: saved.method, url: saved.url, headers: JSON.stringify(saved.headers, null, 2), body: saved.body }); setSelectedRequestId(saved.id); setCollectionName(saved.collection_name || 'General'); setResponse(null); };

  const saveRequest = async () => {
    if (!user || !projectId || !request.name.trim() || !request.url.trim()) return;
    let headers: Record<string, string>;
    try { headers = JSON.parse(request.headers || '{}') as Record<string, string>; } catch { setResponse({ status: 0, statusText: '', duration: 0, headers: {}, body: '', error: 'Headers must be valid JSON.' }); return; }
    const savedCollectionName = collectionName === '__new__' ? newCollectionName.trim() : collectionName.trim();
    if (!savedCollectionName) return;
    const payload = { project_id: projectId, created_by: user.id, name: request.name.trim(), collection_name: savedCollectionName, method: request.method, url: request.url, headers, body: request.body, updated_at: new Date().toISOString() };
    const { error } = selectedRequestId
      ? await supabase.from('api_requests').update(payload).eq('id', selectedRequestId).eq('project_id', projectId)
      : await supabase.from('api_requests').upsert(payload, { onConflict: 'project_id,collection_name,name' });
    if (!error) void queryClient.invalidateQueries({ queryKey: ['api-requests', projectId] });
  };

  const deleteRequest = async () => {
    if (!projectId || !deleteTarget) return;
    const { error } = await supabase.from('api_requests').delete().eq('id', deleteTarget.id).eq('project_id', projectId);
    if (!error) void queryClient.invalidateQueries({ queryKey: ['api-requests', projectId] });
    setDeleteTarget(null);
  };

  const renameCollection = async () => {
    const nextName = newCollectionName.trim();
    if (!projectId || !renameCollectionTarget || !nextName || nextName === renameCollectionTarget) return;
    const { error } = await supabase.from('api_requests').update({ collection_name: nextName }).eq('project_id', projectId).eq('collection_name', renameCollectionTarget);
    if (!error) void queryClient.invalidateQueries({ queryKey: ['api-requests', projectId] });
    setRenameCollectionTarget(null);
    setNewCollectionName('');
  };

  const deleteCollection = async () => {
    if (!projectId || !deleteCollectionTarget) return;
    const { error } = await supabase.from('api_requests').delete().eq('project_id', projectId).eq('collection_name', deleteCollectionTarget);
    if (!error) void queryClient.invalidateQueries({ queryKey: ['api-requests', projectId] });
    setDeleteCollectionTarget(null);
    if (collectionName === deleteCollectionTarget) newRequest();
  };

  const sendRequest = async () => {
    setIsSending(true);
    const started = performance.now();
    try {
      const url = resolveVariables(request.url, variables);
      const headers = JSON.parse(resolveVariables(request.headers || '{}', variables)) as Record<string, string>;
      const authInput = authValue.trim();
      const authVariable = variables.find((variable) => variable.key.trim() === authInput);
      const auth = authVariable ? authVariable.value : resolveVariables(authInput, variables);
      if (authType === 'bearer' && auth) headers.Authorization = `Bearer ${auth}`;
      if (authType === 'custom' && auth && customHeader.trim()) headers[customHeader.trim()] = auth;
      const init: RequestInit = { method: request.method, headers };
      if (request.method !== 'GET' && request.method !== 'DELETE' && request.body.trim()) init.body = resolveVariables(request.body, variables);
      const result = await fetch(url, init);
      const text = await result.text();
      const responseHeaders: Record<string, string> = {};
      result.headers.forEach((value, key) => { responseHeaders[key] = value; });
      setResponse({ status: result.status, statusText: result.statusText, duration: Math.round(performance.now() - started), headers: responseHeaders, body: text });
    } catch (error) {
      setResponse({ status: 0, statusText: '', duration: Math.round(performance.now() - started), headers: {}, body: '', error: error instanceof Error ? `${error.message} Check the URL and CORS settings.` : 'Request failed.' });
    } finally { setIsSending(false); }
  };

  const importCollection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user || !projectId) return;
    setIsImporting(true);
    try {
      const collection = JSON.parse(await file.text()) as PostmanCollection;
      const importedRequests = getImportedRequests(collection);
      if (importedRequests.length === 0) throw new Error('No requests found');
      const importedNames = importedRequests.map((item) => item.name);
      if (importedNames.length > 0) {
        const { error } = await supabase.from('api_requests').delete().eq('project_id', projectId).eq('collection_name', 'General').in('name', importedNames);
        if (error) throw error;
      }
      for (const item of importedRequests) {
        const { error } = await supabase.from('api_requests').upsert({ project_id: projectId, created_by: user.id, name: item.name, collection_name: item.collection_name, method: item.method, url: item.url, headers: item.headers, body: item.body, updated_at: new Date().toISOString() }, { onConflict: 'project_id,collection_name,name' });
        if (error) throw error;
      }
      void queryClient.invalidateQueries({ queryKey: ['api-requests', projectId] });
    } catch { setResponse({ status: 0, statusText: '', duration: 0, headers: {}, body: '', error: 'Could not import this file. Choose a Postman collection JSON export.' }); }
    finally { setIsImporting(false); }
  };

  const extractVariable = () => {
    if (!response || !extractPath.trim() || !extractKey.trim()) return;
    try {
      const value = getJsonPath(JSON.parse(response.body) as unknown, extractPath);
      if (value !== undefined) { const next = [...variables.filter((item) => item.key !== extractKey.trim()), { key: extractKey.trim(), value: String(value) }]; setVariables(next); saveVariables(next); }
    } catch { /* Response is not JSON. */ }
  };

  const collectionNames = Array.from(new Set(savedRequests.map((saved) => saved.collection_name || 'General')));
  const collectionPicker = <Card className="p-2"><div className="flex flex-wrap items-end gap-2"><label className="min-w-[160px] flex-1 text-xs font-medium">Collection name<Input value={collectionName === '__new__' ? newCollectionName : collectionName} onChange={(event) => { setCollectionName('__new__'); setNewCollectionName(event.target.value); }} placeholder="Users" className="mt-1 h-8 text-sm" /></label><div className="relative"><Button size="md" variant="secondary" aria-label="Attach existing collection" title="Attach existing collection" onClick={() => setShowCollectionMenu((current) => !current)}><Paperclip className="h-4 w-4" />Attach</Button>{showCollectionMenu && <div className="absolute right-0 top-12 z-20 max-h-56 w-56 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl">{collectionNames.map((name) => <button key={name} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setCollectionName(name); setNewCollectionName(''); setShowCollectionMenu(false); }}>{name}</button>)}</div>}</div><Button size="md" variant="ghost" onClick={() => { setRenameCollectionTarget(collectionName); setNewCollectionName(collectionName); }} disabled={collectionName === '__new__' || !collectionName.trim()}>Rename</Button><Button size="md" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => setDeleteCollectionTarget(collectionName)} disabled={collectionName === '__new__' || !collectionName.trim()}><Trash2 className="h-4 w-4" />Delete</Button></div></Card>;

  return (
    <div className="h-full overflow-hidden bg-muted/20 p-3 sm:p-4 lg:p-5">
      <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-3 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Project tools</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">API Tester</h2><p className="mt-1 text-sm text-muted-foreground">Send requests, inspect responses, and keep endpoint variables close to the project.</p></div>
          <div className="flex gap-2"><input ref={importInput} type="file" accept="application/json,.json" className="hidden" onChange={importCollection} /><Button variant="secondary" onClick={() => importInput.current?.click()} disabled={isImporting}>{isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Import collection</Button><Button variant="secondary" onClick={newRequest}><Plus className="h-4 w-4" />New request</Button></div>
        </div>
        <div className="grid min-h-0 flex-1 items-start gap-4 overflow-hidden xl:grid-cols-[220px_minmax(0,1fr)_minmax(320px,0.8fr)]">
          <Card className="min-h-0 h-full overflow-y-auto p-3"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><FolderOpen className="h-4 w-4 text-accent" />Saved requests</div>{savedRequests.length === 0 ? <p className="text-xs text-muted-foreground">Saved requests for this project will appear here.</p> : <div className="space-y-2">{savedRequests.map((saved, index) => <div key={saved.id}>{(index === 0 || savedRequests[index - 1].collection_name !== saved.collection_name) && <button className="mb-1 flex w-full items-center gap-2 px-2 pt-2 text-left text-xs font-semibold text-muted-foreground" onClick={() => setOpenCollections((current) => ({ ...current, [saved.collection_name]: !current[saved.collection_name] }))}><FolderOpen className="h-3.5 w-3.5 text-accent" />{saved.collection_name || 'General'}</button>}{(openCollections[saved.collection_name || 'General'] ?? true) && <div className="group flex items-center gap-1 rounded-lg hover:bg-muted"><button onClick={() => loadRequest(saved)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm"><span className="w-12 shrink-0 font-mono text-[10px] font-bold text-accent">{saved.method}</span><span className="truncate">{saved.name}</span></button><Button size="sm" variant="ghost" aria-label={`Delete ${saved.name}`} title="Delete saved request" className="mr-1 px-2 text-muted-foreground hover:text-rose-600" onClick={() => setDeleteTarget(saved)}><Trash2 className="h-4 w-4" /></Button></div>}</div>)}</div>}</Card>
          <Card className="flex h-full min-h-0 flex-col overflow-hidden p-5">{collectionPicker}<div className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr_auto]"><Select value={request.method} onChange={(event) => updateRequest('method', event.target.value)}>{methods.map((method) => <option key={method}>{method}</option>)}</Select><Input value={request.url} onChange={(event) => updateRequest('url', event.target.value)} placeholder="https://api.example.com/users/{{userId}}" /><Button onClick={sendRequest} disabled={isSending || !request.url.trim()}>{isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Send</Button></div><div className="mt-2 grid gap-2"><label className="text-sm font-medium">Request name<Input value={request.name} onChange={(event) => updateRequest('name', event.target.value)} className="mt-1" /></label><div className="rounded-xl border border-border bg-muted/20 p-2"><div className="mb-2 text-sm font-semibold">Authorization</div><div className="grid gap-2 sm:grid-cols-[150px_1fr]"><Select value={authType} onChange={(event) => setAuthType(event.target.value as AuthType)}><option value="none">No auth</option><option value="bearer">Bearer token</option><option value="custom">Custom header</option></Select>{authType === 'custom' && <Input value={customHeader} onChange={(event) => setCustomHeader(event.target.value)} placeholder="X-API-Key" />}{authType !== 'none' && <Input type={showValues ? 'text' : 'password'} value={authValue} onChange={(event) => setAuthValue(event.target.value)} placeholder={authType === 'bearer' ? 'Paste token or variable name, e.g. accessToken' : 'Value or variable name'} />}</div>{authType !== 'none' && <p className="mt-2 text-xs text-muted-foreground">Enter a raw token or a private variable name. It is attached only when you send.</p>}</div><label className="text-sm font-medium">Headers <span className="font-normal text-muted-foreground">JSON</span><Textarea value={request.headers} onChange={(event) => updateRequest('headers', event.target.value)} className="mt-1 min-h-[110px] max-h-[180px] overflow-auto font-mono text-xs" placeholder={'{"Content-Type":"application/json"}'} /></label><label className="text-sm font-medium">Body <span className="font-normal text-muted-foreground">optional</span><Textarea value={request.body} onChange={(event) => updateRequest('body', event.target.value)} className="mt-1 min-h-[120px] max-h-[190px] overflow-auto font-mono text-xs" placeholder={'{\n  "name": "Ada"\n}'} /></label></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={saveRequest}><Save className="h-4 w-4" />Save request</Button><span className="self-center text-xs text-muted-foreground">Variables use double-brace names.</span></div></Card>
          <div className="min-h-0 space-y-4 overflow-hidden"><Card className="p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Variable className="h-4 w-4 text-accent" />Private variables</div><Button size="sm" variant="ghost" onClick={() => setVariables((current) => [...current, { key: '', value: '' }])}><Plus className="h-4 w-4" />Add</Button></div><p className="mt-1 text-xs text-muted-foreground">Stored only in this browser for your account and project.</p><div className="mt-4 space-y-2">{variables.map((variable, index) => <div key={`variable-${index}`} className="flex gap-2"><Input value={variable.key} onChange={(event) => setVariables((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value } : item))} placeholder="accessToken" /><Input type={showValues ? 'text' : 'password'} value={variable.value} onChange={(event) => setVariables((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} placeholder="value" /><Button size="sm" variant="ghost" onClick={() => { if (!variable.key.trim()) return; setAuthType('bearer'); setAuthValue(variable.key.trim()); }} disabled={!variable.key.trim()} title="Use this variable as the Bearer token">Bearer</Button><Button size="sm" variant="ghost" aria-label="Remove variable" onClick={() => { const next = variables.filter((_, itemIndex) => itemIndex !== index); setVariables(next); saveVariables(next); }}><Trash2 className="h-4 w-4" /></Button></div>)}</div><div className="mt-3 flex justify-between"><Button size="sm" variant="ghost" onClick={() => setShowValues((current) => !current)}>{showValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {showValues ? 'Hide values' : 'Show values'}</Button><Button size="sm" variant="secondary" onClick={() => saveVariables()}>Save variables</Button></div></Card><ResponsePanel response={response} copied={copied} setCopied={setCopied} extractKey={extractKey} extractPath={extractPath} setExtractKey={setExtractKey} setExtractPath={setExtractPath} extractVariable={extractVariable} /></div>
        </div>
        <Modal open={Boolean(deleteTarget)} title="Delete saved request" description="This request will be removed from the project." onClose={() => setDeleteTarget(null)}>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void deleteRequest()}><Trash2 className="h-4 w-4" />Delete request</Button>
          </div>
        </Modal>
        <Modal open={Boolean(renameCollectionTarget)} title="Rename group" description="All requests in this group will receive the new group name." onClose={() => setRenameCollectionTarget(null)}>
          <Input value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} placeholder="New group name" />
          <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setRenameCollectionTarget(null)}>Cancel</Button><Button onClick={() => void renameCollection()}>Rename group</Button></div>
        </Modal>
        <Modal open={Boolean(deleteCollectionTarget)} title="Delete group" description="This will permanently delete every saved request in this group." onClose={() => setDeleteCollectionTarget(null)}>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteCollectionTarget(null)}>Cancel</Button><Button variant="destructive" onClick={() => void deleteCollection()}><Trash2 className="h-4 w-4" />Delete group</Button></div>
        </Modal>
      </div>
    </div>
  );
}

function ResponsePanel({ response, copied, setCopied, extractKey, extractPath, setExtractKey, setExtractPath, extractVariable }: { response: ApiResponseState | null; copied: boolean; setCopied: (value: boolean) => void; extractKey: string; extractPath: string; setExtractKey: (value: string) => void; setExtractPath: (value: string) => void; extractVariable: () => void }) {
  const formattedBody = response?.body ? (() => { try { return JSON.stringify(JSON.parse(response.body), null, 2); } catch { return response.body; } })() : '';
  const copyResponse = async () => { if (!response) return; await navigator.clipboard.writeText(response.body); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  return <Card className="p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Response</h3><div className="flex items-center gap-3">{response && !response.error && <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className={cn('font-semibold', response.status >= 400 ? 'text-rose-600' : 'text-emerald-600')}>{response.status} {response.statusText}</span><span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{response.duration} ms</span></div>}{response && <Button size="sm" variant="ghost" onClick={copyResponse} disabled={!response.body}>{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Clipboard className="h-4 w-4" />} {copied ? 'Copied' : 'Copy response'}</Button>}</div></div><div className="mt-4 max-h-[460px] min-h-[250px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{response?.error ? <p className="text-rose-300">{response.error}</p> : response ? <pre className="whitespace-pre-wrap break-words">{formattedBody || '(empty response)'}</pre> : <p className="text-slate-400">Send a request to see its response.</p>}</div>{response && !response.error && <div className="mt-4 space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Save response value</p><div className="grid gap-2 sm:grid-cols-2"><Input value={extractPath} onChange={(event) => setExtractPath(event.target.value)} placeholder="data.access_token" /><div className="flex gap-2"><Input value={extractKey} onChange={(event) => setExtractKey(event.target.value)} placeholder="accessToken" /><Button size="sm" onClick={extractVariable}>Save</Button></div></div></div>}</Card>;
}










