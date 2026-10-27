import { connect } from './hid-debug';
const a = await connect();
try { const p = await a.readActiveProfile(); console.log('bands OK, band1', JSON.stringify(p.bands[0])); } catch (e) { console.log('bands:', (e as Error).name); }
await a.disconnect(); process.exit(0);
