import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rmSync } from 'node:fs';
import { buildSeed, SCENARIOS, type ScenarioId } from './seed';
import { Store } from './store';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.NAYA_DATA_DIR ?? join(here, '..', '.data');
const [command, scenarioArg] = process.argv.slice(2);
const scenario = (scenarioArg ?? 'default') as ScenarioId;

if (!(scenario in SCENARIOS)) {
  console.error(`Scénario inconnu : ${scenario}. Disponibles : ${Object.keys(SCENARIOS).join(', ')}`);
  process.exit(1);
}
if (command === 'reset') rmSync(dataDir, { recursive: true, force: true });
const store = new Store(buildSeed(dataDir, scenario), join(dataDir, 'db.json'));
store.persist();
console.info(`Données de démonstration « ${scenario} » écrites dans ${dataDir}. Redémarrez l’API si elle tourne déjà, ou utilisez POST /dev/reset.`);
