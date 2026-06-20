/**
 * export-en-dict.js — Exports the built-in English dictionary to JSON
 *
 * Reads src/i18n/locales/en.ts and outputs a JSON file with $meta header
 * suitable for submission to the open-obsidian-i18n/dictionaries repo.
 *
 * Usage: node scripts/export-en-dict.js [output-path]
 *   Default output: ./dist/obsidian-tasks-plugin_en.json
 */

const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────
const PLUGIN_ID = 'obsidian-tasks-plugin';
const EN_TS_PATH = path.join(__dirname, '..', 'src', 'i18n', 'locales', 'en.ts');
const MANIFEST_PATH = path.join(__dirname, '..', 'manifest.json');
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a TypeScript locale file that exports a Record<string, string>.
 * Handles:
 *   const locales: Record<string, string> = { "key": "value", ... };
 *   export default locales;
 */
function parseTsLocale(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Extract the object literal between the first { and the last }
    const startIdx = content.indexOf('{');
    const endIdx = content.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1) {
        throw new Error(`Cannot find object literal in ${filePath}`);
    }

    const objStr = content.slice(startIdx, endIdx + 1);

    // Parse as JSON (the TS file's object literal is valid JSON)
    // But first strip trailing commas before } and before ],
    let cleaned = objStr
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');

    // Also convert single-line const assignments inside the object
    // Handle: {{name}} style interpolation used in i18n-plus
    // (standard JSON allows double-quoted strings, which our TS file already uses)

    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('Failed to parse TS locale file. Trying alternative approach...');
        // Fallback: eval-style extraction
        console.error(e.message);
        process.exit(1);
    }
}

function main() {
    const outputPath = process.argv[2] || path.join(__dirname, '..', 'dist', `${PLUGIN_ID}_en.json`);

    // Read plugin version
    let pluginVersion = '0.0.0';
    try {
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        pluginVersion = manifest.version || pluginVersion;
    } catch (e) {
        console.warn(`Warning: Cannot read manifest.json, using 0.0.0`);
    }

    // Parse en.ts
    const dict = parseTsLocale(EN_TS_PATH);
    const keyCount = Object.keys(dict).length;
    console.log(`Parsed ${keyCount} keys from en.ts`);

    // Build output with $meta
    const output = {
        $meta: {
            pluginId: PLUGIN_ID,
            pluginVersion,
            dictVersion: Date.now().toString(),
            locale: 'en',
            description: `Exported builtin dictionary for English`,
        },
        ...dict,
    };

    // Write output
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
    console.log(`Written: ${outputPath}`);
}

main();
