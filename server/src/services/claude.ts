import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-6';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  score: number;
  jobTitle: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missingKeywords: string[];
}

export interface ResumeChange {
  section: string;
  original: string;
  improved: string;
}

export interface GenerationResult {
  improvedResumeText: string;
  changes: ResumeChange[];
}

interface AnalysisContext {
  strengths: string[];
  weaknesses: string[];
  missingKeywords: string[];
}

// ─── ATS Analysis ─────────────────────────────────────────────────────────────

export async function analyzeResumeWithClaude(
  resumeText: string,
  jobDescription: string,
  jobTitle?: string
): Promise<AnalysisResult> {
  const systemPrompt = `You are an expert ATS (Applicant Tracking System) resume analyzer with 15+ years of experience in recruiting and talent acquisition across all industries. Your role is to objectively evaluate how well a candidate's resume matches a job description, identify gaps, and provide actionable feedback.

When analyzing, consider:
- Keyword matching (hard skills, soft skills, technologies, certifications)
- Experience relevance and depth
- Accomplishment framing and quantification
- ATS parsing compatibility
- Industry-specific terminology alignment

Always return valid JSON only — no markdown, no prose outside the JSON object.`;

  const userPrompt = `Analyze this resume against the job description and return a JSON object with the following structure. Return ONLY the JSON object, nothing else.

RESUME:
${resumeText}

---

JOB DESCRIPTION${jobTitle ? ` (${jobTitle})` : ''}:
${jobDescription}

---

Return this exact JSON structure:
{
  "score": <integer 0-100 representing overall ATS match percentage>,
  "jobTitle": "<inferred job title from the job description>",
  "summary": "<2-3 paragraph narrative summary of the match quality, covering overall fit, key strengths, and primary gaps. Be specific and actionable.>",
  "strengths": [
    "<specific strength bullet 1>",
    "<specific strength bullet 2>",
    "..."
  ],
  "weaknesses": [
    "<specific weakness or gap bullet 1>",
    "<specific weakness or gap bullet 2>",
    "..."
  ],
  "missingKeywords": [
    "<keyword or phrase from the job description missing from the resume>",
    "..."
  ]
}

Provide at least 3 strengths, 3 weaknesses, and 5 missing keywords (if applicable). Be specific — reference actual content from the resume and job description.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const rawJson = extractJson(content.text);

  let parsed: AnalysisResult;
  try {
    parsed = JSON.parse(rawJson) as AnalysisResult;
  } catch {
    throw new Error('Claude returned invalid JSON for analysis');
  }

  // Validate and sanitize
  return {
    score: Math.min(100, Math.max(0, Math.round(parsed.score ?? 0))),
    jobTitle: parsed.jobTitle || jobTitle || 'Unknown Position',
    summary: parsed.summary || 'Analysis complete.',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
  };
}

// ─── Resume Generation ────────────────────────────────────────────────────────

export async function generateImprovedResume(
  resumeText: string,
  jobDescription: string,
  jobTitle: string,
  context: AnalysisContext
): Promise<GenerationResult> {
  const systemPrompt = `You are an expert resume writer and career coach with extensive knowledge of ATS optimization. Your task is to rewrite a candidate's resume to better match a specific job description while keeping all information truthful and accurate.

Key principles:
- Never fabricate experience, skills, or accomplishments
- Reframe existing experience using language from the job description
- Add missing keywords naturally where they genuinely apply
- Strengthen weak bullet points with better action verbs and quantification
- Maintain professional tone and standard resume formatting
- Preserve the chronological structure

Return ONLY valid JSON — no markdown, no text outside the JSON object.`;

  const userPrompt = `Rewrite this resume to better match the job description. Use the analysis context provided to focus your improvements.

ORIGINAL RESUME:
${resumeText}

---

JOB DESCRIPTION (${jobTitle || 'Position'}):
${jobDescription}

---

ANALYSIS CONTEXT:
Weaknesses to address: ${context.weaknesses.join('; ')}
Missing keywords to incorporate (where truthful): ${context.missingKeywords.join(', ')}

---

Return this exact JSON structure:
{
  "improvedResumeText": "<the complete rewritten resume as plain text, preserving structure with line breaks>",
  "changes": [
    {
      "section": "<section name, e.g. 'Summary', 'Experience - Company Name', 'Skills'>",
      "original": "<the original text of this section or bullet>",
      "improved": "<the improved text of this section or bullet>"
    }
  ]
}

The "changes" array should contain every meaningful modification made. Each change entry should contain the specific text that was changed (not the entire section unless the whole section changed). Aim for 5-15 specific, meaningful changes.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const rawJson = extractJson(content.text);

  let parsed: GenerationResult;
  try {
    parsed = JSON.parse(rawJson) as GenerationResult;
  } catch {
    throw new Error('Claude returned invalid JSON for resume generation');
  }

  return {
    improvedResumeText: parsed.improvedResumeText || resumeText,
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a JSON object from Claude's response, handling cases where
 * Claude may wrap the JSON in markdown code fences.
 */
function extractJson(text: string): string {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Find the first { and last } to extract raw JSON
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  // Return as-is and let JSON.parse handle the error
  return text.trim();
}
