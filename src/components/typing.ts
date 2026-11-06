import { generate } from 'random-words';

export type Mode = 'time' | 'count' | 'custom';

export interface Settings {
	mode: Mode;
	time: number;
	count: number;
	punctuation: boolean;
	numbers: boolean;
	customText: string;
}

export const timeOptions = [15, 30, 60, 120];
export const countOptions = [10, 25, 50, 100];

export const defaultSettings: Settings = {
	mode: 'time',
	time: 30,
	count: 25,
	punctuation: false,
	numbers: false,
	customText: 'The quick brown fox jumps over the lazy dog. Sphinx of black quartz, judge my vow.'
};

/** Words generated at a time. Time mode tops the list up as the user gets close to the end. */
export const batchSize = 50;

/** How many letters past the end of a word the user can type before input is ignored. */
export const maxExtraLetters = 10;

/**
 * Short description of a test configuration, e.g. "time 30 punctuation".
 * Also used as the key for personal bests.
 */
export function testLabel(settings: Settings): string {
	if (settings.mode === 'custom') return 'custom';

	const parts = settings.mode === 'time' ? ['time', settings.time] : ['words', settings.count];
	if (settings.punctuation) parts.push('punctuation');
	if (settings.numbers) parts.push('numbers');
	return parts.join(' ');
}

/**
 * Generates a list of random words.
 * @param count - Number of words to generate.
 * @param options - Mix in punctuation and/or numbers.
 * @param previous - Word before the first generated one, so punctuation continues sentences.
 */
export function generateWords(
	count: number,
	options: Pick<Settings, 'punctuation' | 'numbers'>,
	previous = ''
): string[] {
	const words: string[] = [];
	let last = previous;

	while (words.length < count) {
		let word = options.numbers && Math.random() < 0.1 ? randomNumber() : (generate() as string);
		if (word === last) continue; // avoid the same word twice in a row

		if (options.punctuation) word = punctuate(word, last === '' || /[.?!]["')]?$/.test(last));
		words.push(word);
		last = word;
	}

	return words;
}

/** Splits custom text into words, treating any run of whitespace as a single space. */
export function wordsFromText(text: string): string[] {
	return text.split(/\s+/).filter(Boolean);
}

function randomNumber(): string {
	const digits = 1 + Math.floor(Math.random() * 4);
	return String(Math.floor(Math.random() * 10 ** digits));
}

function punctuate(word: string, sentenceStart: boolean): string {
	if (sentenceStart) word = word[0].toUpperCase() + word.slice(1);

	const roll = Math.random();
	if (roll < 0.08) return word + ',';
	if (roll < 0.14) return word + '.';
	if (roll < 0.16) return word + '?';
	if (roll < 0.18) return word + '!';
	if (roll < 0.19) return word + ';';
	if (roll < 0.2) return word + ':';
	if (roll < 0.22) return `"${word}"`;
	if (roll < 0.23) return `(${word})`;
	if (roll < 0.24) return `'${word}'`;
	return word;
}

export interface CharCounts {
	correct: number;
	incorrect: number;
	extra: number;
	missed: number;
	/** Characters in correctly typed words, including the space after each one. */
	wordChars: number;
	/** Every character currently typed, including spaces. */
	typedChars: number;
}

/**
 * Counts characters typed so far.
 * @param words - Target words.
 * @param typed - What was typed for each word.
 * @param committed - Number of words finished with a space; later words are still in progress.
 */
export function countChars(words: string[], typed: string[], committed: number): CharCounts {
	const counts = { correct: 0, incorrect: 0, extra: 0, missed: 0, wordChars: 0, typedChars: 0 };

	typed.forEach((input, i) => {
		const target = words[i] ?? '';
		const done = i < committed;

		for (let j = 0; j < Math.max(input.length, target.length); j++) {
			if (j >= target.length) counts.extra++;
			else if (j >= input.length) counts.missed += done ? 1 : 0;
			else if (input[j] === target[j]) counts.correct++;
			else counts.incorrect++;
		}

		const space = done ? 1 : 0;
		counts.typedChars += input.length + space;
		if (done ? input === target : target.startsWith(input))
			counts.wordChars += input.length + space;
	});

	return counts;
}

/** Words per minute, where a word is 5 characters. */
export function wpm(chars: number, seconds: number): number {
	return seconds > 0 ? chars / 5 / (seconds / 60) : 0;
}

/**
 * How steady the typing speed was, from 0 to 100, based on the variation in per-second raw speed.
 * Uses the same curve as Monkeytype so scores are comparable.
 */
export function consistency(values: number[]): number {
	const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
	if (!mean) return 0;

	const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
	const cov = Math.sqrt(variance) / mean;
	return 100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5));
}

export interface Sample {
	/** End of this sample, in seconds since the test started. */
	second: number;
	/** Net speed from the start of the test up to this point. */
	wpm: number;
	/** Raw speed during this second alone. */
	raw: number;
	/** Wrong keystrokes during this second. */
	errors: number;
}

export interface Result extends Omit<CharCounts, 'wordChars' | 'typedChars'> {
	wpm: number;
	raw: number;
	accuracy: number;
	consistency: number;
	/** Test duration in seconds. */
	time: number;
	history: Sample[];
}

export interface Best {
	wpm: number;
	accuracy: number;
	date: number;
}

const settingsKey = 'echo-type:settings';
const bestsKey = 'echo-type:bests';

export function loadSettings(): Settings {
	try {
		const saved = JSON.parse(localStorage.getItem(settingsKey) ?? '{}');
		const settings = { ...defaultSettings, ...saved };
		if (!['time', 'count', 'custom'].includes(settings.mode)) settings.mode = defaultSettings.mode;
		return settings;
	} catch {
		return { ...defaultSettings };
	}
}

export function saveSettings(settings: Settings): void {
	try {
		localStorage.setItem(settingsKey, JSON.stringify(settings));
	} catch {
		// Storage can be unavailable (private windows, blocked site data); settings just won't persist.
	}
}

/**
 * Records a result as a personal best if it beats the stored one.
 * @returns The best before this result, and whether this result replaced it.
 */
export function updateBest(label: string, result: Result): { previous?: Best; isNew: boolean } {
	let bests: Record<string, Best> = {};
	try {
		bests = JSON.parse(localStorage.getItem(bestsKey) ?? '{}');
	} catch {
		// Fall through with no stored bests.
	}

	const previous = bests[label];
	const isNew = !previous || result.wpm > previous.wpm;
	if (isNew) {
		bests[label] = { wpm: result.wpm, accuracy: result.accuracy, date: Date.now() };
		try {
			localStorage.setItem(bestsKey, JSON.stringify(bests));
		} catch {
			// Same as saveSettings: the best just won't persist.
		}
	}

	return { previous, isNew };
}
