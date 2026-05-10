import localCategories from './data/categories.js';

/**
 * In-memory category image override store.
 * When admin uploads a new image via CMS, the URL is written here.
 * The public /api/categories endpoint reads from this map, merging it
 * with Firestore data — ensuring images show up immediately on the shop
 * page even when Firestore writes fail in local dev.
 * 
 * IMPORTANT: This also serves as a correction layer for known-broken
 * URLs that may be stored in Firestore (e.g. placeholder paths that
 * were never uploaded to Firebase Storage).
 */
// Known-broken URLs that should be replaced with empty string
// so the shop page renders the inline SVG fallback instead of a 404
const BROKEN_URL_PATTERNS = [
  'placeholder-luxury.jpg',
  '/images/products/',  // relative paths don't work in the browser
];

/**
 * In-memory category image override store.
 * When admin uploads a new image via CMS, the URL is written here.
 * The public /api/categories endpoint reads from this map, merging it
 * with Firestore data — ensuring images show up immediately on the shop
 * page even when Firestore writes fail in local dev.
 */
const categoryImageOverrides = {};

const isBrokenUrl = (url) => {
  if (!url) return false;
  return BROKEN_URL_PATTERNS.some(pattern => url.includes(pattern));
};

export { isBrokenUrl };
export default categoryImageOverrides;

