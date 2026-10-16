/**
 * Shared subject classification for notes and quiz topics.
 *
 * Mirrors the backend's keyword buckets (backend/app/routers/quizzes.py) so
 * the UI groups notes by the same subject the quiz API will scope to. A text
 * can only ever resolve to ONE subject: ties return null, so an ambiguous
 * note never claims a subject it may not belong to.
 */

const SUBJECT_KEYWORDS: Record<string, string[]> = {
  Programming: [
    "python", "javascript", "typescript", "css", "html", "react", "vue",
    "angular", "node", "npm", "django", "flask", "sql", "mysql", "sqlite",
    "java", "kotlin", "swift", "programming", "programmer", "coding", "code",
    "coder", "function", "variable", "variables", "array", "arrays", "loop",
    "loops", "recursion", "algorithm", "algorithms", "compiler",
    "interpreter", "syntax", "debug", "debugging", "git", "regex", "json",
    "boolean", "oop", "inheritance", "pointer", "pointers", "database",
    "frontend", "backend", "framework", "api", "console", "callback",
    "callbacks", "async", "await", "lambda", "datatype", "datatypes",
    "integer", "exception", "exceptions", "module", "modules", "browser",
    "developer", "development", "web", "website", "websites", "script",
    "scripts", "def",
  ],
  Mathematics: [
    "math", "mathematics", "algebra", "geometry", "calculus", "trigonometry",
    "equation", "equations", "fraction", "fractions", "percentage",
    "percentages", "theorem", "matrix", "matrices", "determinant",
    "derivative", "derivatives", "integral", "integrals", "probability",
    "statistics", "statistical", "median", "arithmetic", "coordinate",
    "coordinates", "slope", "polynomial", "exponent", "logarithm",
    "quadratic", "permutation", "permutations", "integers", "integrate",
    "factorize", "numeracy",
  ],
  Science: [
    "science", "biology", "chemistry", "physics", "atom", "atoms", "molecule",
    "molecules", "organism", "organisms", "photosynthesis", "chlorophyll",
    "respiration", "gravity", "velocity", "acceleration", "enzyme", "enzymes",
    "genome", "dna", "chromosome", "reaction", "reactions", "acid",
    "alkaline", "ecosystem", "habitat", "climate", "planet", "planets",
    "orbit", "cell", "cells", "tissue", "tissues", "organ", "organs",
    "electron", "proton", "neutron", "compound", "electricity", "circuit",
    "bacteria", "virus", "species", "evolution", "molecular", "atomic",
    "force", "friction", "magnet", "energy", "temperature",
  ],
  English: [
    "english", "grammar", "tense", "tenses", "noun", "nouns", "verb",
    "verbs", "adjective", "adjectives", "adverb", "adverbs", "preposition",
    "prepositions", "pronoun", "pronouns", "vocabulary", "spelling",
    "synonym", "synonyms", "antonym", "antonyms", "essay", "essays",
    "paragraph", "paragraphs", "comprehension", "sentence", "sentences",
    "phrase", "phrases", "clause", "clauses", "punctuation", "literature",
    "novel", "novels", "poem", "poems", "poetry", "poet", "prose",
    "narrative", "metaphor", "simile", "alliteration", "prefix", "suffix",
    "author", "chapter", "chapters", "dialogue", "narrator", "rhyme",
    "rhyming",
  ],
  History: [
    "history", "historical", "ancient", "medieval", "war", "wars",
    "revolution", "revolutions", "empire", "empires", "civilization",
    "civilisation", "dynasty", "treaty", "battle", "battles", "emperor",
    "republic", "colonial", "colonialism", "archaeology", "monarchy",
    "parliament", "pharaoh", "feudal",
  ],
  "Islamic Studies": [
    "islam", "islamic", "quran", "koran", "hadith", "fiqh", "tafseer",
    "salah", "zakat", "surah", "prophet", "imam", "sunnah",
  ],
  Urdu: [
    "urdu", "ghazal", "nazm", "qawaid", "takhallus", "shayari", "adab",
  ],
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "are", "was", "were",
  "note", "notes", "topic", "quiz", "question", "questions", "course",
  "lesson", "lessons", "intro", "introduction", "basic", "basics",
  "beginner", "advanced", "complete", "guide", "test", "exam", "study",
  "learning", "learn", "student", "page", "day", "week", "new", "first",
  "main", "general", "overview", "summary", "progress", "roadmap",
]);

const WORD_RE = /[a-z0-9+#']+/g;
const URDU_SCRIPT_RE = /[\u0600-\u06FF]/;

/** Canonical subject label for `text`, or null when unclear or tied. */
export function inferSubject(text: string): string | null {
  if (!text.trim()) return null;
  if (URDU_SCRIPT_RE.test(text)) return "Urdu";

  const tokens = new Set(text.toLowerCase().match(WORD_RE) ?? []);
  let best: string | null = null;
  let bestScore = 0;
  let tied = false;
  for (const [subject, words] of Object.entries(SUBJECT_KEYWORDS)) {
    const score = words.reduce(
      (total, word) => total + (tokens.has(word) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      best = subject;
      bestScore = score;
      tied = false;
    } else if (score > 0 && score === bestScore) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/**
 * True when `text` belongs to the same subject as `topic`, or - when the
 * topic names no subject - when both share at least one real keyword.
 * Used to keep foreign-subject notes out of a custom-topic quiz context.
 */
export function textMatchesTopic(topic: string, text: string): boolean {
  const subject = inferSubject(topic);
  if (subject) return inferSubject(text) === subject;

  const topicTokens = new Set(topic.toLowerCase().match(WORD_RE) ?? []);
  const textTokens = new Set(text.toLowerCase().match(WORD_RE) ?? []);
  for (const token of topicTokens) {
    if (token.length >= 4 && !STOPWORDS.has(token) && textTokens.has(token)) {
      return true;
    }
  }
  return false;
}
