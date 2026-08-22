// Catálogo de proveedores y modelos que el usuario puede elegir en "Ajustes".
// Los IDs de modelo son solo cadenas que se pasan al SDK: el catálogo es una
// ayuda, y en la UI siempre hay un campo libre para escribir cualquier modelo.

import type { AiProviderId } from "./settings";

export interface ModelOption {
  id: string;
  label: string;
}

export interface ProviderPreset {
  label: string;
  baseURL: string;
}

export interface ProviderDef {
  id: AiProviderId;
  label: string;
  models: ModelOption[];
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  defaultModel: string;
  needsBaseURL: boolean;
  baseURLPlaceholder: string;
  presets: ProviderPreset[];
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
      { id: "gpt-4.1-nano", label: "GPT-4.1 nano" },
      { id: "o3-mini", label: "o3-mini" },
      { id: "o4-mini", label: "o4-mini" },
    ],
    apiKeyLabel: "API key de OpenAI",
    apiKeyPlaceholder: "sk-…",
    defaultModel: "gpt-4o-mini",
    needsBaseURL: false,
    baseURLPlaceholder: "",
    presets: [],
  },
  {
    id: "google",
    label: "Google Gemini",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
    apiKeyLabel: "API key de Google AI",
    apiKeyPlaceholder: "AIza…",
    defaultModel: "gemini-2.5-flash",
    needsBaseURL: false,
    baseURLPlaceholder: "",
    presets: [],
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    models: [
      { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-opus-5", label: "Claude Opus 5" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      { id: "claude-sonnet-4", label: "Claude Sonnet 4" },
    ],
    apiKeyLabel: "API key de Anthropic",
    apiKeyPlaceholder: "sk-ant-…",
    defaultModel: "claude-sonnet-5",
    needsBaseURL: false,
    baseURLPlaceholder: "",
    presets: [],
  },
  {
    id: "omniroute",
    label: "Omniroute (Proxy / Router)",
    models: [
      { id: "auto", label: "Auto (Omniroute routing)" },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-opus-5", label: "Claude Opus 5" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
    apiKeyLabel: "API Key / Token de Omniroute",
    apiKeyPlaceholder: "omniroute-local o sk-…",
    defaultModel: "auto",
    needsBaseURL: true,
    baseURLPlaceholder: "http://localhost:20128/v1",
    presets: [
      { label: "Omniroute Local (puerto 20128)", baseURL: "http://localhost:20128/v1" },
    ],
  },
  {
    id: "custom",
    label: "Compatible con OpenAI (OpenRouter, Groq, …)",
    models: [],
    apiKeyLabel: "API key del proveedor",
    apiKeyPlaceholder: "clave…",
    defaultModel: "",
    needsBaseURL: true,
    baseURLPlaceholder: "https://…/v1",
    presets: [
      { label: "Omniroute (local)", baseURL: "http://localhost:20128/v1" },
      { label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1" },
      { label: "Groq", baseURL: "https://api.groq.com/openai/v1" },
      { label: "DeepSeek", baseURL: "https://api.deepseek.com/v1" },
      { label: "Mistral", baseURL: "https://api.mistral.ai/v1" },
      { label: "xAI", baseURL: "https://api.x.ai/v1" },
      { label: "Ollama (local)", baseURL: "http://localhost:11434/v1" },
    ],
  },
];

export function getProvider(id: AiProviderId): ProviderDef {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}
