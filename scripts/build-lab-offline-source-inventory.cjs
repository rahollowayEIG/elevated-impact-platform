/**
 * Offline, read-only, bounded inventory of first-party source imports.
 * This module does not run as an API endpoint and never follows symlinks.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ROOT_DIRS=Object.freeze(['src','api','server']);
const ROOT_FILES=Object.freeze(['App.jsx','LegacyApp.jsx','main.jsx','vite.config.js']);
const EXTENSIONS=Object.freeze(['','.js','.jsx','.mjs','.cjs','.ts','.tsx','.json']);
const LIMITS=Object.freeze({maxFiles:2500,maxFileBytes:1000000,maxTotalBytes:30000000});
const sourcePattern=/\.(?:jsx?|mjs|cjs|tsx?)$/i;

function inventorySourceTree(root,options={}) {
 const base=fs.realpathSync(root),dirs=options.dirs||ROOT_DIRS,files=options.files||ROOT_FILES;
 const all=new Map(),ignored=[];
 let bytes=0;
 function load(relative){
  const full=path.resolve(base,relative);
  if(full!==base&&!full.startsWith(base+path.sep))throw Error('Inventory path escapes root');
  const stat=fs.lstatSync(full);
  if(stat.isSymbolicLink()){ignored.push({path:relative,reason:'symlink'});return;}
  if(!stat.isFile())return;
  if(stat.size>LIMITS.maxFileBytes){ignored.push({path:relative,reason:'file-too-large'});return;}
  if((bytes+=stat.size)>LIMITS.maxTotalBytes)throw Error('Source inventory byte cap exceeded');
  if(all.size>=LIMITS.maxFiles)throw Error('Source inventory file cap exceeded');
  all.set(relative.split(path.sep).join('/'),fs.readFileSync(full,'utf8'));
 }
 function descend(relative){
  const full=path.resolve(base,relative);
  if(full!==base&&!full.startsWith(base+path.sep))throw Error('Inventory path escapes root');
  if(!fs.existsSync(full))return;
  const stat=fs.lstatSync(full);
  if(stat.isSymbolicLink()){ignored.push({path:relative,reason:'symlink-directory'});return;}
  if(!stat.isDirectory())return;
  for(const entry of fs.readdirSync(full,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
   if(entry.name.startsWith('.')||entry.name==='node_modules'||entry.name==='dist')continue;
   const child=path.join(relative,entry.name);
   if(entry.isSymbolicLink()){ignored.push({path:child,reason:'symlink'});continue;}
   if(entry.isDirectory())descend(child);
   else if(entry.isFile()&&sourcePattern.test(entry.name))load(child);
  }
 }
 for(const dir of dirs)descend(dir);
 for(const file of files)if(fs.existsSync(path.join(base,file)))load(file);
 const names=new Set(all.keys()),unresolved=[],edges=[],externalCount={};
 for(const [file,text] of all) {
  // Only literal imports and re-exports are inspected. Dynamic template imports are not evaluated.
  const literal=/(?:\bimport\s*(?:[^'";]*?\s+from\s*)?|\bexport\s+[^'";]*?\s+from\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g;
  let match;
  while((match=literal.exec(text))) {
   const spec=match[1],line=text.slice(0,match.index).split('\n').length;
   if(!spec.startsWith('.')){externalCount[spec]=(externalCount[spec]||0)+1;continue;}
   const baseTarget=path.posix.normalize(path.posix.join(path.posix.dirname(file),spec));
   if(baseTarget.startsWith('../')||baseTarget==='..'){
    unresolved.push({file,line,specifier:spec,reason:'outside-allowed-tree'});continue;
   }
   const candidates=EXTENSIONS.map(ext=>baseTarget+ext).concat(
    EXTENSIONS.filter(Boolean).map(ext=>baseTarget+'/index'+ext));
   const exists=candidates.some(name=>{
    if(names.has(name))return true;
    const full=path.resolve(base,name);
    return full.startsWith(base+path.sep)&&fs.existsSync(full)&&fs.lstatSync(full).isFile();
   });
   edges.push({file,line,specifier:spec,resolved:exists});
   if(!exists)unresolved.push({file,line,specifier:spec,reason:'relative-import-not-found'});
  }
 }
 const sha=crypto.createHash('sha256');
 for(const [file,text] of [...all].sort((a,b)=>a[0].localeCompare(b[0]))){sha.update(file);sha.update(text);}
 return {kind:'eig_build_lab_offline_source_inventory',schemaVersion:1,readOnly:true,
  scannedDirectories:[...dirs],sourceFileCount:all.size,totalSourceCharacters:[...all.values()].reduce((a,t)=>a+t.length,0),
  literalRelativeImports:edges.length,unresolved:unresolved.slice(0,500),
  unresolvedCount:unresolved.length,externalImportSpecifierCount:Object.keys(externalCount).length,
  ignored:ignored.slice(0,200),sourceFingerprint:sha.digest('hex'),
  limitations:['Offline static literal imports only; ignores computed imports, aliases, package exports, bundler plugins, and generated files.',
   'An unresolved import is a review candidate, not proof that a deployed feature is broken.',
   'This report does not query Supabase, inspect deployments, change source files, or perform cleanup.'],
  safety:{readOnly:true,deletedItems:0,autoDeleted:false,autoDeployed:false}};
}
module.exports={inventorySourceTree,ROOT_DIRS,ROOT_FILES};
if(require.main===module) {
 const root=path.resolve(__dirname,'..');
 console.log(JSON.stringify(inventorySourceTree(root),null,2));
}
