import { GoogleGenAI } from '@google/genai';

// ─── Configuration ───────────────────────────────────────────────
const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const MODEL_NAME = 'gemini-2.5-flash-lite';

// ─── Singleton client ────────────────────────────────────────────
let genAI: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genAI) {
    if (!API_KEY) {
      throw new Error('Gemini API key is missing. Set EXPO_PUBLIC_GEMINI_API_KEY in your .env file.');
    }
    genAI = new GoogleGenAI({ apiKey: API_KEY });
  }
  return genAI;
}

// ─── Rate Limiter ────────────────────────────────────────────────
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const requestTimestamps: number[] = [];

function checkRateLimit(): void {
  const now = Date.now();
  // Remove timestamps outside the window
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_MAX) {
    const waitSeconds = Math.ceil((requestTimestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
    throw new RateLimitError(
      `Too many requests. Please wait ${waitSeconds} second${waitSeconds !== 1 ? 's' : ''} and try again.`
    );
  }
  requestTimestamps.push(now);
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// ─── Error Helpers ───────────────────────────────────────────────
function formatError(err: unknown): string {
  if (err instanceof RateLimitError) {
    return err.message;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('quota') || msg.includes('rate') || msg.includes('429')) {
      return 'API quota exceeded. Please wait a moment and try again.';
    }
    if (msg.includes('api key') || msg.includes('401') || msg.includes('403')) {
      return 'Invalid API key. Please check your Gemini API key in Settings.';
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
      return 'Network error. Please check your connection and try again.';
    }
    if (msg.includes('safety')) {
      return 'Content was blocked by safety filters. Try merging different notes.';
    }
    return `AI error: ${err.message}`;
  }
  return 'An unexpected error occurred. Please try again.';
}

// ─── Types ───────────────────────────────────────────────────────
export interface NoteInput {
  title: string;
  content: string;
  author?: string;
}

export interface MergeResult {
  success: boolean;
  content: string;   // Merged text on success, error message on failure
  title: string;     // AI-suggested title on success, fallback on failure
}

// ─── Merge Notes ─────────────────────────────────────────────────
export async function mergeNotesWithAI(notes: NoteInput[]): Promise<MergeResult> {
  const fallbackTitle = `Merged (${notes.length} Notes)`;

  try {
    checkRateLimit();

    const client = getClient();

    const notesText = notes
      .map((n, i) => `Note ${i + 1} — "${n.title}"${n.author ? ` by ${n.author}` : ''}:\n${n.content}`)
      .join('\n\n---\n\n');

    const prompt = `You are a study assistant for a student. Merge the following ${notes.length} class notes into a single, well-organized study note.

Rules:
- Combine overlapping concepts and remove redundancy
- Preserve all key facts, definitions, and important details
- Use ## for section headings and ### for sub-headings
- Use - for bullet points
- Use **bold** for key terms and definitions
- Use *italic* for emphasis
- For math formulas, use clear inline notation: ^ for exponents, / for fractions, sqrt() for square roots
- For chemical formulas, write them clearly: H2O, CO2, NaCl
- Keep the tone concise and study-friendly
- Do NOT add information that is not in the original notes
- Start with a brief 1-sentence overview, then organize by topic
- At the end, output a line that says exactly: TITLE: <your suggested title for this merged note>

Here are the notes to merge:

${notesText}`;

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    const text = response.text;

    if (!text || text.trim().length === 0) {
      return { success: false, content: 'AI returned an empty response. Please try again.', title: fallbackTitle };
    }

    // Extract the AI-suggested title from the end of the response
    const titleMatch = text.match(/TITLE:\s*(.+)/i);
    let aiTitle = fallbackTitle;
    let mergedContent = text;

    if (titleMatch) {
      aiTitle = titleMatch[1].trim();
      // Remove the TITLE: line from the content
      mergedContent = text.replace(/TITLE:\s*.+/i, '').trim();
    }

    return { success: true, content: mergedContent, title: aiTitle };
  } catch (err) {
    return { success: false, content: formatError(err), title: fallbackTitle };
  }
}

// ─── Extract Text from Image (OCR) ──────────────────────────────
export interface OCRResult {
  success: boolean;
  text: string;   // Extracted text on success, error message on failure
  title: string;  // AI-suggested title for the scanned content
}

export async function extractTextFromImage(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<OCRResult> {
  try {
    checkRateLimit();

    const client = getClient();

    const prompt = `You are an OCR assistant for a student note-taking app. Extract ALL text from this image of handwritten or printed notes.

Formatting rules:
- Use ## for section headings and ### for sub-headings
- Use - for bullet points (no special characters like •)
- Use **bold** for key terms, definitions, and important concepts
- Use *italic* for emphasis or variable names
- Use numbered lists (1. 2. 3.) when the original has numbered items
- For math formulas, write them inline with clear notation: use ^ for exponents (x^2), / for fractions (a/b), sqrt() for square roots
- For chemical formulas, write them clearly: H2O, CO2, NaCl
- Fix obvious spelling errors but DO NOT add content that isn't in the image
- If there are diagrams or drawings, describe them briefly in [brackets]
- Separate distinct sections with a blank line
- At the end, output a line that says exactly: TITLE: <a short descriptive title for these notes>
- If the image contains no readable text, respond with: NO_TEXT_FOUND`;

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
    });

    const text = response.text;

    if (!text || text.trim().length === 0 || text.includes('NO_TEXT_FOUND')) {
      return {
        success: false,
        text: 'Could not extract text from this image. Try taking a clearer photo.',
        title: 'Scanned Note',
      };
    }

    // Extract the AI-suggested title
    const titleMatch = text.match(/TITLE:\s*(.+)/i);
    let aiTitle = 'Scanned Note';
    let extractedText = text;

    if (titleMatch) {
      aiTitle = titleMatch[1].trim();
      extractedText = text.replace(/TITLE:\s*.+/i, '').trim();
    }

    return { success: true, text: extractedText, title: aiTitle };
  } catch (err) {
    return { success: false, text: formatError(err), title: 'Scanned Note' };
  }
}

