import type { PromptMessage } from "../../lib/ai.js";

export interface CoverLetterOutlineInput {
  jobDescription: string;
  company: string;
  role: string;
  resumeText?: string;
  applicantName?: string;
}

export interface CoverLetterOutlineOutput {
  outline: Array<{
    section: string;
    guidance: string;
    exampleContent: string;
  }>;
  keyThemes: string[];
  toneRecommendation: string;
}

export function buildCoverLetterOutlinePrompt(
  input: CoverLetterOutlineInput
): PromptMessage[] {
  const systemPrompt = `You are an expert career coach specializing in persuasive cover letter writing.
Create a detailed, personalized cover letter outline based on the job description and candidate information.
Respond ONLY with a valid JSON object matching this exact schema:
{
  "outline": [
    {
      "section": "string (e.g. Opening Paragraph, Body Paragraph 1)",
      "guidance": "string with writing guidance for this section",
      "exampleContent": "string with example sentences or talking points"
    }
  ],
  "keyThemes": ["array of 3-5 key themes to emphasize"],
  "toneRecommendation": "string describing the recommended tone and style"
}`;

  const userLines: string[] = [
    `Company: ${input.company}`,
    `Role: ${input.role}`,
    `Job Description:\n${input.jobDescription}`,
  ];

  if (input.resumeText) {
    userLines.push(`\nApplicant Resume:\n${input.resumeText}`);
  }
  if (input.applicantName) {
    userLines.push(`\nApplicant Name: ${input.applicantName}`);
  }

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userLines.join("\n") },
  ];
}
