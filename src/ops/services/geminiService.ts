/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

export type AiProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq' | 'mistral' | 'perplexity' | 'cohere' | 'custom';

export interface AiProviderConfig {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  endpoint: string;
  mode: 'live' | 'demo';
  temperature: number;
}

export interface SuggestedInfluencer {
  handle: string;
  platform: string;
  followers: string;
  engagement: string;
  niche: string;
  location: string;
  relevanceReason: string;
  recentPerformance: string;
  audienceAlignment: string;
}

export const AI_PROVIDER_PRESETS: Record<AiProviderId, { label: string; model: string; endpoint: string; envKey: string; supportsSearch?: boolean }> = {
  gemini: {
    label: 'Google Gemini',
    model: 'gemini-2.5-flash',
    endpoint: 'google-genai-sdk',
    envKey: 'VITE_GEMINI_API_KEY',
    supportsSearch: true,
  },
  openai: {
    label: 'OpenAI',
    model: 'gpt-4.1-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    envKey: 'VITE_OPENAI_API_KEY',
  },
  anthropic: {
    label: 'Anthropic',
    model: 'claude-3-5-sonnet-latest',
    endpoint: 'https://api.anthropic.com/v1/messages',
    envKey: 'VITE_ANTHROPIC_API_KEY',
  },
  openrouter: {
    label: 'OpenRouter',
    model: 'openai/gpt-4o-mini',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    envKey: 'VITE_OPENROUTER_API_KEY',
  },
  groq: {
    label: 'Groq',
    model: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'VITE_GROQ_API_KEY',
  },
  mistral: {
    label: 'Mistral',
    model: 'mistral-large-latest',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    envKey: 'VITE_MISTRAL_API_KEY',
  },
  perplexity: {
    label: 'Perplexity',
    model: 'sonar-pro',
    endpoint: 'https://api.perplexity.ai/chat/completions',
    envKey: 'VITE_PERPLEXITY_API_KEY',
    supportsSearch: true,
  },
  cohere: {
    label: 'Cohere',
    model: 'command-r-plus',
    endpoint: 'https://api.cohere.com/v2/chat',
    envKey: 'VITE_COHERE_API_KEY',
  },
  custom: {
    label: 'Custom OpenAI-Compatible',
    model: 'custom-model',
    endpoint: 'https://your-provider.example/v1/chat/completions',
    envKey: 'VITE_CUSTOM_AI_API_KEY',
  },
};

const SETTINGS_KEY = 'trygc-settings';

function envValue(key: string) {
  return ((import.meta as any).env?.[key] || '').trim();
}

function isUsableApiKey(value: string) {
  const key = (value || '').trim();
  if (!key) return false;
  const lower = key.toLowerCase();
  const blocked = [
    'your_',
    'my_',
    'replace_',
    'changeme',
    'example',
    'placeholder',
    'api_key_here',
    'test_key',
    'dummy',
  ];
  return !blocked.some((token) => lower.includes(token));
}

export function getDiscoveryProviderConfig(): AiProviderConfig {
  const fallbackProvider: AiProviderId = 'gemini';
  const fallbackPreset = AI_PROVIDER_PRESETS[fallbackProvider];
  const fallbackApiKey = envValue(fallbackPreset.envKey);
  const fallbackLive = isUsableApiKey(fallbackApiKey);
  const base: AiProviderConfig = {
    provider: fallbackProvider,
    model: fallbackPreset.model,
    endpoint: fallbackPreset.endpoint,
    apiKey: fallbackLive ? fallbackApiKey : '',
    mode: fallbackLive ? 'live' : 'demo',
    temperature: 0.35,
  };

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    const ai = parsed.aiProvider as Partial<AiProviderConfig> | undefined;
    if (!ai?.provider || !AI_PROVIDER_PRESETS[ai.provider]) return base;
    const preset = AI_PROVIDER_PRESETS[ai.provider];
    const requestedApiKey = (ai.apiKey || envValue(preset.envKey) || '').trim();
    const live = isUsableApiKey(requestedApiKey);
    return {
      provider: ai.provider,
      model: ai.model || preset.model,
      endpoint: ai.endpoint || preset.endpoint,
      apiKey: live ? requestedApiKey : '',
      mode: live && ai.mode === 'live' ? 'live' : live && !ai.mode ? 'live' : 'demo',
      temperature: typeof ai.temperature === 'number' ? ai.temperature : 0.35,
    };
  } catch {
    return base;
  }
}

function buildSystemInstruction(providerLabel: string) {
  return `You are TRYGC's Influencer Discovery Engineer using ${providerLabel}.
Return only verified-looking creator candidates as strict JSON. Be practical for campaign operations.
Prioritize creators with recent posting activity, plausible engagement, market relevance, and clear audience fit.
Do not include prose outside the JSON array.`;
}

function buildPrompt(country: string, niche: string, followerRange: string, count: number, targetCampaign: string) {
  const campaignContextStr = targetCampaign !== 'none' ? `Campaign context: ${targetCampaign}.` : 'Campaign context: general discovery.';
  return `Find ${count} high-performing influencers in ${country} for the ${niche} niche.
Target follower range: ${followerRange}.
${campaignContextStr}

Return a JSON array. Each item must include:
handle, platform, followers, engagement, niche, location, relevanceReason, recentPerformance, audienceAlignment.`;
}

