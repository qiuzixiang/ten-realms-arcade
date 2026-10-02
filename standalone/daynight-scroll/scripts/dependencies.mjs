import {createRequire} from 'node:module';
export function dependency(name){try{return createRequire(import.meta.url)(name);}catch(e){if(!process.env.CODEX_NODE_MODULES)throw Error('Run npm install, or set CODEX_NODE_MODULES to the available runtime node_modules directory. Missing '+name);return createRequire(process.env.CODEX_NODE_MODULES+'/package.json')(name);}}
