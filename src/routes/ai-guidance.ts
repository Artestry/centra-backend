import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { runPrompt, isOpenAIConfigured } from "../lib/ai.js";
import { AppError } from "../lib/errors.js";
import { proMiddleware } from "../middleware/pro.js";
import {
  buildResumeSuggestionsPrompt,
  type ResumeSuggestionsOutput,
} from "../prompts/resume-suggestions/v1.js";
import {
  buildCoverLetterOutlinePrompt,
  type CoverLetterOutlineOutput,
} from "../prompts/cover-letter-outline/v1.js";
import {
  buildInterviewPrepPrompt,
  type InterviewPrepOutput,
} from "../prompts/interview-prep/v1.js";

const aiGuidance = new Hono();

// All AI endpoints are Pro-gated
aiGuidance.use("*", proMiddleware);

function requireOpenAI(): void {
  if (!isOpenAIConfigured()) {
    throw new AppError(
      503,
      "AI features are not available because OPENAI_API_KEY is not configured. Please add it to your environment.",
      "OPENAI_NOT_CONFIGURED"
    );
  }
}

function parseJsonResponse<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AppError(502, "AI returned an invalid response. Please try again.", "AI_PARSE_ERROR");
  }
}

// POST /api/ai-guidance/resume-suggestions
const resumeSuggestionsSchema = z.object({
  resumeText: z.string().min(50).max(20000),
  jobDescription: z.string().max(10000).optional(),
  targetRole: z.string().max(200).optional(),
});

aiGuidance.post(
  "/resume-suggestions",
  zValidator("json", resumeSuggestionsSchema),
  async (c) => {
    requireOpenAI();
    const body = c.req.valid("json");
    const messages = buildResumeSuggestionsPrompt(body);
    const raw = await runPrompt(messages, { responseFormat: { type: "json_object" } });
    const result = parseJsonResponse<ResumeSuggestionsOutput>(raw);
    return c.json({ data: result });
  }
);

// POST /api/ai-guidance/cover-letter-suggestions
const coverLetterSchema = z.object({
  jobDescription: z.string().min(20).max(10000),
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  resumeText: z.string().max(20000).optional(),
  applicantName: z.string().max(100).optional(),
});

aiGuidance.post(
  "/cover-letter-suggestions",
  zValidator("json", coverLetterSchema),
  async (c) => {
    requireOpenAI();
    const body = c.req.valid("json");
    const messages = buildCoverLetterOutlinePrompt(body);
    const raw = await runPrompt(messages, { responseFormat: { type: "json_object" } });
    const result = parseJsonResponse<CoverLetterOutlineOutput>(raw);
    return c.json({ data: result });
  }
);

// POST /api/ai-guidance/interview-prep
const interviewPrepSchema = z.object({
  jobDescription: z.string().min(20).max(10000),
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  resumeText: z.string().max(20000).optional(),
  interviewType: z.enum(["behavioral", "technical", "general"]).optional(),
});

aiGuidance.post(
  "/interview-prep",
  zValidator("json", interviewPrepSchema),
  async (c) => {
    requireOpenAI();
    const body = c.req.valid("json");
    const messages = buildInterviewPrepPrompt(body);
    const raw = await runPrompt(messages, { responseFormat: { type: "json_object" } });
    const result = parseJsonResponse<InterviewPrepOutput>(raw);
    return c.json({ data: result });
  }
);

export default aiGuidance;
