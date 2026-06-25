const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

type ClaudeUsage = {
  input_tokens: number;
  output_tokens: number;
};

type ClaudeResponse = {
  content: { type: string; text?: string }[];
  usage: ClaudeUsage;
};

async function postToClaude(body: Record<string, unknown>, label: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const json: ClaudeResponse = await response.json();
  const text = json.content.find((block) => block.type === 'text')?.text ?? '';

  console.log('[Claude API]', {
    function: label,
    inputTokens: json.usage?.input_tokens,
    outputTokens: json.usage?.output_tokens,
    webSearch: Boolean((body.tools as unknown[] | undefined)?.length),
    estimatedCost:
      ((json.usage?.input_tokens ?? 0) * 3 + (json.usage?.output_tokens ?? 0) * 15) / 1_000_000,
  });

  return text;
}

export async function callClaude(
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
  label = 'callClaude'
): Promise<string> {
  return postToClaude(
    {
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    },
    label
  );
}

export async function callClaudeWithWebSearch(
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
  label = 'callClaudeWithWebSearch'
): Promise<string> {
  return postToClaude(
    {
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    },
    label
  );
}

// Strips markdown code fences and attempts to recover from truncated JSON
// responses by trimming back to the last complete structure.
export function parseJsonFromClaude<T>(raw: string): T | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through to repair attempts
  }

  // Try progressively shorter substrings, closing off arrays/objects as we go.
  for (let end = cleaned.length; end > 0; end--) {
    const char = cleaned[end - 1];
    if (char !== ',' && char !== '{' && char !== '[' && char !== ':' && char !== ' ') {
      const candidate = cleaned.slice(0, end);
      for (const suffix of ['', ']', '}', ']}', '"}', '"}]', '}]}']) {
        try {
          return JSON.parse(candidate + suffix) as T;
        } catch {
          // keep trying
        }
      }
    }
  }

  console.log('[Claude API] failed to parse JSON response:', cleaned.slice(0, 200));
  return null;
}
