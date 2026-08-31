/**
 * Sanitizes and cleans user / visitor names for display in notifications and UI.
 * E.g., 'vaideeswari. 2007' -> 'Vaideeswari'
 *       'vaideeswari.2007'  -> 'Vaideeswari'
 *       'sweetyammu0217@gmail.com' -> 'Sweetyammu'
 *       'agila' -> 'Agila'
 *       'Thilagavathy U' -> 'Thilagavathy U'
 */
const formatDisplayName = (rawName, fallback = 'Authorized Personnel') => {
  if (!rawName || typeof rawName !== 'string') return fallback;
  let str = rawName.trim();
  if (!str) return fallback;

  // If email, strip domain
  if (str.includes('@')) {
    str = str.split('@')[0];
  }

  // Remove email / registration digit suffixes, dots, years like ". 2007", ".2007", " 2007", "_2007", "0217"
  str = str.replace(/[\._\-\s]*\d+$/g, '').trim();
  // Remove any trailing or leading punctuation/dots
  str = str.replace(/^[\.\-_\s]+|[\.\-_\s]+$/g, '').trim();

  if (!str) return fallback;

  // Capitalize properly if all lowercase
  if (str === str.toLowerCase()) {
    str = str.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  return str || fallback;
};

module.exports = { formatDisplayName };
