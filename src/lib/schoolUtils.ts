/**
 * School name utilities — capitalization, normalization, and fuzzy matching.
 */

// Common abbreviations → expanded form
const ABBREVIATIONS: Record<string, string> = {
  'hs': 'High School',
  'ms': 'Middle School',
  'es': 'Elementary School',
  'elem': 'Elementary',
  'univ': 'University',
  'acad': 'Academy',
  'prep': 'Preparatory',
  'inst': 'Institute',
  'coll': 'College',
  'tech': 'Technical',
  'voc': 'Vocational',
  'intl': 'International',
  'natl': 'National',
  'jr': 'Junior',
  'sr': 'Senior',
  'st': 'Saint',
};

// Words that should stay lowercase in title case (unless first word)
const LOWERCASE_WORDS = new Set(['of', 'the', 'and', 'at', 'in', 'for', 'to', 'de', 'la', 'del']);

// Words that should stay uppercase
const UPPERCASE_WORDS = new Set(['ii', 'iii', 'iv', 'us', 'usa', 'uk', 'dc', 'ny', 'nj', 'va', 'ca', 'tx', 'fl', 'pa', 'ma', 'md', 'ct']);

/**
 * Title-case a school name with smart rules.
 */
export function capitalizeSchoolName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  return trimmed
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase();

      // Keep uppercase acronyms/state codes uppercase
      if (UPPERCASE_WORDS.has(lower)) return word.toUpperCase();

      // Lowercase articles/preps (unless first word)
      if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;

      // Standard title case
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Normalize a school name by expanding abbreviations and capitalizing.
 * "loudoun valley hs" → "Loudoun Valley High School"
 */
export function normalizeSchoolName(name: string): string {
  let trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  // Expand abbreviations (case-insensitive, whole word only)
  const words = trimmed.split(' ');
  const expanded = words.map(word => {
    const lower = word.toLowerCase().replace(/[.]/g, '');
    return ABBREVIATIONS[lower] || word;
  });

  return capitalizeSchoolName(expanded.join(' '));
}

/**
 * Create a simplified key for comparison (lowercase, no punctuation, expanded abbreviations).
 */
function makeComparisonKey(name: string): string {
  const normalized = normalizeSchoolName(name);
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remove common suffixes for base-name comparison.
 * "Loudoun Valley High School" → "loudoun valley"
 */
function getBaseName(name: string): string {
  const key = makeComparisonKey(name);
  return key
    .replace(/\s*(high school|middle school|elementary school|elementary|academy|preparatory|university|college|institute|school)\s*$/i, '')
    .trim();
}

/**
 * Calculate similarity between two strings (0-1, 1 = identical).
 * Uses a combination of base-name match and Levenshtein-based scoring.
 */
export function similarityScore(a: string, b: string): number {
  const keyA = makeComparisonKey(a);
  const keyB = makeComparisonKey(b);

  // Exact match after normalization
  if (keyA === keyB) return 1.0;

  // Base name match (e.g., "Loudoun Valley" matches "Loudoun Valley High School")
  const baseA = getBaseName(a);
  const baseB = getBaseName(b);
  if (baseA && baseB && (baseA === baseB)) return 0.92;

  // One starts with the other
  if (baseA && baseB && (baseA.startsWith(baseB) || baseB.startsWith(baseA))) return 0.85;

  // Levenshtein-based similarity on the full normalized key
  const distance = levenshtein(keyA, keyB);
  const maxLen = Math.max(keyA.length, keyB.length);
  if (maxLen === 0) return 1.0;

  const levScore = 1 - distance / maxLen;

  // Also check base name Levenshtein
  if (baseA && baseB) {
    const baseDist = levenshtein(baseA, baseB);
    const baseMax = Math.max(baseA.length, baseB.length);
    const baseLevScore = baseMax > 0 ? 1 - baseDist / baseMax : 0;
    // Use whichever is higher
    return Math.max(levScore, baseLevScore);
  }

  return levScore;
}

/**
 * Check if two school names are "similar enough" to be duplicates.
 */
export function areSimilarSchools(a: string, b: string): boolean {
  return similarityScore(a, b) >= 0.75;
}

/**
 * Find the best matching school from a list.
 * Returns { match, score } or null if no reasonable match.
 */
export function findBestMatch(input: string, schools: string[]): { match: string; score: number } | null {
  const normalizedInput = normalizeSchoolName(input);
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const school of schools) {
    const score = similarityScore(normalizedInput, school);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = school;
    }
  }

  // Only return if score is above threshold and it's not an exact match
  if (bestMatch && bestScore >= 0.75 && bestScore < 1.0) {
    return { match: bestMatch, score: bestScore };
  }

  return null;
}

/**
 * Levenshtein distance (edit distance) between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}
