/**
 * Moroccan emergency numbers (PAX-11, PRD-23). 15 is the Protection civile (fire and
 * ambulance), not the French SAMU. Every mention in both apps reads from this list,
 * so the copy and the tel: links cannot drift apart.
 */
export const EMERGENCY_NUMBERS = [
  { number: '19', name: 'Police', detail: 'En agglomération', testID: 'call-police' },
  { number: '15', name: 'Protection civile', detail: 'Pompiers et ambulances', testID: 'call-civil-protection' },
  { number: '177', name: 'Gendarmerie royale', detail: 'Hors agglomération', testID: 'call-gendarmerie' },
] as const;

/** Works from any mobile phone, alongside the numbers above. */
export const MOBILE_EMERGENCY_NUMBER = '112';

/** One line for help answers: « police 19 ; Protection civile 15 (pompiers et ambulances) ; … ». */
export const EMERGENCY_NUMBERS_TEXT = `police ${EMERGENCY_NUMBERS[0].number} ; Protection civile ${EMERGENCY_NUMBERS[1].number} (pompiers et ambulances) ; Gendarmerie royale ${EMERGENCY_NUMBERS[2].number} hors agglomération ; ${MOBILE_EMERGENCY_NUMBER} depuis un mobile`;
