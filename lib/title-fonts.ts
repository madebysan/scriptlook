// Full Google Fonts catalog (~1929 families). The full list is in
// google-fonts-catalog.json. The title tool uses a curated subset so the
// default treatment feels like a usable film direction, not a random font demo.
// Only the 2 currently-selected fonts get loaded via dynamic <link> tags.

import catalog from "./google-fonts-catalog.json";

type CatalogEntry = { family: string; category: string };

export type FontChoice = {
  family: string;
  // What to write in the Google Fonts URL — e.g. "Playfair+Display"
  urlSpec: string;
  // Category from Google Fonts metadata
  category: string;
};

const ALL_FONTS = catalog as CatalogEntry[];

// Display fonts: serifs and strong sans-serifs work for film titles.
// Handwriting and novelty display faces read too gimmicky for Scriptlook's
// current dossier-style UI.
const DISPLAY_CATEGORIES = new Set(["Serif", "Sans Serif"]);
const SECONDARY_CATEGORIES = new Set(["Sans Serif", "Serif", "Monospace"]);

// A small denylist of fonts that are gimmicky or hard to read at any size.
// We're casting a wide net otherwise — most Google Fonts are usable.
const DENYLIST = new Set<string>([
  "Sevillana",
  "Bungee Shade",
  "Bungee Outline",
  "Faster One",
  "Kumar One Outline",
  "Plaster",
  "Poor Story",
  "Rubik Wet Paint",
  "Rubik Beastly",
]);

const DISPLAY_POOL: CatalogEntry[] = ALL_FONTS.filter(
  (f) => DISPLAY_CATEGORIES.has(f.category) && !DENYLIST.has(f.family),
);

const SECONDARY_POOL: CatalogEntry[] = ALL_FONTS.filter(
  (f) => SECONDARY_CATEGORIES.has(f.category) && !DENYLIST.has(f.family),
);

const CURATED_DISPLAY_FAMILIES = [
  "Instrument Serif",
  "Cormorant Garamond",
  "Libre Baskerville",
  "DM Serif Display",
  "Playfair Display",
  "Bodoni Moda",
  "Newsreader",
  "Fraunces",
  "Cinzel",
  "Oswald",
  "Archivo",
  "Unbounded",
];

const CURATED_SECONDARY_FAMILIES = [
  "DM Sans",
  "Inter",
  "IBM Plex Sans",
  "Libre Franklin",
  "Work Sans",
  "Archivo",
  "Newsreader",
  "Libre Baskerville",
  "Space Mono",
];

function namedPool(families: string[], fallback: CatalogEntry[]): CatalogEntry[] {
  const entries = families
    .map((family) => fallback.find((f) => f.family === family))
    .filter((entry): entry is CatalogEntry => Boolean(entry));
  return entries.length > 0 ? entries : fallback;
}

const CURATED_DISPLAY_POOL = namedPool(CURATED_DISPLAY_FAMILIES, DISPLAY_POOL);
const CURATED_SECONDARY_POOL = namedPool(CURATED_SECONDARY_FAMILIES, SECONDARY_POOL);

function toUrlSpec(family: string): string {
  return family.replace(/\s+/g, "+");
}

function entryToChoice(entry: CatalogEntry): FontChoice {
  return {
    family: entry.family,
    urlSpec: toUrlSpec(entry.family),
    category: entry.category,
  };
}

export function pickRandomDisplay(exclude?: FontChoice): FontChoice {
  return entryToChoice(pickFromPool(CURATED_DISPLAY_POOL, exclude?.family));
}

export function pickRandomSecondary(exclude?: FontChoice): FontChoice {
  return entryToChoice(pickFromPool(CURATED_SECONDARY_POOL, exclude?.family));
}

// Look up a specific display font by family name. Returns null if it's not in
// the display pool (e.g., a font that was removed from Google's catalog or
// reclassified into a category we don't render).
export function resolveDisplayFont(family: string): FontChoice | null {
  const entry = CURATED_DISPLAY_POOL.find((f) => f.family === family);
  return entry ? entryToChoice(entry) : null;
}

export function resolveSecondaryFont(family: string): FontChoice | null {
  const entry = CURATED_SECONDARY_POOL.find((f) => f.family === family);
  return entry ? entryToChoice(entry) : null;
}

function pickFromPool(pool: CatalogEntry[], exclude?: string): CatalogEntry {
  const filtered = exclude ? pool.filter((f) => f.family !== exclude) : pool;
  return filtered[Math.floor(Math.random() * filtered.length)];
}

export function googleFontsUrl(specs: string[]): string {
  // Request multiple weights so display + body styles both look right.
  // Google Fonts will quietly drop weights that the family doesn't ship.
  const families = specs.map((s) => `family=${s}:wght@400;500;700;900`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

export const TOTAL_FONT_COUNT = {
  display: CURATED_DISPLAY_POOL.length,
  secondary: CURATED_SECONDARY_POOL.length,
};
