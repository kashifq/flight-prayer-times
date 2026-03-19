# Flight Prayer Times — Edge Cases & Scholarly Review Document

**Date:** March 2026
**Purpose:** Review of how the app computes prayer times during flights, with focus on edge cases at high latitudes and on long-haul routes. Intended for discussion with scholars (fuqaha) to validate the approach.

---

## 1. How the App Calculates Prayer Times

### 1.1 Core Method

The app computes prayer times by simulating the flight path minute-by-minute along the great circle route between departure and arrival airports. At each minute, it computes:

- **Aircraft position** (latitude, longitude) via spherical interpolation
- **Aircraft altitude** (trapezoidal profile: climb → cruise at 35,000 ft → descent)
- **Sun altitude** above the horizon at that position and time, using the NOAA Solar Position Algorithm

Prayer times are detected when the sun altitude crosses specific threshold angles:

| Prayer | Threshold | Direction |
|--------|-----------|-----------|
| **Fajr** | Sun crosses up through -(fajrAngle + dip) | Dawn — first light |
| **Sunrise** | Sun crosses up through -(0.833° + dip) | Upper limb appears |
| **Dhuhr** | Sun reaches maximum altitude (meridian transit) | Solar noon |
| **Asr** | Sun drops below Asr shadow angle | Afternoon |
| **Maghrib** | Sun crosses down through -(0.833° + dip) | Upper limb disappears |
| **Isha** | Sun crosses down through -(ishaAngle + dip) | Twilight ends |

Where:
- **fajrAngle / ishaAngle** come from the selected convention (e.g., Karachi: 18°, ISNA: 15°, MWL: 18°/17°)
- **dip** is the horizon dip angle caused by the aircraft's altitude
- **0.833°** combines atmospheric refraction (~0.567°) and the sun's semi-diameter (~0.266°), so that sunrise = first limb visible, sunset = last limb disappears

### 1.2 The Altitude Adjustment

At sea level, the horizon is at 0° geometric altitude. At 35,000 feet, the observer can see ~3.3° further over Earth's curvature. This means:

- **Sunset appears later** (the observer can still see the sun after it has set for ground observers)
- **Sunrise appears earlier** (the observer sees the sun before ground observers do)
- **The effective "night" is shorter** by roughly 20-40 minutes depending on latitude

The app refers to this as the "altitude-adjusted" observation method. It is the most astronomically accurate method for computing prayer times at cruise altitude.

### 1.3 Conventions Supported

| Convention | Fajr Angle | Isha Angle | Used by |
|-----------|-----------|-----------|---------|
| University of Islamic Sciences, Karachi | 18° | 18° | Pakistan, Bangladesh, parts of India |
| ISNA (Islamic Society of North America) | 15° | 15° | North America |
| Muslim World League (MWL) | 18° | 17° | Europe, parts of Middle East |
| Egyptian General Authority | 19.5° | 17.5° | Egypt, parts of Africa |
| Umm al-Qura | 18.5° | 90 min after Maghrib | Saudi Arabia |
| Tehran (Institute of Geophysics) | 17.7° | 14° (+ 4° Maghrib) | Iran, Shia communities |
| Diyanet (Turkish Religious Authority) | 18° | 17° | Turkey |

---

## 2. Test Methodology

We tested **432 scenarios**: 18 routes × 6 dates × 4 departure times.

**Routes tested** (chosen for geographic diversity and known difficulty):

| Route | Category | Max Latitude | Duration |
|-------|----------|-------------|----------|
| SFO→LHR | Polar Atlantic | 64.6°N | ~10h |
| JFK→HKG | Polar Arctic | 84.0°N | ~15h |
| LAX→DXB | Polar Arctic | 84.6°N | ~16h |
| ORD→PEK | Polar Arctic | 76.3°N | ~13h |
| YVR→NRT | Polar Pacific | 55.3°N | ~10h |
| HEL→JFK | High-latitude departure | 64.4°N | ~8h |
| KEF→JFK | High-latitude departure (Iceland) | 64.2°N | ~6h |
| OSL→BKK | High-latitude to tropics | 60.4°N | ~11h |
| ARN→SIN | High-latitude to tropics | 59.6°N | ~12h |
| LHR→SYD | Ultra-long haul | 57.2°N | ~20h |
| SIN→EWR | Ultra-long haul | 67.3°N | ~19h |
| DIA→AKL | Ultra-long (Doha→Auckland) | 25.3°N | ~17h |
| JED→JNB | Transequatorial | 21.7°N | ~9h |
| DXB→SYD | Transequatorial | 25.3°N | ~14h |
| NRT→JFK | East-west same latitude | 67.3°N | ~13h |
| LHR→LAX | East-west same latitude | 59.7°N | ~11h |
| HEL→LHR | Short high-latitude | 60.2°N | ~3h |
| KEF→OSL | Short high-latitude | 65.0°N | ~3h |

