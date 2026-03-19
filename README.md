# Flight Prayer Times

An offline-capable Progressive Web App that calculates Islamic prayer times during flights, accounting for the aircraft's changing position, altitude, and the shifting day/night boundary.

**Live app: https://kashifq.github.io/flight-prayer-times/**

## What it does

When you're flying, prayer times change continuously as your position moves across time zones and latitudes. Ground-based prayer apps don't account for this. Flight Prayer Times computes prayer times along the great circle route between your departure and arrival airports, adjusting for:

- **Aircraft position** — prayer times are calculated at each point along the flight path, not at a fixed city
- **Cruise altitude** — at 35,000 ft you can see ~3.3° further over Earth's curvature, which shifts sunrise/sunset by 10–20 minutes
- **Qibla direction** — computed relative to the aircraft's heading so you know which way to face

## Features

- **7 calculation conventions** — MWL, ISNA, Egyptian, Umm al-Qura, Karachi, Tehran, Diyanet
- **Hanafi and standard Asr** calculation methods
- **4 observation methods** — altitude-adjusted, ground-level, departure city, arrival city
- **Interactive flight map** with Natural Earth coastlines, day/night terminator, and pan/zoom
- **GPS position fixing** — use device GPS on the ground to account for delays/taxiing, with automatic prayer time recalculation
- **Manual position adjustment** — compare with the in-flight display and tap to set your position, triggering recalculation
- **Time-aware journey page** — past prayers are dimmed, current prayer is highlighted, next prayer shows a countdown
- **Prayer detail cards** — tap any prayer to see qibla direction diagram, position on the map with day/night overlay, and times in both departure and arrival timezones
- **Fully offline** — works without internet after first load (PWA with service worker)
- **Dark and light mode** — follows system preference

## How to use

1. Enter departure and arrival airports
2. Set departure date/time and arrival date/time (or let it estimate from the route)
3. Tap **Calculate Prayer Times**
4. The journey page shows your prayers — tap any for details
5. Use **GPS** or **Adjust** to refine your position during the flight

### Debug mode

Append `?now=2026-03-18T23:30:00Z` to the URL to freeze time at a specific moment. Useful for testing different points during a flight.

## Technical details

- **Framework**: React 19 + TypeScript + Tailwind CSS v4
- **Build**: Vite with PWA plugin (workbox)
- **Solar calculations**: NOAA Solar Position Algorithm (~1 minute accuracy)
- **Flight path**: Spherical linear interpolation (Slerp) along the great circle with trapezoidal altitude profile
- **Map**: Canvas-rendered equirectangular projection with Natural Earth 110m coastline data (public domain)
- **Day/night terminator**: Analytically computed from solar declination and hour angle
- **Airport data**: ~7,000 airports with IATA codes, coordinates, and timezones

## Development

```bash
npm install
npm run dev          # Start dev server
npm run build        # Production build
npm test             # Run tests (vitest)
```

## License

MIT
