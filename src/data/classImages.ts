/**
 * Maps class titles/subjects to relevant Unsplash background images.
 * Each entry has keywords to match against and a curated image URL.
 * Images are sized at 800x600 for good quality at reasonable bandwidth.
 */

type SubjectImage = {
  keywords: string[];
  url: string;
};

const SUBJECT_IMAGES: SubjectImage[] = [
  // ── Sciences ──────────────────────────────────────────
  {
    keywords: ['biology', 'bio', 'anatomy', 'life science', 'zoology', 'botany', 'ecology'],
    url: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&h=600&fit=crop', // microscope / biology lab
  },
  {
    keywords: ['chemistry', 'chem'],
    url: 'https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?w=800&h=600&fit=crop', // chemistry lab beakers
  },
  {
    keywords: ['physics', 'mechanics', 'kinematics', 'electromagnetism'],
    url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&h=600&fit=crop', // physics equations / light
  },
  {
    keywords: ['environmental science', 'apes', 'environmental'],
    url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop', // forest / nature
  },
  {
    keywords: ['earth science', 'geology', 'geoscience'],
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&h=600&fit=crop', // earth / space view
  },
  {
    keywords: ['astronomy', 'astrophysics', 'space'],
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&h=600&fit=crop', // starry night sky
  },

  // ── Math ──────────────────────────────────────────────
  {
    keywords: ['calculus', 'calc'],
    url: 'https://images.unsplash.com/photo-1635372722656-389f87a941b7?w=800&h=600&fit=crop', // math formulas on board
  },
  {
    keywords: ['statistics', 'stats', 'data science'],
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop', // data charts / analytics
  },
  {
    keywords: ['algebra', 'pre-calc', 'precalculus', 'precalc', 'trigonometry', 'trig', 'math', 'geometry', 'discrete'],
    url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&h=600&fit=crop', // math on chalkboard
  },

  // ── Computer Science ──────────────────────────────────
  {
    keywords: ['computer science', 'cs', 'programming', 'coding', 'software', 'csp', 'csa', 'java'],
    url: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop', // code on screen
  },

  // ── English / Language Arts ───────────────────────────
  {
    keywords: ['english language', 'english lang', 'rhetoric', 'composition', 'writing', 'lang and comp'],
    url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&h=600&fit=crop', // writing / pen on paper
  },
  {
    keywords: ['english literature', 'english lit', 'literature', 'lit and comp', 'lit'],
    url: 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=800&h=600&fit=crop', // vintage books
  },
  {
    keywords: ['english', 'ela', 'language arts'],
    url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&h=600&fit=crop', // open book
  },

  // ── History / Social Studies ──────────────────────────
  {
    keywords: ['us history', 'united states history', 'apush', 'american history'],
    url: 'https://images.unsplash.com/photo-1569974507005-6dc61f97fb5c?w=800&h=600&fit=crop', // American history / old documents
  },
  {
    keywords: ['world history', 'whap', 'global history'],
    url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&h=600&fit=crop', // ancient world / Taj Mahal
  },
  {
    keywords: ['european history', 'euro', 'europe'],
    url: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&h=600&fit=crop', // European architecture
  },
  {
    keywords: ['history', 'social studies'],
    url: 'https://images.unsplash.com/photo-1461360370896-922624d12a74?w=800&h=600&fit=crop', // old map / compass
  },

  // ── Government / Economics / Politics ─────────────────
  {
    keywords: ['government', 'politics', 'civics', 'political science'],
    url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=600&fit=crop', // US Capitol building
  },
  {
    keywords: ['economics', 'macroeconomics', 'microeconomics', 'econ', 'macro', 'micro'],
    url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=600&fit=crop', // stock market / economics
  },

  // ── Psychology ────────────────────────────────────────
  {
    keywords: ['psychology', 'psych', 'behavioral'],
    url: 'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&h=600&fit=crop', // brain / neuroscience
  },

  // ── Geography ─────────────────────────────────────────
  {
    keywords: ['geography', 'human geography', 'human geo', 'aphug'],
    url: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=800&h=600&fit=crop', // globe / map
  },

  // ── Languages ─────────────────────────────────────────
  {
    keywords: ['spanish', 'español'],
    url: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=800&h=600&fit=crop', // Spain / Spanish architecture
  },
  {
    keywords: ['french', 'français'],
    url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop', // Paris / Eiffel Tower
  },
  {
    keywords: ['german', 'deutsch'],
    url: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&h=600&fit=crop', // German architecture
  },
  {
    keywords: ['latin', 'classics'],
    url: 'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=800&h=600&fit=crop', // Roman ruins
  },
  {
    keywords: ['chinese', 'mandarin', '中文'],
    url: 'https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&h=600&fit=crop', // Chinese architecture
  },
  {
    keywords: ['japanese', '日本語'],
    url: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800&h=600&fit=crop', // Japanese temple
  },
  {
    keywords: ['language', 'foreign language', 'linguistics'],
    url: 'https://images.unsplash.com/photo-1543109740-4bdb38fda756?w=800&h=600&fit=crop', // language / globe
  },

  // ── Arts ──────────────────────────────────────────────
  {
    keywords: ['art history', 'art'],
    url: 'https://images.unsplash.com/photo-1541367777708-7905fe3296c0?w=800&h=600&fit=crop', // museum / art gallery
  },
  {
    keywords: ['music', 'band', 'orchestra', 'choir', 'chorus'],
    url: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800&h=600&fit=crop', // sheet music / piano
  },
  {
    keywords: ['theater', 'theatre', 'drama', 'acting'],
    url: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800&h=600&fit=crop', // theater stage
  },
  {
    keywords: ['photography', 'film', 'cinema', 'media'],
    url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&h=600&fit=crop', // camera / film
  },

  // ── Health / PE ───────────────────────────────────────
  {
    keywords: ['health', 'pe', 'physical education', 'fitness', 'wellness', 'nutrition'],
    url: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=600&fit=crop', // fitness / health
  },

  // ── Business / Career ─────────────────────────────────
  {
    keywords: ['business', 'accounting', 'finance', 'entrepreneurship', 'marketing'],
    url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&h=600&fit=crop', // business / professional
  },

  // ── Engineering / Tech ────────────────────────────────
  {
    keywords: ['engineering', 'robotics', 'stem'],
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop', // engineering / tech
  },

  // ── Philosophy / Religion ─────────────────────────────
  {
    keywords: ['philosophy', 'ethics', 'logic'],
    url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop', // library / thinking
  },
  {
    keywords: ['religion', 'theology', 'bible', 'divinity'],
    url: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=800&h=600&fit=crop', // stained glass / spiritual
  },
];

/** Fallback images when no subject match is found */
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&h=600&fit=crop', // stacked books
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop', // classroom chalkboard
  'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&h=600&fit=crop', // desk with notebook
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&h=600&fit=crop', // studying at desk
  'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&h=600&fit=crop', // open notebook
];

/**
 * Returns the best matching background image URL for a given class title.
 * Uses keyword matching with priority for longer (more specific) matches.
 */
export function getClassImage(title: string): string {
  const normalized = title.toLowerCase().trim();

  // Score each subject entry; higher score = more keywords matched / longer match
  let bestMatch: SubjectImage | null = null;
  let bestScore = 0;

  for (const subject of SUBJECT_IMAGES) {
    for (const keyword of subject.keywords) {
      if (normalized.includes(keyword)) {
        // Longer keyword = more specific = higher priority
        const score = keyword.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = subject;
        }
      }
    }
  }

  if (bestMatch) {
    return bestMatch.url;
  }

  // Deterministic fallback based on title so the same class always gets the same image
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  return FALLBACK_IMAGES[Math.abs(hash) % FALLBACK_IMAGES.length];
}
