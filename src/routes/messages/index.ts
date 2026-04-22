import type { Messages } from '$lib/core/types.js';
import { en } from './en.js';
import { pl } from './pl.js';
import { de } from './de.js';
import { uk } from './uk.js';

const ALL: Record<string, Messages> = { en, pl, de, uk };

/** Sync loader — returns messages directly. */
export const loader = (locale: string): Messages => ALL[locale] ?? {};

export const LOCALE_LABELS: Record<string, string> = {
	en: 'English',
	pl: 'Polski',
	de: 'Deutsch',
	uk: 'Українська',
};
