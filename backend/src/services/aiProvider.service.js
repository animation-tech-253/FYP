import Groq   from 'groq-sdk';
import OpenAI  from 'openai';

// Collect all numbered keys for a provider: GROQ_API_KEY_1, GROQ_API_KEY_2, ...
// Falls back to plain key (GROQ_API_KEY) for backward compatibility.
function getKeys(prefix) {
  const keys = [];
  let i = 1;
  while (process.env[`${prefix}_${i}`]) {
    keys.push(process.env[`${prefix}_${i}`]);
    i++;
  }
  if (keys.length === 0 && process.env[prefix]) {
    keys.push(process.env[prefix]);
  }
  return keys;
}

function isRateLimit(err) {
  return (
    err?.status === 429 ||
    err?.error?.code === 'rate_limit_exceeded' ||
    String(err?.message).includes('429') ||
    String(err?.message).toLowerCase().includes('rate limit')
  );
}

// Try each key in order; move to next key on 429.
async function rotateKeys(keys, makeClient, invoke) {
  for (let i = 0; i < keys.length; i++) {
    try {
      return await invoke(makeClient(keys[i]));
    } catch (err) {
      if (isRateLimit(err) && i < keys.length - 1) continue;
      throw err;
    }
  }
  throw new Error('All API keys exhausted. Add more keys or switch provider in Admin → Settings.');
}

/**
 * Unified AI call — provider and model come from SystemSettings (DB).
 * @param {object} opts
 * @param {string}   opts.provider   — 'groq' | 'openrouter' | 'together' | 'gemini'
 * @param {string}   opts.model      — model name for the chosen provider
 * @param {Array}    opts.messages   — OpenAI-format messages array
 * @param {number}  [opts.maxTokens] — default 600
 * @param {number}  [opts.temperature] — default 0.45
 */
export async function callAI({ provider, model, messages, maxTokens = 600, temperature = 0.45 }) {
  switch (provider) {

    case 'groq': {
      const keys = getKeys('GROQ_API_KEY');
      if (!keys.length) throw new Error('No Groq API keys found in .env (GROQ_API_KEY_1, ...).');
      return rotateKeys(
        keys,
        (key) => new Groq({ apiKey: key }),
        async (client) => {
          const res = await client.chat.completions.create({ model, messages, max_tokens: maxTokens, temperature });
          return res.choices[0].message.content.trim();
        },
      );
    }

    case 'openrouter': {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error('OPENROUTER_API_KEY not set in .env.');
      const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: key });
      const res = await client.chat.completions.create({ model, messages, max_tokens: maxTokens, temperature });
      return res.choices[0].message.content.trim();
    }

    case 'together': {
      const key = process.env.TOGETHER_API_KEY;
      if (!key) throw new Error('TOGETHER_API_KEY not set in .env.');
      const client = new OpenAI({ baseURL: 'https://api.together.xyz/v1', apiKey: key });
      const res = await client.chat.completions.create({ model, messages, max_tokens: maxTokens, temperature });
      return res.choices[0].message.content.trim();
    }

    case 'gemini': {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY not set in .env.');
      const client = new OpenAI({
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey:  key,
      });
      const res = await client.chat.completions.create({ model, messages, max_tokens: maxTokens, temperature });
      return res.choices[0].message.content.trim();
    }

    default:
      throw new Error(`Unknown AI provider: "${provider}". Valid options: groq, openrouter, together, gemini.`);
  }
}

// Returns which providers have keys configured — exposed to admin UI (no key values).
export function getConfiguredProviders() {
  return {
    groq:        getKeys('GROQ_API_KEY').length,   // number of keys
    openrouter:  !!process.env.OPENROUTER_API_KEY,
    together:    !!process.env.TOGETHER_API_KEY,
    gemini:      !!process.env.GEMINI_API_KEY,
  };
}
