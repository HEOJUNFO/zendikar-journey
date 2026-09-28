// Chat completions on a hosted OpenAI-compatible API (GPT for production, Gemini for testing),
// selected by CHAT_PROVIDER. Embeddings are not routed here: they stay on Ollama (bge-m3)
// so memories stay compatible when switching chat providers.

export type HostedChat = {
  provider: 'openai' | 'gemini';
  url: string;
  apiKey: string;
  model: string;
  reasoningEffort: string | undefined;
};

// Callers pass tiny max_tokens (e.g. 1 for a single digit). Reasoning models spend
// part of the budget thinking, so keep a floor and rely on the prompt for length.
const MIN_MAX_TOKENS = 2048;

export function getHostedChat(): HostedChat | null {
  const provider = process.env.CHAT_PROVIDER;
  if (!provider) return null;
  const reasoningEffort = process.env.CHAT_REASONING_EFFORT;
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("CHAT_PROVIDER=openai needs: npx convex env set OPENAI_API_KEY 'key'");
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
    if (!apiKey) throw new Error("CHAT_PROVIDER=gemini needs: npx convex env set GEMINI_API_KEY 'key'");
    return {
      provider,
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey,
      model: process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.5-flash',
      reasoningEffort,
    };
  }
  throw new Error(`Unknown CHAT_PROVIDER ${provider}. Use 'openai' or 'gemini'.`);
}

export function toHostedBody(hosted: HostedChat, body: Record<string, any>) {
  // Drop params that reasoning models reject; stop words are applied locally instead
  // (see applyStopWords) since support for `stop` varies across models.
  const { max_tokens, temperature, stop, ...rest } = body;
  const maxTokens = Math.max(max_tokens ?? 0, MIN_MAX_TOKENS);
  return {
    ...rest,
    ...(hosted.provider === 'openai'
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens }),
    ...(hosted.reasoningEffort ? { reasoning_effort: hosted.reasoningEffort } : {}),
  };
}

export function applyStopWords(content: string, stopWords: string[]) {
  let end = content.length;
  for (const word of stopWords) {
    const i = content.indexOf(word);
    if (i !== -1 && i < end) end = i;
  }
  return content.slice(0, end);
}
