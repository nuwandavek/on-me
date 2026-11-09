// Zips extension/ into dist/on-me-<version>.zip for upload to the Chrome Web Store.
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,rmSync} from 'node:fs';

const {version} = JSON.parse(readFileSync(new URL('../extension/manifest.json',import.meta.url),'utf8'));
const out = new URL(`../dist/on-me-${version}.zip`,import.meta.url).pathname;
mkdirSync(new URL('../dist/',import.meta.url),{recursive:true});
rmSync(out,{force:true});
execFileSync('zip',['-r','-X','-q',out,'.','-x','*.DS_Store'],{cwd:new URL('../extension/',import.meta.url).pathname,stdio:'inherit'});
console.log(`Wrote ${out}`);
