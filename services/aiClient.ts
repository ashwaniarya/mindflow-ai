// Client for the MindFlow AI session service (server/), which proxies xAI.
// VITE_AI_SERVICE_URL and VITE_AI_APP_KEY are set at build time. The app key is a
// per-app key, limited by CORS and rate limiting on the service; it is not the xAI key.
const BASE = (import.meta.env.VITE_AI_SERVICE_URL || '').replace(/\/$/, '');
const APP_KEY = import.meta.env.VITE_AI_APP_KEY || '';

export const aiEnabled = Boolean(BASE && APP_KEY);

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': APP_KEY },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`AI service ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface SessionReply { session_id: string; reply: string }

/** Start a session; if `message` is given the first reply comes back in the same call. */
export const createSession = (opts: { system?: string; message?: string; response_format?: unknown }) =>
  post<SessionReply>('/v1/sessions', opts);

/** Continue a session. History is stored server-side. */
export const continueSession = (sessionId: string, message: string, response_format?: unknown) =>
  post<SessionReply>(`/v1/sessions/${sessionId}/messages`, { message, response_format });

/** Stream a reply. Calls onDelta for each text chunk and resolves with the full reply. */
export async function streamSession(sessionId: string, message: string, onDelta: (text: string) => void): Promise<string> {
  const response = await fetch(`${BASE}/v1/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': APP_KEY },
    body: JSON.stringify({ message, stream: true }),
  });
  if (!response.ok || !response.body) throw new Error(`AI service ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      const type = event.match(/^event: (.*)$/m)?.[1];
      const data = event.match(/^data: (.*)$/m)?.[1];
      if (!data) continue;
      const parsed = JSON.parse(data);
      if (type === 'delta') { full += parsed.text; onDelta(parsed.text); }
      if (type === 'done') full = parsed.reply;
    }
  }
  return full;
}

/** Stateless completion with tools, used by the ReAct agent loop. */
export const complete = (body: { messages: ChatMessage[]; tools?: unknown[]; response_format?: unknown }) =>
  post<{ message: ChatMessage; finish_reason: string }>('/v1/complete', body);
