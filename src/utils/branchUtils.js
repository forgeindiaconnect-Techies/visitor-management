/**
 * Normalizes branch name strings across the application.
 * e.g. "Head Office(KRISHNAGIRI)", "Head Office", "KRISHNAGIRI" -> "Krishnagiri"
 *      "Bangalore", "Bengaluru" -> "Bangalore"
 */
export const normalizeBranchName = (name) => {
  if (!name) return '';
  const upper = String(name).toUpperCase().trim();
  if (upper.includes('KRISHNAGIRI') || upper === 'HEAD OFFICE') return 'Krishnagiri';
  if (upper.includes('BANGALORE') || upper.includes('BENGALURU')) return 'Bangalore';
  if (upper.includes('THIRUPATTUR') || upper.includes('TIRUPATTUR') || upper.includes('THIRUPATHUR')) return 'Thirupathur';
  if (upper.includes('SALEM')) return 'Salem';
  if (upper.includes('CHENNAI')) return 'Chennai';
  if (upper.includes('HOSUR')) return 'Hosur';
  return name.trim();
};

/**
 * Checks if a visitor's branch matches the active branch filter.
 */
export const isBranchMatch = (visitorBranch, filterBranch) => {
  if (!filterBranch || filterBranch === 'All Branches') return true;
  if (!visitorBranch) return false;
  
  const normVisitor = normalizeBranchName(visitorBranch).toLowerCase();
  const normFilter = normalizeBranchName(filterBranch).toLowerCase();
  
  return normVisitor === normFilter || 
         visitorBranch.toLowerCase().includes(normFilter) || 
         filterBranch.toLowerCase().includes(normVisitor);
};

/**
 * Returns distinct list of normalized branch names from branches and visitors.
 */
export const getDistinctBranches = (branches = [], visitors = []) => {
  const discovered = new Set(['Krishnagiri', 'Bangalore']);
  
  (branches || []).forEach(b => {
    if (b && b !== 'All Branches') {
      const norm = normalizeBranchName(b);
      if (norm) discovered.add(norm);
    }
  });

  (visitors || []).forEach(v => {
    const raw = v.branch || v.branchLocation;
    if (raw && raw !== 'All Branches') {
      const norm = normalizeBranchName(raw);
      if (norm) discovered.add(norm);
    }
  });

  return Array.from(discovered);
};
