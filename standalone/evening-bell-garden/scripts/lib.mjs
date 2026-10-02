import fs from 'node:fs';
import vm from 'node:vm';
export function runtime(files=['engine','levels','store','render']) { const ctx=vm.createContext({console,Date,Math,Set,Map}); for(const f of files) vm.runInContext(fs.readFileSync(new URL('../src/'+f+'.js',import.meta.url),'utf8'),ctx); return ctx; }
export const root=new URL('../',import.meta.url);
export const json=x=>JSON.parse(JSON.stringify(x));
