// The backend keeps these addresses for good and can redirect them when the website moves, so builds never need to change.
const LEGAL_BASE = "https://sagana-api.onrender.com";

export const LEGAL_URLS = {
  privacy: `${LEGAL_BASE}/privacy`,
  terms: `${LEGAL_BASE}/terms`,
  deleteAccount: `${LEGAL_BASE}/delete-account`,
} as const;
