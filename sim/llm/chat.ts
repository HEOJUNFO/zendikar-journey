// Chat completions on a hosted OpenAI-compatible API (GPT for production, Gemini for testing),
// selected by CHAT_PROVIDER. The game needs it; there is no rules-only mode.

export type HostedChat = {
  provider: 'openai' | 'gemini';
  url: string;
  apiKey: string;
  model: string;
  reasoningEffort: string | undefined;
};

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// Reasoning models spend part of the budget thinking, so keep a floor and rely on the
// prompt for length.
const MIN_MAX_TOKENS = 2048;
const MAX_RETRIES = 3;

export function getHostedChat(): HostedChat {
  const provider = process.env.CHAT_PROVIDER;
  const reasoningEffort = process.env.CHAT_REASONING_EFFORT;
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('CHAT_PROVIDER=openai needs OPENAI_API_KEY in .env');
    return {
      provider,
      url: 'https://api.openai.com/v1/chat/completions',
      apiKey,
      model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-5-mini',
      reasoningEffort,
    };
  }
  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('CHAT_PROVIDER=gemini needs GEMINI_API_KEY in .env');
    return {
      provider,
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey,
      model: process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.5-flash',
      reasoningEffort,
    };
  }
  throw new Error(`.env 에 CHAT_PROVIDER=openai 또는 gemini 가 필요하다 (지금: ${provider ?? '없음'}).`);
}

export function toHostedBody(hosted: HostedChat, messages: ChatMessage[], maxTokens = 0) {
  const tokens = Math.max(maxTokens, MIN_MAX_TOKENS);
  return {
    model: hosted.model,
    messages,
    ...(hosted.provider === 'openai' ? { max_completion_tokens: tokens } : { max_tokens: tokens }),
    ...(hosted.reasoningEffort ? { reasoning_effort: hosted.reasoningEffort } : {}),
  };
}

export async function chatCompletion(messages: ChatMessage[], maxTokens?: number): Promise<string> {
  const hosted = getHostedChat();
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(hosted.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hosted.apiKey}` },
      body: JSON.stringify(toHostedBody(hosted, messages, maxTokens)),
    });
    if (res.ok) {
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content;
      if (content === undefined) throw new Error(`Unexpected chat response: ${JSON.stringify(json)}`);
      return content;
    }
    const error = await res.text();
    const retry = res.status === 429 || res.status >= 500;
    if (!retry || attempt >= MAX_RETRIES) {
      throw new Error(`Chat completion failed with code ${res.status}: ${error}`);
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt + Math.random() * 500));
  }
}

// The JSON object in a model answer, which may be wrapped in prose or a code fence.
export function extractJson(content: string): unknown {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
}
