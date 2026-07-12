// Single source of truth for deriving a user's first name for display (greetings, etc).
// fullName itself is always stored and displayed verbatim elsewhere — this helper only
// ever extracts a first name for contexts like "Howdy, {firstName}".
export function getFirstName(fullName, email, fallback = 'Smartan') {
  // A backend fallback (Postgres trigger) stores the raw email as fullName when no name
  // was supplied at signup. Treat that case as "no fullName" rather than splitting an
  // email string on whitespace (which would return the whole email untouched).
  const looksLikeEmail = (val) => typeof val === 'string' && val.includes('@');

  if (fullName && typeof fullName === 'string' && fullName.trim() && !looksLikeEmail(fullName)) {
    return fullName.trim().split(/\s+/)[0];
  }

  const emailToUse = looksLikeEmail(fullName) ? fullName : email;
  if (emailToUse && typeof emailToUse === 'string') {
    const atIdx = emailToUse.indexOf('@');
    const prefix = atIdx > 0 ? emailToUse.slice(0, atIdx) : emailToUse;
    if (prefix) {
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
  }

  return fallback;
}
