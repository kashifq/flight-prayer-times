# CLAUDE.md — Flight Prayer Times

## Project overview

An offline PWA that calculates Islamic prayer times during flights. The core problem: prayer times depend on geographic position, and on a flight your position changes continuously across time zones and latitudes. Ground-based prayer apps give you static city times; this app computes times along the actual flight path, accounting for altitude and the moving day/night boundary.

**Live**: https://kashifq.github.io/flight-prayer-times/
**Repo**: https://github.com/kashifq/flight-prayer-times

## Commands

```bash
npm run dev          # Vite dev server (HMR)
npm run build        # TypeScript check + Vite production build (tsc -b && vite build)
npm test             # Run tests with vitest
npm run test:watch   # Watch mode tests
```

The `build` script runs `tsc -b` (stricter than `tsc --noEmit`) before Vite, so CI catches type errors that `--noEmit` might miss. Always run `npm run build` before pushing.

## Architecture

### Stack
- React 19 + TypeScript + Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- Vite 7 with `vite-plugin-pwa` for service worker / offline support
- No router — single-page app with conditional rendering (form → results → detail)
- No state management library — React useState/useMemo throughout
- Deployed to GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`)

### Directory structure

```
src/
├── engine/          # Pure computation — NO React, NO DOM
│   ├── types.ts     # All shared types (Airport, FlightInput, PrayerResult, etc.)
│   ├── solar.ts     # NOAA solar position algorithm (sun altitude, declination, etc.)
│   ├── flight-path.ts  # Great circle interpolation, altitude profile, horizon dip
│   ├── prayer-times.ts # Prayer time detection by scanning sun altitude along flight path
│   ├── qibla.ts     # Qibla bearing computation (great circle to Makkah)
│   ├── conventions.ts  # 7 prayer calculation conventions with angle parameters
│   └── index.ts     # Public API: computeFlightPrayerTimes()
├── components/
│   ├── input/       # Flight form and airport search
│   ├── results/     # Journey page, prayer timeline, detail cards, map, qibla diagram
│   ├── settings/    # Calculation settings bottom sheet
│   └── shared/      # PrayerName component
├── hooks/
│   ├── useNow.ts        # Ticking clock (30s interval) with ?now= debug override
│   ├── useFlightPosition.ts  # Position projection, GPS/manual fixes, recalculation trigger
│   ├── useSettings.ts   # Persisted calculation settings (localStorage)
│   └── useAirportSearch.ts   # Fuzzy search over airport data
├── lib/
│   ├── format.ts        # Time/coordinate/countdown formatting
│   ├── prayer-status.ts # Classify prayers as past/current/next/upcoming relative to "now"
│   └── fuzzy-search.ts  # Airport search scoring
├── data/
│   ├── airports.json    # ~7000 airports with IATA, coords, timezone
│   └── coastlines.ts    # Natural Earth 110m land polygons (auto-generated, public domain)
├── constants/
│   └── prayers.ts       # Prayer names (English + Arabic) and ordering
├── index.css            # Tailwind imports + theme colors + animations
├── App.tsx              # Root: form ↔ results navigation, settings state
└── main.tsx             # Entry point
```

### Key design decisions

**Engine is pure computation.** The `src/engine/` directory has zero React or DOM dependencies. It takes `FlightInput` + `CalculationSettings` and returns `CalculationResult` with prayer times, flight path waypoints, and qibla info. This makes it testable and potentially reusable outside React.

**1-minute resolution flight path.** `generateFlightPath()` creates a `FlightPoint` every minute with position (great circle interpolation), altitude (trapezoidal climb/cruise/descent profile), and sun altitude. Prayer times are detected by scanning for threshold crossings in the sun altitude curve.

**Altitude adjustment matters.** At cruise altitude, the observer can see further past the horizon. `horizonDipAngle()` computes this offset (~3.3° at 35,000 ft), which shifts sunrise/sunset by 10-20 minutes. This is the app's key differentiator vs ground-based calculators.

**Position override triggers full recalculation.** When the user sets a GPS fix or manual position, a new `FlightInput` is constructed: `{fix position, fix time} → {original arrival, original arrival time}`, and `computeFlightPrayerTimes()` re-runs. This is done in `ResultsScreen` via `useMemo` keyed on the fix state.

**The map is canvas-based, not a mapping library.** Keeps the app fully offline with no tile server dependency. Uses equirectangular projection (matches in-flight displays), Natural Earth 110m coastlines (~65KB), and analytically computed day/night terminator. Pan/zoom via native touch/mouse event handlers (React synthetic events are passive and can't preventDefault for touch).

**Debug time via URL parameter.** `?now=2026-03-18T23:30:00Z` freezes time for testing temporal states (past/current/next prayers, countdowns). The `useNow` hook checks for this on mount.

### Theme / styling

Warm amber/gold palette defined in `src/index.css` via Tailwind `@theme` directive:
- Primary: `#92400E` (light) / `#FBBF24` (dark) — rich amber-brown
- Accent: `#D97706` — bright gold for highlights
- Background: `#FEFBF6` (light) / `#171412` (dark) — warm cream/dark stone
- Full dark mode via `prefers-color-scheme: dark` CSS custom properties