// ─── Quiz Generation ─────────────────────────────────────────────
export interface QuizGenerationResult {
  success: boolean;
  questions: { question: string; options: [string, string, string, string]; correctIndex: number }[];
  title: string;
  error?: string;
}

export async function generateQuizFromNotes(
  noteContents: { title: string; content: string }[],
  questionCount: number = 5,
): Promise<QuizGenerationResult> {
  try {
    checkRateLimit();

    const client = getClient();

    const notesText = noteContents
      .map((n, i) => `--- Note ${i + 1}: ${n.title} ---\n${n.content}`)
      .join('\n\n');

    const prompt = `You are an expert quiz creator for students. Generate exactly ${questionCount} multiple-choice questions based on the following class notes.

Rules:
- Each question should test understanding, not just memorization
- Include a mix of difficulty: some recall, some application, some analysis
- Each question must have exactly 4 answer options (A, B, C, D)
- Only ONE option should be correct
- Make wrong options plausible but clearly distinguishable from the correct answer
- For math or science, use clear notation (^ for exponents, / for fractions)
- Questions should cover different parts of the notes, not all from one section

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact format:
{
  "title": "Brief quiz title based on the topic",
  "questions": [
    {
      "question": "What is...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0
    }
  ]
}

The correctIndex is 0-based (0=A, 1=B, 2=C, 3=D).

Here are the notes to create questions from:

${notesText}`;

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    const rawText = response?.text?.trim() || '';

    if (!rawText) {
      return { success: false, questions: [], title: 'Quiz', error: 'AI returned empty response' };
    }

    // Clean potential markdown fences
    const cleanJson = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const parsed = JSON.parse(cleanJson);

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return { success: false, questions: [], title: 'Quiz', error: 'No questions in AI response' };
    }

    // Validate each question
    const validQuestions = parsed.questions
      .filter((q: any) =>
        q.question &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correctIndex === 'number' &&
        q.correctIndex >= 0 &&
        q.correctIndex <= 3
      )
      .slice(0, questionCount);

    if (validQuestions.length === 0) {
      return { success: false, questions: [], title: 'Quiz', error: 'No valid questions generated' };
    }

    return {
      success: true,
      questions: validQuestions,
      title: parsed.title || 'Study Quiz',
    };
  } catch (err) {
    return { success: false, questions: [], title: 'Quiz', error: formatError(err) };
  }
}