**Dates tested:**
- March 20 (vernal equinox)
- June 21 (summer solstice — longest days in Northern Hemisphere)
- September 22 (autumnal equinox)
- December 21 (winter solstice — shortest days in Northern Hemisphere)
- May 15 (late spring)
- August 10 (late summer)

**Departure times:** 01:00, 07:00, 13:00, 19:00 UTC for each route/date combination.

**Settings used:** Karachi convention (18°/18°), Hanafi Asr, altitude-adjusted observation.

---

## 3. Findings

### 3.1 Normal Operation (364 of 432 scenarios)

The majority of flights produce a clean, expected set of prayers in chronological order with no estimation needed. Tropical and mid-latitude routes (JED→JNB, DXB→SYD, DIA→AKL) work perfectly at all times of year. These require no special handling.

---

### 3.2 Duplicate Prayers — Same Prayer Occurs Twice (87 cases)

**What happens:** On long flights (>12 hours), the aircraft can experience two sunsets, two sunrises, or two solar noons. For example, LHR→SYD departs in the evening (sunset over Europe), flies through the night and the next day, and arrives near sunset again (sunset approaching Australia). Both sunsets are real, physically observable events.

**Affected prayers:** Maghrib (most common), Fajr, Sunrise, Asr, Dhuhr — all can duplicate on sufficiently long flights.

**Example:** LHR→SYD, December 21, depart 21:00 UTC:
- Fajr at 01:38 UTC (54°N, over Russia)
- Sunrise at 02:42 UTC (50°N, over Kazakhstan)
- Dhuhr at 06:21 UTC (31°N, over India)
- Asr at 08:39 UTC (17°N, over Bay of Bengal)
- Maghrib at 10:03 UTC (8°N, over Indonesia)
- Isha at 11:11 UTC (0°N, over equator)

This is a full 24-hour prayer cycle within a 20-hour flight — a complete "day" of prayers.

**Our approach:** Display all prayers in chronological order. When a prayer name appears more than once, label them "1st" and "2nd" (e.g., "Maghrib 1st", "Maghrib 2nd").

**Open question for scholars:**
> When Maghrib occurs twice in one flight, is the traveler obligated to pray at both occurrences? Or does the first one "count" and the second is treated as a new day's prayer? This is analogous to a traveler on the ground who crosses the date line — the scholarly consensus seems to be that each prayer is prayed when it physically occurs, regardless of how many times the sun sets.

---

### 3.3 Estimated Prayers — High-Latitude Fallback (48 cases)

This is the most important category for scholarly review.

**The problem:** At high latitudes in summer (and to a lesser extent in winter), the sun may not dip far enough below the horizon to trigger Fajr or Isha. For example, at 64°N in June, the sun's minimum altitude might be -6°. With the Karachi convention requiring -18° for Isha and the altitude dip adding another 3.3°, the threshold of -21.3° is never reached. The sun simply doesn't go that far below the horizon.

This is the same problem faced by Muslims living in Scandinavia, Iceland, Scotland, and northern Canada — but amplified by the altitude adjustment at 35,000 feet.

**Our fallback cascade:**

We implemented a three-stage approach:

**Stage 1: Try altitude-adjusted calculation** (the default)
The standard method. Accounts for the observer's altitude at 35,000 ft. This is the most astronomically precise method.

**Stage 2: Fall back to ground-level calculation**
If altitude-adjusted finds no Isha or Fajr crossing, we retry using ground-level thresholds (no altitude dip). This recovers cases where the sun reaches, say, -19° but not -21.3°. The prayer time is computed as if the observer were on the ground directly below the aircraft.

*This recovers approximately 20 of the 48 estimated cases.*

**Stage 3: Angle-based (proportional) estimation**
If even ground-level fails, we use the angle-based method recommended by ISNA and the Muslim World League:

```
night_duration = sunrise_time - maghrib_time

isha_time  = maghrib_time  + (isha_angle / 60) × night_duration
fajr_time  = sunrise_time  - (fajr_angle / 60) × night_duration
```

For Karachi (18°/18°): Isha is placed at 30% of the night after Maghrib, Fajr at 30% of the night before Sunrise.

*This recovers the remaining 28 cases.*

**Why this approach:**

| Method | Pros | Cons |
|--------|------|------|
| **Angle-based (our choice)** | Scales proportionally with night length; widely adopted by apps (Muslim Pro, Adhan library); recommended by ISNA/MWL | Not based on actual astronomical observation — it's a mathematical convenience |
| **One-seventh of the night** | Hadith-based interpretation; simple | Does not account for convention angles; gives the same result regardless of whether you use 15° or 18° convention |
| **Middle of the night** | Conservative; absolute bound | Too restrictive — Isha and Fajr both at midnight leaves no prayer window |
| **Nearest latitude (Aqrab al-Bilad)** | Strong classical fiqh basis; uses real astronomical data from reference latitude (48.5°) | Complex to implement for a moving aircraft; reference latitude is debatable |
| **Nearest day (Aqrab al-Ayyam)** | Uses the last known real prayer time | Not applicable to flights — the "last known day" may be from a completely different location |

**How estimated prayers are marked:** The app shows estimated prayers with a distinct visual indicator and a note explaining the estimation method. The user can see that this prayer was not detected from direct sun observation but was estimated due to the short night at high latitude.

**Open questions for scholars:**

> 1. **Is the angle-based method acceptable for in-flight use?** It is widely adopted for ground-based apps in high-latitude cities (London, Oslo, Helsinki, Reykjavik). Does the same ruling extend to a traveler flying over these latitudes?
>
> 2. **Should we offer the one-seventh method as an alternative?** Some scholars, particularly in the Hanafi tradition (Wifaqul Ulama in Britain, Moonsighting Committee), prefer the one-seventh method. Should the app offer this as a setting?
>
> 3. **Is the ground-level fallback appropriate?** When altitude-adjusted fails, we try ground-level before resorting to estimation. The ground-level time represents when a person directly below the aircraft on the ground would observe the prayer transition. Is this a valid reference point for the airborne traveler?
>
> 4. **At what latitude threshold should estimation begin?** Currently we estimate whenever the sun doesn't reach the required angle. Should there be a minimum night duration below which we don't even try to compute Isha/Fajr (e.g., if the night is less than 30 minutes)?

---

### 3.4 Short Nights — Night Duration Under 2 Hours (6 cases)

**The problem:** On summer flights at high latitudes (60-65°N), the sun may only dip below the horizon for a short period. The night — defined as the interval between Maghrib and Sunrise — can be as short as **90-120 minutes**.

When this happens, the angle-based estimation compresses Isha and Fajr into a very tight window:

**Example:** SFO→LHR, June 21, depart 1:00 UTC:
- Maghrib at 04:04 UTC (sun sets at 55°N over central Canada)
- Isha at 04:34 UTC (estimated, 30 min after Maghrib)
- Fajr at 05:15 UTC (estimated, 30 min before Sunrise)
- Sunrise at 05:45 UTC (sun rises at 62°N over Greenland)

The total night is **101 minutes**. Isha and Fajr are only **41 minutes apart**. The Isha-to-Fajr window for praying Isha is extremely compressed.

**Shortest nights found in testing:**

| Route | Date | Night Duration | Isha-Fajr Gap |
|-------|------|---------------|---------------|
| SFO→LHR | Jun 21 | 101 min | 41 min |
| HEL→JFK | Jun 21 | 107 min | 43 min |
| SFO→LHR | Aug 10 | 106 min | ~42 min |
| SFO→LHR | May 15 | 107 min | ~43 min |
| LAX→DXB | Jun 21 | ~90 min | ~36 min |
| LAX→DXB | Aug 10 | ~95 min | ~38 min |

**Our approach:** We compute the estimated times using the angle-based method and display them. The traveler can see that the window is very short and plan accordingly.

**Open questions for scholars:**