Fonts: Inter (body) + Cairo (Arabic prayer names), loaded from Google Fonts.

### Data flow

```
FlightForm → onCalculate(FlightInput) → App.handleCalculate()
  → computeFlightPrayerTimes(input, settings) → CalculationResult
  → ResultsScreen receives {result, input, settings}
    → useNow() provides ticking clock
    → useFlightPosition(input, now) provides projected position + fix state
    → If fix exists: useMemo recalculates result from fix point
    → classifyPrayers(prayers, now) → temporal states (past/current/next)
    → PrayerTimeline renders cards
    → Tap card → PrayerDetailCard with qibla diagram + position map
```

### Position override model

Three sources of position, in priority order:
1. **Manual fix** — user taps map in "Adjust" mode. Sets `{lat, lon, at: now, source: 'manual'}`. Can be cleared.
2. **GPS fix** — user taps "Use GPS". Sets `{lat, lon, at: gpsTime, source: 'gps'}`. Persists (clearing manual reverts to GPS, not to pure projection).
3. **Projected** — time-based interpolation along great circle. If a fix exists, projects from fix point to arrival using remaining time proportion.

Any fix triggers prayer time recalculation from that position/time forward.

### PWA / offline

- `vite-plugin-pwa` generates a service worker with workbox
- Precaches JS, CSS, HTML, JSON (airports), SVG, PNG, WOFF2
- `registerType: 'autoUpdate'` — new versions activate automatically
- Max cache: 3MB (airports.json is the largest asset at ~635KB)
- GPS works offline (device sensor, not network)
- All computation is client-side

### Deployment

GitHub Pages via Actions. Every push to `main` triggers `.github/workflows/deploy.yml`:
1. `npm ci` → `npm run build` → upload `dist/` as Pages artifact

**Important**: `vite.config.ts` has `base: '/flight-prayer-times/'` for the GitHub Pages subdirectory. If deploying to a custom domain at root, change this to `base: '/'`.

The repo remote uses SSH with a dedicated key (`~/.ssh/id_ed25519_kashifq`) configured via `~/.ssh/config` as `Host github.com-kashifq`.

### Testing

58 tests in `src/engine/` covering:
- Solar position calculations (`solar.test.ts`)
- Great circle interpolation and flight path generation (`flight-path.test.ts`)
- Prayer time detection for known routes (`prayer-times.test.ts`)
- Qibla bearing computation (`qibla.test.ts`)

Run with `npm test`. No UI tests currently.

### Known limitations / future work

- **Coastline resolution** — Natural Earth 110m is recognizable but coarse when zoomed in. Could upgrade to 50m (~3x more data) or 10m.
- **Airport data** — Static JSON of ~7000 airports. Could add search by flight number (requires an API, breaks offline).
- **No route alternatives** — Assumes great circle path. Real flights deviate for weather, airways, restricted airspace. The manual position adjustment partially addresses this.
- **No notifications** — Could add web push notifications for upcoming prayer times.
- **PWA icons** — The `public/icons/` directory is empty. Need to generate 192x192 and 512x512 PNG icons for proper PWA install experience.
