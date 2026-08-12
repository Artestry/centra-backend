import OpenAI from "openai";
import { env } from "./env.js";

let _openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!_openai) {
    _openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface PromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface RunPromptOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" } | { type: "text" };
}

export async function runPrompt(
  messages: PromptMessage[],
  options: RunPromptOptions = {}
): Promise<string> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: options.model ?? "gpt-4o-mini",
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
    ...(options.responseFormat
      ? { response_format: options.responseFormat }
      : {}),
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }
  return content;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}
