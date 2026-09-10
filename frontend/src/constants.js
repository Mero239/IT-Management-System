// Single place to customize this installation for a different company.
//
// If you change DEFAULT_PASSWORD here, also set the matching DEFAULT_PASSWORD
// env var on the backend (services/auth.py reads it) — they must stay in sync,
// since the backend is what actually validates a new account's first login.
export const DEFAULT_PASSWORD = 'Mobica@2024'

// Short tagline shown under the logo on public/auth screens (login, forgot
// password, ticket print, the public new-ticket and support-agreement pages).
// The main app name/tagline used inside the logged-in app are in
// i18n/translations.js under 'app.name' / 'app.tagline'.
export const BRAND_TAGLINE = 'Mobica IT Support'
