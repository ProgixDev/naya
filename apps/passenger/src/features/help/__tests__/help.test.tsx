import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Alert, Linking } from 'react-native';
import { supportTicketSchema } from '@naya/domain';
import { dialEmergency, EMERGENCY_NUMBERS, EMERGENCY_NUMBERS_TEXT, MOBILE_EMERGENCY_NUMBER } from '../emergency';

/** topics.ts reads one build flag from @naya/ui; the rest of the kit is not needed here. */
let mockStandalone = true;
jest.mock('@naya/ui', () => ({
  get STANDALONE_DEMO() {
    return mockStandalone;
  },
}));

type TopicsModule = typeof import('../topics');
const loadTopics = (mode: boolean): TopicsModule => {
  mockStandalone = mode;
  let mod: TopicsModule | undefined;
  jest.isolateModules(() => {
    // A fresh module per build flag: the SOS answer is chosen when topics.ts loads.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../topics') as TopicsModule;
  });
  return mod!;
};
const allText = (m: TopicsModule) => m.HELP_TOPICS.flatMap((t) => [t.title, t.subtitle, ...t.articles.flatMap((a) => [a.q, a.a])]).join('\n');

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Moroccan emergency numbers (PAX-11)', () => {
  it('lists police 19, Protection civile 15 and Gendarmerie royale 177, plus 112 from a mobile', () => {
    expect(EMERGENCY_NUMBERS.map((e) => [e.name, e.number])).toEqual([
      ['Police', '19'],
      ['Protection civile', '15'],
      ['Gendarmerie royale', '177'],
    ]);
    expect(MOBILE_EMERGENCY_NUMBER).toBe('112');
    expect(EMERGENCY_NUMBERS_TEXT).toContain('Protection civile 15 (pompiers et ambulances)');
    expect(EMERGENCY_NUMBERS_TEXT).not.toMatch(/SAMU/);
  });

  it('dials the number its label shows', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    for (const e of EMERGENCY_NUMBERS) dialEmergency(e.number);
    expect(open.mock.calls.map((c) => c[0])).toEqual(['tel:19', 'tel:15', 'tel:177']);
  });

  it('says so with a native alert when the device cannot dial', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no dialer'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    dialEmergency('15');
    await new Promise((r) => setTimeout(r, 0));
    expect(alert).toHaveBeenCalledWith('Appel impossible depuis cet appareil', 'Composez le 15 depuis un téléphone.');
  });
});

describe('help topics', () => {
  it('keeps the existing topics and adds wallet, Famille and car wash', () => {
    expect(loadTopics(true).HELP_TOPICS.map((t) => t.id)).toEqual(['trip', 'payment', 'account', 'wallet', 'family', 'safety', 'car-wash']);
  });

  it('opens a support category the server accepts', () => {
    for (const t of loadTopics(false).HELP_TOPICS) expect(supportTicketSchema.shape.category.safeParse(t.category).success).toBe(true);
  });

  it.each([true, false])('never names the SAMU, promises priority handling or shows demo wording (standalone: %s)', (mode) => {
    const text = allText(loadTopics(mode));
    expect(text).not.toMatch(/SAMU|priorit|démo|demo|simul/i);
    expect(text).toContain('Protection civile 15');
  });

  it('claims a safety team only when the app is connected to one', () => {
    const sos = (m: TopicsModule) => m.HELP_TOPICS.find((t) => t.id === 'safety')!.articles.find((a) => a.q.includes('SOS'))!.a;
    expect(sos(loadTopics(true))).not.toMatch(/équipe/);
    expect(sos(loadTopics(true))).toContain('enregistre une alerte');
    expect(sos(loadTopics(false))).toContain('à l’équipe sécurité Naya');
  });
});