function normalizeResults(value: unknown): SuggestedInfluencer[] {
  const array = Array.isArray(value) ? value : [];
  return array.map((item: any, index) => ({
    handle: String(item.handle || `@creator_${index + 1}`),
    platform: String(item.platform || 'Instagram'),
    followers: String(item.followers || '120K'),
    engagement: String(item.engagement || '4.1%'),
    niche: String(item.niche || 'Lifestyle'),
    location: String(item.location || 'Riyadh, Saudi Arabia'),
    relevanceReason: String(item.relevanceReason || 'Strong brand fit and consistent creator-market alignment.'),
    recentPerformance: String(item.recentPerformance || 'Recent reels show steady view velocity and reliable posting cadence.'),
    audienceAlignment: String(item.audienceAlignment || 'Audience profile aligns with the selected market, niche, and campaign tone.'),
  }));
}

function parseJsonText(text: string): SuggestedInfluencer[] {
  const cleaned = text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  const json = start >= 0 && end >= start ? cleaned.slice(start, end + 1) : cleaned;
  return normalizeResults(JSON.parse(json));
}

function demoResults(country: string, niche: string, count: number): SuggestedInfluencer[] {
  const cities = country.toLowerCase().includes('saudi') ? ['Riyadh', 'Jeddah', 'Khobar', 'Dammam'] : ['Dubai', 'Cairo', 'Kuwait City', 'Doha'];
  const platforms = ['Instagram', 'TikTok', 'YouTube', 'Snapchat'];
  return Array.from({ length: count }, (_, index) => ({
    handle: `@${niche.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'creator'}_${cities[index % cities.length].toLowerCase().replace(/\s+/g, '')}`,
    platform: platforms[index % platforms.length],
    followers: index % 3 === 0 ? '420K' : index % 3 === 1 ? '185K' : '92K',
    engagement: index % 3 === 0 ? '4.8%' : index % 3 === 1 ? '6.1%' : '3.9%',
    niche,
    location: `${cities[index % cities.length]}, ${country}`,
    relevanceReason: `Strong ${niche} fit with polished local content and campaign-safe brand presentation.`,
    recentPerformance: `${index % 2 === 0 ? 'Reels velocity improved across the last 30 days' : 'Consistent story interaction and saves on recent posts'}.`,
    audienceAlignment: `Audience clusters around ${country} urban consumers with interests aligned to ${niche}.`,
  }));
}

async function runGemini(config: AiProviderConfig, prompt: string, systemInstruction: string) {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const response = await ai.models.generateContent({
    model: config.model,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: config.temperature,
      tools: AI_PROVIDER_PRESETS.gemini.supportsSearch ? [{ googleSearch: {} }] : undefined,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            handle: { type: Type.STRING },
            platform: { type: Type.STRING },
            followers: { type: Type.STRING },
            engagement: { type: Type.STRING },
            niche: { type: Type.STRING },
            location: { type: Type.STRING },
            relevanceReason: { type: Type.STRING },
            recentPerformance: { type: Type.STRING },
            audienceAlignment: { type: Type.STRING },
          },
          required: ["handle", "platform", "followers", "engagement", "niche", "location", "relevanceReason", "recentPerformance", "audienceAlignment"],
        },
      },
    },
  });
  return parseJsonText(response.text || '[]');
}

async function postJson(url: string, apiKey: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }
  return response.json();
}

async function runOpenAiCompatible(config: AiProviderConfig, prompt: string, systemInstruction: string) {
  const json = await postJson(config.endpoint, config.apiKey, {
    model: config.model,
    temperature: config.temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: `${systemInstruction}\nReturn {"items":[...]} where items is the influencer array.` },
      { role: 'user', content: prompt },
    ],
  });
  const text = json.choices?.[0]?.message?.content || '{"items":[]}';
  const parsed = JSON.parse(text);
  return normalizeResults(parsed.items || parsed);
}

async function runAnthropic(config: AiProviderConfig, prompt: string, systemInstruction: string) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4000,
      temperature: config.temperature,
      system: systemInstruction,
      messages: [{ role: 'user', content: `${prompt}\nReturn only JSON array.` }],
    }),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  const json = await response.json();
  const text = json.content?.map((part: any) => part.text || '').join('\n') || '[]';
  return parseJsonText(text);
}

async function runCohere(config: AiProviderConfig, prompt: string, systemInstruction: string) {
  const json = await postJson(config.endpoint, config.apiKey, {
    model: config.model,
    temperature: config.temperature,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: `${prompt}\nReturn only JSON array.` },
    ],
  });
  const text = json.message?.content?.map((part: any) => part.text || '').join('\n') || '[]';
  return parseJsonText(text);
}

export async function discoverInfluencers(
  country: string,
  niche: string,
  followerRange: string,
  count: number = 6,
  targetCampaign: string = 'none'
): Promise<SuggestedInfluencer[]> {
  const config = getDiscoveryProviderConfig();
  const providerLabel = AI_PROVIDER_PRESETS[config.provider].label;
  const prompt = buildPrompt(country, niche, followerRange, count, targetCampaign);
  const systemInstruction = buildSystemInstruction(providerLabel);

  if (config.mode === 'demo' || !config.apiKey) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return demoResults(country, niche, count);
  }

  try {
    if (config.provider === 'gemini') return runGemini(config, prompt, systemInstruction);
    if (config.provider === 'anthropic') return runAnthropic(config, prompt, systemInstruction);
    if (config.provider === 'cohere') return runCohere(config, prompt, systemInstruction);
    return runOpenAiCompatible(config, prompt, systemInstruction);
  } catch (error) {
    console.error(`${providerLabel} discovery failed. Falling back to demo results.`, error);
    return demoResults(country, niche, count);
  }
}