> 1. **Is a 41-minute gap between Isha and Fajr valid?** If the traveler prays Isha at 04:34 and Fajr at 05:15, is this acceptable? The Isha prayer window is technically open from 04:34 to 05:15 (41 minutes), which is a very short window by normal standards but not unprecedented — some high-latitude cities in summer have similarly compressed windows.
>
> 2. **Should there be a minimum night duration?** If the night is, say, less than 60 minutes, should the app show a different message — perhaps advising the traveler to combine Maghrib and Isha, or to follow the Umm al-Qura method (Isha = 90 min after Maghrib)?
>
> 3. **Should we offer the one-seventh method here?** For the 101-minute night above, one-seventh gives: Isha = Maghrib + 14.4 min, Fajr = Sunrise - 14.4 min. The window becomes even more compressed (Isha at 04:18, Fajr at 05:31 — a 73-minute gap). The angle-based method actually gives a wider gap here because 18°/60° = 30% > 1/7 ≈ 14.3%.

---

### 3.5 Very Close Prayers — Under 15 Minutes Apart (3 cases)

**The problem:** Two adjacent prayers can be extremely close together, making it physically difficult to complete one before the other begins.

**Cases found:**

1. **Sunrise and Maghrib 1 minute apart** — LHR→SYD, May 15: The plane arrives in Sydney near sunset. The sunrise (from the morning) and the next sunset are separated by a full day of flight, but in the timeline they appear adjacent because other prayers filled the middle. However, the 1-minute gap is between the morning's sunrise and the evening's Maghrib at the destination — these are from different parts of the day.

2. **Isha and Fajr 12 minutes apart** — JFK→HKG, Dec 21 at 84°N: At extreme Arctic latitudes in winter, the sun briefly dips below the Isha threshold and rises above the Fajr threshold within minutes. The "night" at these angles is extremely brief.

3. **Sunrise and Maghrib 5 minutes apart** — LHR→SYD, Aug 10: Similar to case 1.

**Our approach:** Display both prayers with their correct times. The traveler can see the proximity and plan accordingly.

**Note:** Cases 1 and 3 are not actually problematic — the two prayers are from different parts of the day (morning sunrise vs evening maghrib) and just happen to be adjacent in the timeline due to the flight's progression. Case 2 is the genuinely difficult one.

**Open question for scholars:**

