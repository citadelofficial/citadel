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

    const prompt = `You are a world-class study note editor for a student note-taking app. You are given an image of handwritten or printed class notes. Your job is to extract ALL the content from the image and transform it into beautifully organized, professional-quality study notes.

You are NOT a raw OCR tool. Do NOT just transcribe exactly what you see. Instead, read and understand the content, then REWRITE it as polished, well-structured notes that a student would love to study from.

## How to process the image:

**Reading & Understanding:**
- Extract ALL information from the image — do not skip anything
- Understand the context and subject matter so you can organize intelligently
- If there are diagrams, charts, or drawings, describe them clearly in [brackets]
- If the image contains no readable text, respond with: NO_TEXT_FOUND

**Writing Style:**
- REWRITE everything in a polished, professional academic voice — do NOT just copy the student's messy handwriting verbatim
- Always use proper capitalization, grammar, spelling, and punctuation — even if the original notes are all lowercase, have bad grammar, or use shorthand
- Write in clear, complete sentences — not fragmented shorthand or raw transcription
- Expand abbreviations and shorthand into proper language (e.g. "govt" → "Government", "bc" → "because", "w/" → "with")
- Fix obvious spelling errors and clean up incomplete thoughts into coherent statements
- Think of yourself as a professional textbook editor — same content, but polished to a professional standard
- Do NOT add facts, claims, or information that isn't visible in the image

**Structure & Formatting:**
- Use ## for major section headings and ### for sub-topics
- Use a clear bullet hierarchy:
  - **Top-level bullets (-)** for main ideas or concepts
  - **Indented sub-bullets (  -)** for supporting details, examples, or elaboration
  - **Further indented (    -)** for specific data points, formulas, or edge cases
- Use **bold** for key terms, vocabulary, names, and definitions
- Use *italics* for emphasis, variable names, or foreign terms
- Use numbered lists (1. 2. 3.) only for sequential processes or steps
- For math: use clear inline notation — ^ for exponents (x^2), / for fractions (a/b), sqrt() for square roots
- For science formulas: write them clearly — H₂O, CO₂, NaCl
- Use > blockquotes for important theorems, rules, or definitions worth memorizing
- Separate sections with blank lines for visual breathing room

At the very end of your response, on its own line, output exactly:
TITLE: <a clear, specific title for these notes — e.g. "The French Revolution: Causes & Key Events" not just "History Notes">
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

// ─── Multi-Page OCR ──────────────────────────────────────────────
export async function extractTextFromMultipleImages(
  images: { base64: string; mimeType: string }[]
): Promise<OCRResult> {
  try {
    checkRateLimit();
    const client = getClient();

    const prompt = `You are a world-class study note editor for a student note-taking app. You are given ${images.length} images that together form ONE continuous set of class notes (multiple pages of the same topic/lecture).

Your job is to read ALL ${images.length} pages, understand them as a unified whole, and produce ONE beautifully organized, professional-quality study note document.

## Critical Instructions:
- These are ${images.length} PAGES of the SAME note — treat them as one continuous document, NOT separate notes
- Do NOT add page breaks, "Page 1", "Page 2", etc. — merge everything into one flowing document
- Remove duplicate content that appears across pages (e.g. headers repeated on each page)
- Organize the content logically by topic, even if the pages cover topics in a scattered order
- If one page continues a thought from a previous page, combine them into one complete idea

## How to process:
**Reading & Understanding:**
- Extract ALL information from ALL images — do not skip anything
- Understand the context and subject matter so you can organize intelligently
- If there are diagrams, charts, or drawings, describe them clearly in [brackets]
- If none of the images contain readable text, respond with: NO_TEXT_FOUND

**Writing Style:**
- REWRITE everything in a polished, professional academic voice
- Always use proper capitalization, grammar, spelling, and punctuation
- Write in clear, complete sentences — not fragmented shorthand
- Expand abbreviations into proper language
- Fix spelling errors and clean up incomplete thoughts
- Do NOT add facts that aren't in the images

**Structure & Formatting:**
- Use ## for major section headings and ### for sub-topics
- Use bullet hierarchy: - for main ideas, indented - for details, further indented - for specifics
- Use **bold** for key terms and definitions
- Use *italics* for emphasis
- Use numbered lists for sequential processes
- Use > blockquotes for important theorems or rules worth memorizing
- Separate sections with blank lines

