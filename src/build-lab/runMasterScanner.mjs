import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { scanSourceFiles, draftBuildPlan } from './masterScanner.mjs';
const root=process.cwd();
const allowed=['src','supabase','tests','api','sandbox'];
const files=[];
async function walk(dir) {
 let entries=[]; try { entries=await readdir(join(root,dir),{withFileTypes:true}); } catch(e) { if(e.code==='ENOENT') return; throw e; }
 for(const entry of entries) {
   const path=join(dir,entry.name);
   if(entry.isDirectory()) { if(!['node_modules','dist','.git','.vercel'].includes(entry.name)) await walk(path); }
   else if(/\.(?:jsx?|tsx?|mjs|cjs|sql)$/.test(entry.name)) {
     const content=await readFile(join(root,path),'utf8');
     files.push({path:relative(root,join(root,path)).replaceAll('\\','/'),content});
   }
 }
}
for(const dir of allowed) await walk(dir);
const report=scanSourceFiles(files);
const request=process.argv.slice(2).join(' ')||'EIG Invoicing';
const plan=draftBuildPlan(report,request);
await mkdir(join(root,'build-lab-output'),{recursive:true});
await writeFile(join(root,'build-lab-output','scan-report.json'),JSON.stringify(report,null,2));
await writeFile(join(root,'build-lab-output','build-plan.json'),JSON.stringify(plan,null,2));
console.log('Build Lab scanned '+report.filesScanned+' source files; '+report.findings.length+' review findings; plan: '+plan.request);
