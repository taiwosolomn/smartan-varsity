export function getFirstName(fullName, email) {
  const isEmail = (val) => val && typeof val === 'string' && val.includes('@');

  const cleanAndExtract = (word) => {
    if (!word) return 'Smartan';
    const commonPrefixes = ['solomon', 'jane', 'john', 'david', 'sarah', 'daniel', 'mary', 'james', 'robert', 'michael', 'william', 'joseph', 'charles'];
    const lowerWord = word.toLowerCase();
    for (const prefix of commonPrefixes) {
      if (lowerWord.startsWith(prefix)) {
        return prefix.charAt(0).toUpperCase() + prefix.slice(1);
      }
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  };

  // Check fullName first
  if (fullName && typeof fullName === 'string' && fullName.trim().length > 0 && !isEmail(fullName)) {
    const cleanName = fullName.trim();
    // Split by any common separator: spaces, dots, dashes, underscores
    const parts = cleanName.split(/[\s\._-]/).filter(Boolean);
    if (parts.length > 0) {
      return cleanAndExtract(parts[0]);
    }
  }

  // Fallback to email
  const emailToUse = isEmail(fullName) ? fullName : email;
  if (emailToUse && typeof emailToUse === 'string' && emailToUse.trim().length > 0) {
    const atIdx = emailToUse.indexOf('@');
    const prefix = atIdx > 0 ? emailToUse.slice(0, atIdx) : emailToUse;
    // Split prefix by dots, dashes, underscores, spaces
    const parts = prefix.split(/[\s\._-]/).filter(Boolean);
    if (parts.length > 0) {
      return cleanAndExtract(parts[0]);
    }
  }

  return 'Smartan';
}
