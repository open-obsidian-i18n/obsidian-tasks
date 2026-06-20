/**
 * i18n-plus Adapter — Zero-dependency internationalization for Obsidian plugins.
 *
 * Priority: External dictionary > Built-in language > Last successful locale > Base locale > Raw key
 *
 * Replaces i18next with a lightweight dependency-free adapter.
 * Also integrates with the i18n-plus plugin for dictionary management.
 */

import type { Plugin } from 'obsidian';
import { getLanguage } from 'obsidian';

// alphabetical order:
import be from './locales/be';
import de from './locales/de';
import en from './locales/en';
import ko from './locales/ko';
import pt_br from './locales/pt_br';
import ru from './locales/ru';
import tr from './locales/tr';
import uk from './locales/uk';
import vi from './locales/vi';
import zh_cn from './locales/zh_cn';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

// key:   Obsidian "Language code" (see obsidian-translations repo)
// value: the TS locale module
const BUILTIN_LOCALES: Record<string, Record<string, string>> = {
    be,       // Belarusian
    de,       // German
    en,       // English
    ko,       // Korean
    'pt-BR': pt_br,  // Portuguese (Brazil)
    ru,       // Russian
    tr,       // Turkish
    uk,       // Ukrainian
    vi,       // Vietnamese
    zh: zh_cn,       // Chinese (Simplified)
};

const BASE_LOCALE = 'en';

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let currentLocale = 'en';
let lastSuccessfulLocale = 'en';
let isInitialized = false;
const externalDictionaries: Record<string, Record<string, string>> = {};

// ═══════════════════════════════════════════════════════════════════════════
// Core translation function
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Translate a key with optional parameter interpolation.
 *
 * Supports both `{name}` and `{{name}}` interpolation syntax for backward
 * compatibility with i18next-style translations.
 */
function _t(key: string, params?: Record<string, string | number>): string {
    const locale = currentLocale;

    // 1. External dictionary (from i18n-plus plugin)
    let text = externalDictionaries[locale]?.[key];

    // 2. Built-in dictionary (current locale)
    if (!text) {
        text = BUILTIN_LOCALES[locale]?.[key];
        if (text) {
            lastSuccessfulLocale = locale;
        }
    }

    // 3. Last successful locale
    if (!text && lastSuccessfulLocale !== locale) {
        text = BUILTIN_LOCALES[lastSuccessfulLocale]?.[key];
    }

    // 4. Base locale
    if (!text && BASE_LOCALE !== locale && BASE_LOCALE !== lastSuccessfulLocale) {
        text = BUILTIN_LOCALES[BASE_LOCALE]?.[key];
    }

    // 5. Raw key
    if (!text) {
        text = key;
    }

    // Parameter interpolation: support both {name} and {{name}}
    if (params) {
        let res = text;
        for (const k in params) {
            const escaped = String(params[k]);
            res = res.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), escaped);
            res = res.replace(new RegExp(`\\{${k}\\}`, 'g'), escaped);
        }
        return res;
    }

    return text;
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API (backward-compatible with existing i18n.t() usage)
// ═══════════════════════════════════════════════════════════════════════════

export const i18n = {
    t(key: string, params?: Record<string, string | number>): string {
        if (!isInitialized) {
            throw new Error('i18n.t() called before initialization. Call initializeI18n() first.');
        }
        return _t(key, params);
    },
};

/**
 * Initialize i18n and detect Obsidian language.
 * Must be called before using i18n.t().
 */
export const initializeI18n = async (): Promise<void> => {
    if (isInitialized) return;
    const lang = getLanguage() || 'en';
    currentLocale = lang;
    if (BUILTIN_LOCALES[currentLocale]) {
        lastSuccessfulLocale = currentLocale;
    }
    isInitialized = true;
};

/**
 * Set the current locale at runtime.
 */
export function setLocale(locale: string): void {
    currentLocale = locale;
    if (BUILTIN_LOCALES[locale]) {
        lastSuccessfulLocale = locale;
    }
}

/**
 * Get the current locale.
 */
export function getLocale(): string {
    return currentLocale;
}

/**
 * Initialize and register with i18n-plus plugin (if installed).
 * Call this in the plugin's onload() after initializeI18n().
 */
export function initI18n(plugin: Plugin): void {
    const register = () => {
        const i18nPlus = (window as any).i18nPlus;
        if (!i18nPlus) return;

        i18nPlus.register(plugin.manifest.id, {
            pluginId: plugin.manifest.id,
            baseLocale: BASE_LOCALE,
            getLocale: () => currentLocale,
            setLocale: (l: string) => { setLocale(l); },
            t: (k: string, p?: any) => _t(k, p),
            loadDictionary: (locale: string, dict: Record<string, string>) => {
                externalDictionaries[locale] = dict;
                return { valid: true };
            },
            unloadDictionary: (locale: string) => {
                delete externalDictionaries[locale];
            },
            getBuiltinLocales: () => Object.keys(BUILTIN_LOCALES),
            getExternalLocales: () => Object.keys(externalDictionaries),
            getLoadedLocales: () => [...new Set([
                ...Object.keys(BUILTIN_LOCALES),
                ...Object.keys(externalDictionaries)
            ])],
            getDictionary: (locale: string) =>
                externalDictionaries[locale] || BUILTIN_LOCALES[locale],
            validateDictionary: () => ({ valid: true }),
        });

        // Attach i18n adapter to plugin instance so i18n-plus can find it
        (plugin as any).i18n = {
            pluginId: plugin.manifest.id,
            getLocale: () => currentLocale,
            setLocale: (l: string) => { setLocale(l); },
            getBuiltinLocales: () => Object.keys(BUILTIN_LOCALES),
            getExternalLocales: () => Object.keys(externalDictionaries),
        };
    };

    register();
    window.addEventListener('i18n-plus:ready', register);
}
