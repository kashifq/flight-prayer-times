export interface Airport {
  iata: string
  name: string
  city: string
  country: string
  lat: number
  lon: number
  elevation_ft: number
  tz: string // IANA timezone e.g. "America/New_York"
}

export interface FlightInput {
  departure: Airport
  arrival: Airport
  departureUTC: Date
  arrivalUTC: Date
  cruiseAltitudeFt: number // Default 35000
}

export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

export type PrayerStatus =
  | { kind: 'during-flight'; utc: Date; lat: number; lon: number; altitudeFt: number }
  | { kind: 'before-departure'; utc: Date }
  | { kind: 'after-arrival'; utc: Date }
  | { kind: 'undetermined'; reason: string }

export type EstimationMethod = 'none' | 'ground-level-fallback' | 'angle-based'

export interface PrayerResult {
  prayer: PrayerName
  status: PrayerStatus
  altitudeAdjusted: boolean
  /** If this prayer was estimated rather than detected from a threshold crossing */
  estimated?: EstimationMethod
}

export interface FlightPoint {
  minuteIndex: number
  utc: Date
  lat: number
  lon: number
  altitudeM: number
  sunAltitudeDeg: number
}

export type ConventionId = 'mwl' | 'isna' | 'egyptian' | 'umm-al-qura' | 'karachi' | 'tehran' | 'diyanet'
export type AsrSchool = 'standard' | 'hanafi'
export type ObservationMethod = 'altitude-adjusted' | 'ground-level' | 'departure-city' | 'arrival-city'

export interface Convention {
  id: ConventionId
  name: string
  fajrAngle: number
  ishaAngle: number | null // null when isha is fixed minutes
  ishaMinutesAfterMaghrib: number | null // for Umm al-Qura (90 min)
  maghribAngle: number // 0.833 for most; 4.0 for Jafari
}

export interface CalculationSettings {
  convention: ConventionId
  asrSchool: AsrSchool
  observationMethod: ObservationMethod
}

export interface QiblaInfo {
  bearing: number // Absolute bearing to Makkah (0-360)
  relativeToCourse: number // Relative to aircraft heading (-180 to 180)
  aircraftHeading: number // Aircraft heading along great circle
}

export interface CalculationResult {
  prayers: PrayerResult[]
  flightPath: FlightPoint[]
  qiblaAtPrayerTimes: Map<PrayerName, QiblaInfo>
  settings: CalculationSettings
}
