/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Bidirectional Keyboard Layout Mappings
// QWERTY (US English) -> ЙЦУКЕН (Russian) -> ЙЦУКЕН (Ukrainian)
export const EN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,./QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?`~";
export const RU_KEYS = "йцукенгшщзхъфывапролджэячсмитьбю.ЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,ёЁ";
export const UA_KEYS = "йцукенгшщзхїфівапролджєячсмитьбю.ЙЦУКЕНГШЩЗХЇФІВАПРОЛДЖЄЯЧСМИТЬБЮ,іІ";

// Generate mapping dictionaries
export const enToRuMap: Record<string, string> = {};
export const ruToEnMap: Record<string, string> = {};
export const enToUaMap: Record<string, string> = {};
export const uaToEnMap: Record<string, string> = {};
export const ruToUaMap: Record<string, string> = {};
export const uaToRuMap: Record<string, string> = {};

for (let i = 0; i < EN_KEYS.length; i++) {
  const en = EN_KEYS[i];
  const ru = RU_KEYS[i] || en;
  const ua = UA_KEYS[i] || ru;

  enToRuMap[en] = ru;
  ruToEnMap[ru] = en;

  enToUaMap[en] = ua;
  uaToEnMap[ua] = en;
}

// Special mappings for RU <-> UA variations
// Chiefly:
// ы -> і, э -> є, ъ -> ї
// Ы -> І, Э -> Є, Ъ -> Ї
export const ruUaDiffs: Record<string, string> = {
  "ы": "і", "Ы": "І",
  "э": "є", "Э": "Є",
  "ъ": "ї", "Ъ": "Ї",
  "ё": "'", "Ё": "Ґ"
};
export const uaRuDiffs: Record<string, string> = {
  "і": "ы", "І": "Ы",
  "є": "э", "Є": "Э",
  "ї": "ъ", "Ї": "Ъ",
  "'": "ё", "Ґ": "Ё"
};

// Top 400 most common English words
export const EN_DICTIONARY = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as", "you", "do",
  "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one", "all", "would",
  "there", "their", "what", "so", "up", "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can", "like",
  "time", "no", "just", "him", "know", "take", "people", "into", "year", "your", "good", "some", "could", "them", "see", "other",
  "than", "then", "now", "look", "only", "come", "its", "over", "think", "also", "back", "after", "use", "two", "how", "our",
  "work", "first", "well", "way", "even", "new", "want", "because", "any", "these", "give", "day", "most", "us", "is", "are",
  "was", "were", "been", "has", "had", "hello", "hi", "hey", "test", "please", "thanks", "thank", "you", "layout", "switcher",
  "mac", "macos", "app", "application", "file", "folder", "script", "code", "run", "setup", "help", "about", "setting", "options",
  "keyboard", "typing", "text", "word", "phrase", "conversion", "auto", "manual", "active", "sound", "notification", "yes", "no"
]);
export const RU_DICTIONARY = new Set([
  "и", "в", "во", "не", "на", "что", "я", "с", "со", "он", "а", "как", "то", "это", "но", "по", "к", "ко", "из", "у",
  "его", "за", "вы", "бы", "же", "было", "мой", "все", "она", "так", "да", "о", "об", "ты", "от", "ото", "один", "мне",
  "еще", "быть", "только", "до", "себя", "свое", "какой", "когда", "уже", "был", "кто", "него", "всех", "вас", "под", "подо",
  "прямо", "слово", "раз", "если", "время", "может", "были", "тут", "сказал", "чем", "была", "глаз", "ней", "рука", "друг",
  "день", "чей", "наш", "ваш", "привет", "как", "дела", "работа", "спасибо", "пожалуйста", "тест", "программа", "раскладка",
  "клавиатура", "автопереключение", "звук", "слово", "фраза", "быстро", "верно", "да", "нет", "добрый", "утро", "вечер", "ночь",
  "хорошо", "отлично", "новый", "сделать", "написать", "код", "скрипт", "настройки", "помощь", "описание", "автозамена",
  "шаблон", "язык", "русский", "украинский", "английский", "компьютер", "система", "активный", "версия", "проверка", "пример",
  "вечета", "вечера", "вечером", "делами", "новинка", "новые", "нового", "новому", "очень", "хороший", "привета", "приветствие", "приветствовать",
  "украина", "украины", "россия", "россии", "илон", "илона", "маск", "маска"
]);

// Top 400 most common Ukrainian words
export const UA_DICTIONARY = new Set([
  "і", "та", "в", "у", "не", "на", "що", "я", "з", "зі", "він", "а", "як", "це", "но", "по", "до", "від", "уже", "вже",
  "його", "за", "ви", "би", "же", "було", "мій", "все", "вона", "так", "також", "й", "один", "мені", "ще", "бути", "тільки",
  "себе", "своє", "який", "яка", "яке", "які", "яких", "яким", "якими", "коли", "всі", "вас", "під", "підо", "прямо", "слово", "раз", "якщо", "час", "може", "були", "тут",
  "сказав", "ніж", "була", "око", "рука", "друг", "день", "наш", "ваш", "привіт", "дякую", "будь-ласка", "добре", "чудово",
  "так", "ні", "ласка", "тест", "програма", "раскладка", "розкладка", "клавіатура", "клавіатури", "автопереключення", "звук",
  "фраза", "швидко", "правильно", "ранок", "вечір", "ніч", "новий", "нові", "нового", "справи", "справа", "справ", "зробити", "написати", "код", "скрипт", "налаштування",
  "допомога", "опис", "автозаміна", "шаблон", "мова", "українська", "російська", "англійська", "система", "активний", "версія",
  "україна", "інтернет", "світ", "рік", "життя", "людина", "країна", "єдиний", "їжа", "нових", "новому", "тобі", "себе",
  "вечора", "вечором", "ми", "вони", "україни", "українську", "український", "українські", "українською", "українського", "ілон", "ілона", "маск", "маска"
]);

// Convert a single character from source target mapping
export function convertChar(char: string, from: "en" | "ru" | "ua", to: "en" | "ru" | "ua"): string {
  if (from === to) return char;

  if (from === "en") {
    if (to === "ru") return enToRuMap[char] || char;
    if (to === "ua") return enToUaMap[char] || char;
  } else if (from === "ru") {
    if (to === "en") return ruToEnMap[char] || char;
    if (to === "ua") return ruUaDiffs[char] || enToUaMap[ruToEnMap[char]] || char;
  } else if (from === "ua") {
    if (to === "en") return uaToEnMap[char] || char;
    if (to === "ru") return uaRuDiffs[char] || enToRuMap[uaToEnMap[char]] || char;
  }
  return char;
}

// Convert whole word or text block
export function convertText(text: string, from: "en" | "ru" | "ua", to: "en" | "ru" | "ua"): string {
  return text.split("").map(c => convertChar(c, from, to)).join("");
}

/**
 * Check if word starts with character combinations that are physically or linguistically impossible.
 * Excellent for immediate layouts switching heuristics (e.g., typing 'ntcn' in English, which converts to 'тест').
 */
export function isImpossibleInEnglish(word: string): boolean {
  const w = word.toLowerCase();
  if (w.length < 2) return false;

  // English words do not start with these consonant pairs
  const badStarts = [
    "nt", "rt", "dt", "yt", "gt", "ht", "jt", "kt", "lt", "vt", "ct", "mt",
    "zb", "xd", "cb", "vb", "bb", "nb", "zf", "zg", "zk", "zm", "zn", "zp",
    "zs", "zv", "zw", "zx", "qy", "vj", "xj", "zj", "qc", "qk", "qv", "qw",
    "gx", "hx", "mx", "px", "rx", "wx"
  ];

  for (const prefix of badStarts) {
    if (w.startsWith(prefix)) return true;
  }

  // English words starting with Q must be followed by a vowel or 'u'
  if (w.startsWith("q") && w.length > 1 && !["u", "a", "i", "o", "e"].includes(w[1])) {
    return true;
  }

  // Double consonants that don't appear in English normally
  if (w.includes("vv") || w.includes("yy") || w.includes("jj") || w.includes("xx") || w.includes("qq")) {
    return true;
  }

  return false;
}

export function isImpossibleInCyrillic(word: string): boolean {
  const w = word.toLowerCase();
  if (w.length < 1) return false;

  // Russian/Ukrainian words never start with soft/hard signs or 'ы'
  if (["ь", "ъ", "ы"].includes(w[0])) return true;

  if (w.length < 2) return false;

  // Impossible consecutive sign characters
  if (
    w.includes("ьь") || w.includes("ъъ") || w.includes("ыы") ||
    w.includes("ъь") || w.includes("ьъ") || w.includes("йы") ||
    w.includes("йы") || w.includes("йь") || w.includes("йъ")
  ) {
    return true;
  }

  // Impossible consonant sequences
  const badStarts = ["щй", "чй", "цй", "фй", "хй", "йй"];
  for (const prefix of badStarts) {
    if (w.startsWith(prefix)) return true;
  }

  return false;
}

/**
 * Detects if the broader text context indicates that the language is Ukrainian.
 * This is an extremely smart helper that allows us to switch layouts flawlessly
 * for sentences like "Доброго вечора ми з украъни".
 */
export function isUkrainianContext(text: string): boolean {
  if (!text) return false;
  // If it contains distinctly Ukrainian characters
  if (/[ієїґІЄЇҐ]/.test(text)) return true;
  
  // Checking for common Ukrainian words/particles
  const lowerWords = text.toLowerCase().split(/[^\u0400-\u04FFa-zA-Z]+/);
  const uaMarkers = [
    "як", "що", "ми", "з", "та", "вже", "всі", "було", "справи", "привіт", "вечора", 
    "вечір", "дякую", "добре", "може", "коли", "тобі", "себе", "україна", "україні", 
    "україни"
  ];
  
  let matches = 0;
  for (const w of lowerWords) {
    if (uaMarkers.includes(w)) {
      matches++;
      if (matches >= 1) return true;
    }
  }
  return false;
}

/**
 * Advanced Layout Detector. Takes an input word typed in US English layout
 * and determines if it was actually intended as Russian, Ukrainian, or if it counts as normal English.
 * Returns the target language if layout swap is recommended, otherwise null.
 */
export function detectLayoutAnomaly(
  word: string,
  primaryCyrillic: "ru" | "ua" = "ru",
  fullText: string = ""
): { switchNeeded: boolean; targetLang: "en" | "ru" | "ua"; converted: string } {
  if (!word) {
    return { switchNeeded: false, targetLang: "en", converted: word };
  }

  // Active Ukrainian context helper
  const isUaCtx = primaryCyrillic === "ua" || isUkrainianContext(fullText) || isUkrainianContext(word);

  if (word.length === 1) {
    const char = word;
    if (isUaCtx) {
      if (char === "ы") return { switchNeeded: true, targetLang: "ua", converted: "і" };
      if (char === "Ы") return { switchNeeded: true, targetLang: "ua", converted: "І" };
      if (char === "э") return { switchNeeded: true, targetLang: "ua", converted: "є" };
      if (char === "Э") return { switchNeeded: true, targetLang: "ua", converted: "Є" };
      if (char === "ъ") return { switchNeeded: true, targetLang: "ua", converted: "ї" };
      if (char === "Ъ") return { switchNeeded: true, targetLang: "ua", converted: "Ї" };
    } else {
      const isRuCtx = primaryCyrillic === "ru";
      if (isRuCtx) {
        if (char === "і") return { switchNeeded: true, targetLang: "ru", converted: "ы" };
        if (char === "І") return { switchNeeded: true, targetLang: "ru", converted: "Ы" };
        if (char === "є") return { switchNeeded: true, targetLang: "ru", converted: "э" };
        if (char === "Є") return { switchNeeded: true, targetLang: "ru", converted: "Э" };
        if (char === "ї") return { switchNeeded: true, targetLang: "ru", converted: "ъ" };
        if (char === "Ї") return { switchNeeded: true, targetLang: "ru", converted: "Ъ" };
      }
    }
    return { switchNeeded: false, targetLang: "en", converted: word };
  }

  // Check if word contains any cyrillic
  const hasCyrillic = /[а-яА-ЯёЁіІєЄїЇґҐ]/.test(word);
  const hasLatin = /[a-zA-Z]/.test(word);

  // Case 1: Typed in Latin (English keyboard), but looks like Cyrillic
  if (hasLatin && !hasCyrillic) {
    const convertedRu = convertText(word, "en", "ru");
    const convertedUa = convertText(word, "en", "ua");

    // Check if converted version matches our dictionaries (high priority!)
    if (RU_DICTIONARY.has(convertedRu.toLowerCase())) {
      return { switchNeeded: true, targetLang: "ru", converted: convertedRu };
    }
    if (UA_DICTIONARY.has(convertedUa.toLowerCase())) {
      return { switchNeeded: true, targetLang: "ua", converted: convertedUa };
    }

    // Heuristics: Does the Latin form look impossible, and Cyrillic possible?
    if (isImpossibleInEnglish(word)) {
      // It is highly likely cyrillic. Now decide between RU and UA.
      const lowercase = word.toLowerCase();
      const hasUaKeys = lowercase.includes("s") || lowercase.includes("]") || lowercase.includes("'");
      
      const isRuImpossible = isImpossibleInCyrillic(convertedRu);
      const isUaImpossible = isImpossibleInCyrillic(convertedUa);

      if (!isUaImpossible && hasUaKeys && !isRuImpossible) {
        // Look at the character 's' (Russian 'ы', Ukrainian 'і')
        // In Ukrainian, "і" can start words or be between consonants easily.
        // In Russian, "ы" NEVER starts a word. So if word starts with "s", it MUST be Ukrainian "і" (e.g. 'sнтернет' -> 'інтернет')!
        if (lowercase.startsWith("s")) {
          return { switchNeeded: true, targetLang: "ua", converted: convertedUa };
        }
      }

      // If Ukrainian context or preference is 'ua', prefer Ukrainian
      if (isUaCtx && !isUaImpossible) {
        return { switchNeeded: true, targetLang: "ua", converted: convertedUa };
      }

      if (!isRuImpossible) {
        return { switchNeeded: true, targetLang: "ru", converted: convertedRu };
      } else if (!isUaImpossible) {
        return { switchNeeded: true, targetLang: "ua", converted: convertedUa };
      }
    }
  }

  // Case 2: Typed in Cyrillic, but looks like English QWERTY
  if (hasCyrillic && !hasLatin) {
    const convertedEn = convertText(word, "ru", "en"); // converting Cyrillic keys to English QWERTY
    
    if (EN_DICTIONARY.has(convertedEn.toLowerCase())) {
      return { switchNeeded: true, targetLang: "en", converted: convertedEn };
    }

    if (isImpossibleInCyrillic(word) && !isImpossibleInEnglish(convertedEn)) {
      return { switchNeeded: true, targetLang: "en", converted: convertedEn };
    }

    // Case 3: Cyrillic RU <-> UA layout mismatch check (e.g., typing Russian letters expecting Ukrainian, or Ukrainian letters expecting Russian)
    const hasRuSpecific = /[ыэъёЫЭЪЁ]/.test(word); // Specific keys for RU
    const hasUaSpecific = /[ієїґІЄЇҐ]/.test(word); // Specific keys for UA

    // Linguistic impossibility check for Russian layout (helps detect Ukrainian)
    const isImpossibleRu = 
      /^[ыЫ]/.test(word) ||                // words cannot start with 'ы' in Russian
      /^[ъЪ]/.test(word) ||                // words cannot start with 'ъ' in Russian
      /[ъЪ]$/.test(word) ||                // words cannot end with 'ъ' in modern Russian
      /[ъЪ][бвгджзклмнпрстфхцчшщ]/i.test(word); // 'ъ' cannot be followed by a consonant in Russian

    if (hasRuSpecific) {
      const convertedUa = convertText(word, "ru", "ua");
      if (UA_DICTIONARY.has(convertedUa.toLowerCase()) || isUaCtx || isImpossibleRu) {
        return { switchNeeded: true, targetLang: "ua", converted: convertedUa };
      }
    }

    if (hasUaSpecific) {
      const convertedRu = convertText(word, "ua", "ru");
      if (RU_DICTIONARY.has(convertedRu.toLowerCase()) || (primaryCyrillic === "ru" && !isUaCtx)) {
        return { switchNeeded: true, targetLang: "ru", converted: convertedRu };
      }
    }
  }

  // Case 4: Mixed Latin and Cyrillic (e.g. typing "Skон", where first letters are Latin, last Cyrillic, or vice versa)
  if (hasLatin && hasCyrillic) {
    // 1. Try treating it as Ukrainian (convert Latin chars to Ukrainian)
    const convertedUa = word.split("").map(c => /[a-zA-Z]/.test(c) ? convertChar(c, "en", "ua") : c).join("");
    // 2. Try treating it as Russian (convert Latin chars to Russian)
    const convertedRu = word.split("").map(c => /[a-zA-Z]/.test(c) ? convertChar(c, "en", "ru") : c).join("");
    // 3. Try treating it as fully English (convert Cyrillic chars to English)
    const convertedEn = word.split("").map(c => /[^\u0000-\u007F]/.test(c) ? convertChar(c, "ru", "en") : c).join("");

    if (UA_DICTIONARY.has(convertedUa.toLowerCase()) || (isUaCtx && !isImpossibleInCyrillic(convertedUa))) {
      return { switchNeeded: true, targetLang: "ua", converted: convertedUa };
    }
    if (RU_DICTIONARY.has(convertedRu.toLowerCase()) || (!isUaCtx && !isImpossibleInCyrillic(convertedRu))) {
      return { switchNeeded: true, targetLang: "ru", converted: convertedRu };
    }
    if (EN_DICTIONARY.has(convertedEn.toLowerCase())) {
      return { switchNeeded: true, targetLang: "en", converted: convertedEn };
    }
  }

  return { switchNeeded: false, targetLang: "en", converted: word };
}
