# Presidency University Physics Society (PUPS) — Official Website & Portals

Vanilla HTML5 + CSS3 + JavaScript multi-page website and academic portal suite with Google Apps Script (`Code.gs`) backend integration.

## Pages & Architecture

### Public Pages
- `index.html` — Home (Quantum Scroll Entrance, 3D Celestial Hero, Live Signal Metrics, Events & Colloquia Preview)
- `about.html` — Mission & Society Culture
- `events.html` — Searchable Public Events Directory
- `colloquium.html` — Filterable Academic Colloquium & Video Archive
- `team.html` — Dynamic Committee & Faculty Directory (with Admin Visual Editor)
- `contact.html` — Dynamic Contact Information & Communications Enquiry Form (with Admin Visual Editor)
- `login.html` — Role-Based Cryptographic Login Portal (`Student`, `Member`, `Admin`)
- `register.html` — Student Account Registration with Live DNS MX Check & 6-Digit Email OTP
- `webside.html` — Legacy compatibility redirect to `index.html`

### Authenticated Portals
1. **Student Portal (`student.html`, `lab.html`, `formulas.html`, `forum.html`)**
   - `student.html`: Live academic telemetry, Daily Physics Conceptual Challenge, auto-saving Study & Derivation Scratchpad (with `.txt` export), Bookmarked Formulas quick-access, and society event feed.
   - `lab.html`: Real-time HTML5 Canvas Computational Physics Workbench with 4 interactive simulation engines (*Restricted 3-Body Orbital Dynamics*, *Damped Driven Pendulum with Phase-Space Attractor*, *Quantum Wavepacket Barrier Tunneling*, and *Young's Double-Slit Wave Interference*), interactive sliders, presets, click-to-launch canvas controls, live telemetry, and CSV data export.
   - `formulas.html`: 18-equation Physics Formula Compendium across 5 disciplines with instant search, category filtering, interactive numerical solver for every equation, one-click LaTeX copy, bookmarking, CODATA Fundamental Physical Constants table, and Physics Unit Converter.
   - `forum.html`: Peer Academic Discussion Forum across 4 specialized rooms (*Astrophysics*, *Quantum / Optics*, *Materials Physics*, *Computational Physics*) with new thread creation, peer replies, upvoting, tag filtering, sorting, and strict XSS sanitization.
2. **Member Dashboard (`member.html`)**
   - Add/remove public Events, maintain the Colloquium archive, and update society-wide Academic Statistics.
3. **Administrator Control Centre (`admin.html`)**
   - Cloud-synced user role authorization (permanent or timed temporary elevation), security governance policy (2FA, login alerts, brute-force rate limiting, session expiration), global 7-preset website typography switcher, and live session supervision with instant Force Logout.

## Security Hardening Highlights (v3.0)
- **Zero Unsanitized HTML / Stored XSS Protection**: All user-generated fields, URLs, and backend payloads are strictly sanitized (`escapeHTML`, `escapeAttr`, `sanitizeUrl`, `formatSafeHeading`).
- **Cryptographic Password Hashing**: WebCrypto SHA-256 with a complete FIPS 180-4 pure-JS SHA-256 fallback (no weak 32-bit fallback hashes).
- **Hardened Google Apps Script (`Code.gs`)**: Removed development OTP bypasses, added constant-time token comparison, 60-second OTP rate limiting, single-use OTP invalidation, and spreadsheet formula-injection sanitization (`sanitizeSheetCell`).
- **Pinned CDN Dependencies & Security Meta Headers**: Strict referrer policy, `X-Content-Type-Options: nosniff`, and pinned external library versions.
