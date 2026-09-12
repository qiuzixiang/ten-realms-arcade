import fs from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {tutorialStates} from './tutorial.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Optional authoring tool only. Production build has zero npm dependencies.
const modulePath=process.env.DYE_SHARP_MODULE;
const {default:sharp}=modulePath?await import(pathToFileURL(modulePath).href):await import('sharp');
const states=tutorialStates();
for(const s of states){fs.writeFileSync(path.join(root,'assets/tutorial-'+s.key+'.svg'),s.svg);await sharp(Buffer.from(s.svg)).resize(720,720).png().toFile(path.join(root,'assets/tutorial-'+s.key+'.png'));}
fs.writeFileSync(path.join(root,'assets/tutorial-truth.json'),JSON.stringify(states.map(({svg,...state})=>state),null,2));
await sharp(path.join(root,'assets/icon.svg')).resize(512,512).png().toFile(path.join(root,'assets/icon.png'));
fs.copyFileSync(path.join(root,'assets/icon.png'),path.join(root,'release/icon-512.png'));
await sharp(path.join(root,'assets/workshop-hero.svg')).resize(1600,992).png().toFile(path.join(root,'release/workshop-art.png'));
console.log('Generated 3 replayed tutorials, icon and artwork PNG.');