At the very end, on its own line, output exactly:
TITLE: <a clear, specific title for these combined notes>`;

    const parts: any[] = [{ text: prompt }];
    for (let i = 0; i < images.length; i++) {
      parts.push({
        inlineData: {
          mimeType: images[i].mimeType,
          data: images[i].base64,
        },
      });
    }

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts }],
    });

    const text = response.text;

    if (!text || text.trim().length === 0 || text.includes('NO_TEXT_FOUND')) {
      return {
        success: false,
        text: 'Could not extract text from these images. Try taking clearer photos.',
        title: 'Scanned Note',
      };
    }

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

// ─── Quiz Hint Generation ────────────────────────────────────────
export async function generateQuizHint(
  question: string,
  options: string[],
): Promise<string> {
  try {
    checkRateLimit();
    const client = getClient();
    const prompt = `You are a helpful teacher. A student is stuck on this multiple-choice question and needs a SHORT hint (1-2 sentences max). The hint should nudge them toward the right answer WITHOUT giving it away. Be subtle and encouraging.

Question: ${question}
Options: ${options.map((o, i) => `${['A','B','C','D'][i]}) ${o}`).join(', ')}

Respond with ONLY the hint text, nothing else.`;

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response?.text?.trim() || 'Think carefully about what the question is really asking.';
  } catch {
    return 'Think carefully about what the question is really asking.';
  }
}

// ─── Answer Explanation Generation ──────────────────────────────
export async function generateAnswerExplanation(
  question: string,
  options: string[],
  correctIndex: number,
  selectedIndex: number | null,
): Promise<string> {
  try {
    checkRateLimit();
    const client = getClient();
    const prompt = `You are a helpful teacher reviewing a multiple-choice question with a student.

Question: ${question}
Options:
${options.map((o, i) => `${['A', 'B', 'C', 'D'][i]}) ${o}`).join('\n')}

Correct answer: ${['A', 'B', 'C', 'D'][correctIndex]}) ${options[correctIndex]}
Student answer: ${selectedIndex === null ? 'No answer selected' : `${['A', 'B', 'C', 'D'][selectedIndex]}) ${options[selectedIndex]}`}

Explain in 2-4 concise sentences why the correct answer is right. If the student picked a wrong answer, also explain the specific misconception behind that choice. Use plain student-friendly language and do not mention that you are an AI.`;

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response?.text?.trim() || 'The correct answer best matches what the question is asking. Review the key idea and compare each option carefully.';
  } catch (err) {
    return formatError(err);
  }
}

// ─── Quiz Generation ─────────────────────────────────────────────
export interface QuizGenerationResult {
  success: boolean;
  questions: { question: string; options: [string, string, string, string]; correctIndex: number; hint?: string }[];
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
- Each question MUST include a short "hint" — a brief nudge (1-2 sentences max) that helps the student think toward the right answer WITHOUT giving it away. Think of it like a teacher's subtle clue.

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact format:
{
  "title": "Brief quiz title based on the topic",
  "questions": [
    {
      "question": "What is...?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "hint": "Think about the concept of..."
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
      .map((q: any) => ({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        hint: q.hint || undefined,
      }))
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

// ─── AP Practice Test Generation ────────────────────────────────
export async function generateAPPracticeTest(
  courseTitle: string,
  topicOutline: { unitTitle: string; sections: string[] }[],
  questionCount: number = 18,
  difficulty: 'mixed' | 'easy' | 'medium' | 'hard' = 'mixed',
): Promise<QuizGenerationResult> {
  try {
    checkRateLimit();

    const client = getClient();

    const outlineText = topicOutline.length > 0
      ? topicOutline
        .map((unit, i) => {
          const sections = unit.sections.length > 0
            ? unit.sections.map((section) => `  - ${section}`).join('\n')
            : '  - Broad review of this unit';
          return `Unit ${i + 1}: ${unit.unitTitle}\n${sections}`;
        })
        .join('\n\n')
      : 'Use the standard College Board AP course framework for this subject.';

    const difficultyInstruction =
      difficulty === 'easy'
        ? 'Use mostly foundational AP questions: definitions, core concepts, straightforward applications, and approachable distractors.'
        : difficulty === 'medium'
          ? 'Use standard AP exam difficulty: a balanced mix of recall, application, interpretation, and multi-step reasoning.'
          : difficulty === 'hard'
            ? 'Use challenging AP exam difficulty: multi-step reasoning, subtle distractors, cross-topic synthesis, data/stimulus interpretation, and higher-order application.'
            : 'Use mixed AP exam difficulty: include foundational, standard, and challenging questions in the same set.';

    const prompt = `You are an expert AP exam prep teacher. Generate exactly ${questionCount} AP-style multiple-choice practice questions for ${courseTitle}.