> When Isha and Fajr are only 12 minutes apart (at extreme polar latitudes), is it permissible for the traveler to combine them into a single prayer session? This parallels the question of combining prayers during travel (jam' bayn as-salatayn), which many scholars permit for travelers.

---

### 3.6 Zero Prayers During Flight (28 cases)

**What happens:** Short flights at certain times of day may have no prayer transitions at all. The flight takes off after all transitions have occurred and lands before the next ones begin.

**Most common scenario:** Winter flights from Helsinki or Reykjavik to destinations in the Americas. The flight departs after sunset and arrives before the next sunrise on the far side.

**Example:** HEL→JFK, December 21, depart 14:30 UTC (16:30 Helsinki time, already after sunset). Arrives 22:26 UTC (17:26 NYC time, also after sunset). The entire 8-hour flight is in darkness with no prayer transitions.

**Our approach:** Show a clear message: "No prayer transitions occur during this flight. All prayers fall before departure or after arrival. Use your departure or arrival city times."

**This is not controversial** — it simply means the traveler should follow the normal ground-based prayer schedule for either their departure or arrival city.

---

### 3.7 Prayer Order Anomalies (55 cases)

**What happens:** On eastbound flights, the sequence of prayers doesn't follow the standard daily order (Fajr → Sunrise → Dhuhr → Asr → Maghrib → Isha). For example, the flight might encounter: Maghrib → Isha → Fajr → Sunrise.

**Why this happens:** The standard prayer order assumes a stationary observer experiencing one rotation of the Earth. A traveler moving eastward at 500+ mph encounters the night cycle out of the normal sequence relative to their starting point.

**Our approach:** Display prayers in strict chronological order (by UTC time of occurrence). The traveler should pray each prayer when its time arrives, regardless of whether the order matches the standard daily sequence.

**This is not controversial** — it follows the basic principle that each prayer is prayed at its time. The "anomaly" is just a consequence of high-speed travel and is handled by displaying the correct chronological sequence.

---

## 4. Summary of Decisions Made

| Decision | What we do | Why |
|----------|-----------|-----|
| **Altitude adjustment** | Default on (observer at 35,000 ft) | Most astronomically accurate; accounts for the actual visible horizon |
| **Convention angles** | User selects from 7 conventions | Respects different scholarly traditions |
| **High-latitude Fajr/Isha** | 3-stage fallback: altitude-adjusted → ground-level → angle-based | Recovers prayer times in all tested scenarios |
| **Estimation method** | Angle-based (angle/60 × night) as default | Most widely adopted; scales with convention angles; ISNA/MWL recommended |
| **Duplicate prayers** | Show all with ordinal labels | Each physical transition is a real prayer time |
| **Short nights** | Show estimated times with indicator | Traveler can see the compressed window |
| **Zero prayers** | Clear guidance to use city times | Standard traveler ruling |
| **Prayer ordering** | Chronological display | Each prayer prayed at its time |

## 5. Open Questions for Scholarly Review

1. **Is the angle-based estimation (angle/60 × night) acceptable for in-flight Fajr/Isha when the sun doesn't reach the required depression angle?**

2. **Should the one-seventh of the night method be offered as an alternative?** If so, as a user setting alongside the convention selection?

3. **Is the ground-level fallback (ignoring altitude) an acceptable intermediate step?** It gives a prayer time based on when a ground observer directly below would experience the transition.

4. **When Isha and Fajr are very close together (< 45 minutes apart), should the app suggest combining prayers or following the Umm al-Qura fixed-interval method (Isha = 90 min after Maghrib)?**

5. **When a prayer occurs twice (e.g., two Maghribs, 14 hours apart), does the traveler pray at both?** Or does the second occurrence begin a "new day" of obligations?

6. **Should there be a minimum night duration below which Isha/Fajr estimation is not attempted?** For example, if the night is only 30 minutes, is it meaningful to compute Isha at +9 minutes and Fajr at -9 minutes?

7. **For the altitude adjustment: should the traveler use the altitude-adjusted time (what they can physically observe from the aircraft window) or the ground-level time (what someone below them on the ground would observe)?** The app defaults to altitude-adjusted as more astronomically accurate, but this makes the night even shorter at high latitudes.

---

## Appendix A: Angle-Based Estimation Formula

When the sun does not reach the required depression angle for Fajr or Isha during the flight, the angle-based method estimates the prayer time proportionally:

**For Isha:**
```
isha_time = maghrib_time + (isha_angle ÷ 60) × (sunrise_time - maghrib_time)
```

**For Fajr:**
```
fajr_time = sunrise_time - (fajr_angle ÷ 60) × (sunrise_time - maghrib_time)
```

**Example with Karachi convention (18°/18°) and a 120-minute night:**
- Isha = Maghrib + (18/60) × 120 = Maghrib + 36 minutes
- Fajr = Sunrise - (18/60) × 120 = Sunrise - 36 minutes
- Gap between Isha and Fajr = 120 - 36 - 36 = 48 minutes

**With ISNA convention (15°/15°) and the same 120-minute night:**
- Isha = Maghrib + (15/60) × 120 = Maghrib + 30 minutes
- Fajr = Sunrise - (15/60) × 120 = Sunrise - 30 minutes
- Gap = 120 - 30 - 30 = 60 minutes

The ISNA convention, with its lower angles, produces less compression in short nights.

## Appendix B: Alternative Estimation Methods (Not Currently Implemented)

**One-seventh of the night (Sab'u al-Layl):**
```
isha_time = maghrib_time + (1/7) × night_duration
fajr_time = sunrise_time - (1/7) × night_duration
```
Advocated by the Moonsighting Committee and some Hanafi scholars. Simpler but doesn't vary with convention angles. For a 120-minute night: Isha = +17 min, Fajr = -17 min, gap = 86 min.

**Middle of the night (Nisf al-Layl):**
```
midnight = maghrib_time + night_duration / 2
```
Both Isha's latest time and Fajr's earliest time are at this midpoint. This is an absolute bound, not a practical prayer time.

**Nearest latitude (Aqrab al-Bilad):**
Compute Isha/Fajr intervals at latitude 48.5° (where the convention angles first fail) and apply those intervals to the local Maghrib/Sunrise times. This has the strongest classical fiqh basis but is complex for a moving aircraft.

## Appendix C: Test Data

The complete fuzz test script and raw results are available in the repository at:
- `scripts/fuzz-test.ts` — the test script (432 scenarios)
- `scripts/test-edge-cases.ts` — the initial edge case tests

These can be re-run with `npx tsx scripts/fuzz-test.ts` to verify results or test with different conventions/settings.
