import type { PromptMessage } from "../../lib/ai.js";

export interface InterviewPrepInput {
  jobDescription: string;
  company: string;
  role: string;
  resumeText?: string;
  interviewType?: "behavioral" | "technical" | "general";
}

export interface InterviewPrepOutput {
  questions: Array<{
    question: string;
    category: string;
    difficulty: "easy" | "medium" | "hard";
    guidanceNotes: string;
    exampleAnswer?: string;
  }>;
  researchTopics: string[];
  preparationTips: string[];
}

export function buildInterviewPrepPrompt(
  input: InterviewPrepInput
): PromptMessage[] {
  const interviewType = input.interviewType ?? "general";

  const systemPrompt = `You are an expert interview coach who has helped thousands of candidates land jobs at top companies.
Generate tailored interview questions and preparation guidance for the given role and company.
Interview type: ${interviewType}.
Respond ONLY with a valid JSON object matching this exact schema:
{
  "questions": [
    {
      "question": "string",
      "category": "string (e.g. Behavioral, Technical, Situational)",
      "difficulty": "easy" | "medium" | "hard",
      "guidanceNotes": "string with tips on how to answer",
      "exampleAnswer": "string (optional short example)"
    }
  ],
  "researchTopics": ["array of topics the candidate should research about the company/role"],
  "preparationTips": ["array of actionable preparation tips"]
}`;

  const userLines: string[] = [
    `Company: ${input.company}`,
    `Role: ${input.role}`,
    `Job Description:\n${input.jobDescription}`,
  ];

  if (input.resumeText) {
    userLines.push(`\nCandidate Resume:\n${input.resumeText}`);
  }

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userLines.join("\n") },
  ];
}
