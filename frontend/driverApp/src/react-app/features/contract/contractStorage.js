const CONTRACT_DRAFT_KEY = 'react-contract-draft';

export function loadContractDraft() {
  try {
    if (typeof localStorage === 'undefined') return null;

    const rawValue = localStorage.getItem(CONTRACT_DRAFT_KEY);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== 'object') return null;

    return parsedValue;
  } catch {
    return null;
  }
}

export function saveContractDraft(contract) {
  try {
    if (typeof localStorage === 'undefined') return;

    localStorage.setItem(CONTRACT_DRAFT_KEY, JSON.stringify(contract));
  } catch {
    // Ignore storage errors.
  }
}

export function clearContractDraft() {
  try {
    if (typeof localStorage === 'undefined') return;

    localStorage.removeItem(CONTRACT_DRAFT_KEY);
  } catch {
    // Ignore storage errors.
  }
}
