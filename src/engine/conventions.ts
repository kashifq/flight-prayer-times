import type { Convention, ConventionId } from './types.ts'

export const CONVENTIONS: Record<ConventionId, Convention> = {
  mwl: {
    id: 'mwl',
    name: 'Muslim World League',
    fajrAngle: 18,
    ishaAngle: 17,
    ishaMinutesAfterMaghrib: null,
    maghribAngle: 0.833,
  },
  isna: {
    id: 'isna',
    name: 'ISNA (North America)',
    fajrAngle: 15,
    ishaAngle: 15,
    ishaMinutesAfterMaghrib: null,
    maghribAngle: 0.833,
  },
  egyptian: {
    id: 'egyptian',
    name: 'Egyptian General Authority',
    fajrAngle: 19.5,
    ishaAngle: 17.5,
    ishaMinutesAfterMaghrib: null,
    maghribAngle: 0.833,
  },
  'umm-al-qura': {
    id: 'umm-al-qura',
    name: 'Umm al-Qura (Saudi Arabia)',
    fajrAngle: 18.5,
    ishaAngle: null,
    ishaMinutesAfterMaghrib: 90,
    maghribAngle: 0.833,
  },
  karachi: {
    id: 'karachi',
    name: 'University of Islamic Sciences, Karachi',
    fajrAngle: 18,
    ishaAngle: 18,
    ishaMinutesAfterMaghrib: null,
    maghribAngle: 0.833,
  },
  tehran: {
    id: 'tehran',
    name: 'Tehran / Jafari',
    fajrAngle: 17.7,
    ishaAngle: 14,
    ishaMinutesAfterMaghrib: null,
    maghribAngle: 4.0,
  },
  diyanet: {
    id: 'diyanet',
    name: 'Diyanet (Turkey)',
    fajrAngle: 18,
    ishaAngle: 17,
    ishaMinutesAfterMaghrib: null,
    maghribAngle: 0.833,
  },
}

export function getConvention(id: ConventionId): Convention {
  return CONVENTIONS[id]
}