This is NOT a normal class-note quiz. It must be a comprehensive AP practice set built from the official-style course topics and broad exam expectations. Do NOT rely on student notes, uploaded files, or user-provided note content.

Selected topic outline:
${outlineText}

Difficulty target: ${difficulty}
${difficultyInstruction}

Rules:
- Cover the selected topic outline as evenly as possible, not just one unit unless only one unit is selected
- Make questions more comprehensive than a normal quiz: include cross-unit reasoning, application, interpretation, and exam-style distractors
- Use AP-style wording appropriate to the subject
- For history, social science, literature, art history, and geography, include stimulus-style questions when useful
- For science, math, and economics, include data, equations, graphs described in text, calculations, experimental reasoning, or model interpretation when useful
- For world language courses, test interpretive communication, vocabulary in context, grammar, cultural comparison, and reading comprehension in the target language when appropriate
- Each question must have exactly 4 answer options
- Only ONE option should be correct
- Make wrong options plausible but clearly distinguishable from the correct answer
- For math and science notation, use plain text notation (^ for exponents, / for fractions, sqrt() for roots)
- Each question MUST include a short hint that nudges the student without giving away the answer

You MUST respond with valid JSON only, no markdown, no code fences. Use this exact format:
{
  "title": "AP Practice: <course name>",
  "questions": [
    {
      "question": "AP-style question text...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "hint": "A short nudge that does not reveal the answer."
    }
  ]
}

The correctIndex is 0-based (0=A, 1=B, 2=C, 3=D).`;

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    const rawText = response?.text?.trim() || '';

    if (!rawText) {
      return { success: false, questions: [], title: 'AP Practice', error: 'AI returned empty response' };
    }

    const cleanJson = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return { success: false, questions: [], title: 'AP Practice', error: 'No questions in AI response' };
    }

    const validQuestions = parsed.questions
      .filter((q: any) =>
        q.question &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correctIndex === 'number' &&
        q.correctIndex >= 0 &&
        q.correctIndex <= 3
      )
      .map((q: any) => ({
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        hint: q.hint || undefined,
      }))
      .slice(0, questionCount);

    if (validQuestions.length === 0) {
      return { success: false, questions: [], title: 'AP Practice', error: 'No valid questions generated' };
    }

    return {
      success: true,
      questions: validQuestions,
      title: parsed.title || `AP Practice: ${courseTitle}`,
    };
  } catch (err) {
    return { success: false, questions: [], title: 'AP Practice', error: formatError(err) };
  }
}

// ─── Quiz Advice Generation ─────────────────────────────────────
export async function generateQuizAdvice(
  questions: { question: string; options: string[]; correctIndex: number }[],
  userAnswers: (number | null)[],
): Promise<string> {
  try {
    checkRateLimit();
    const client = getClient();

    const missed = questions
      .map((q, i) => ({ ...q, userAnswer: userAnswers[i], index: i }))
      .filter((q) => q.userAnswer !== q.correctIndex);

    if (missed.length === 0) {
      return 'You got everything right — keep up the great work!';
    }

    const missedText = missed
      .map((q) => `Q: ${q.question}\nCorrect: ${q.options[q.correctIndex]}${q.userAnswer !== null ? `\nStudent picked: ${q.options[q.userAnswer]}` : '\nStudent skipped'}`)
      .join('\n\n');

    const prompt = `A student just took a quiz. Here are the questions they got wrong:\n\n${missedText}\n\nIn 1-2 short sentences, give them friendly, specific study advice about what concepts or topics they should focus on to improve. Be concise and encouraging. Do not list the questions back.`;

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response?.text?.trim() || 'Review the concepts you missed and try again!';
  } catch {
    return 'Review the concepts you missed and try again!';
  }
}
