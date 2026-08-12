import type { PromptMessage } from "../../lib/ai.js";

export interface ResumeSuggestionsInput {
  resumeText: string;
  jobDescription?: string;
  targetRole?: string;
}

export interface ResumeSuggestionsOutput {
  suggestions: Array<{
    section: string;
    issue: string;
    recommendation: string;
    priority: "high" | "medium" | "low";
  }>;
  overallScore: number;
  summary: string;
}

export function buildResumeSuggestionsPrompt(
  input: ResumeSuggestionsInput
): PromptMessage[] {
  const systemPrompt = `You are an expert career coach and resume reviewer with 15+ years of experience.
Analyze the provided resume and return actionable, specific improvement suggestions.
Respond ONLY with a valid JSON object matching this exact schema:
{
  "suggestions": [
    {
      "section": "string (e.g. Summary, Experience, Skills)",
      "issue": "string describing the problem",
      "recommendation": "string with specific fix",
      "priority": "high" | "medium" | "low"
    }
  ],
  "overallScore": number between 1-100,
  "summary": "string with 2-3 sentence overview"
}`;

  const userLines: string[] = [`Resume Content:\n${input.resumeText}`];

  if (input.jobDescription) {
    userLines.push(`\nTarget Job Description:\n${input.jobDescription}`);
  }
  if (input.targetRole) {
    userLines.push(`\nTarget Role: ${input.targetRole}`);
  }

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userLines.join("\n") },
  ];
}
