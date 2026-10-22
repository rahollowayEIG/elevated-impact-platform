// Two separate CI jobs: validate with signing secret; test without secrets.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {openCandidate,verifySources,sha}=require('../server/build-lab-builder-contract.cjs');
const {FILE_PATHS,scanInceptionSource}=require('../server/eig-inception-source-scan.cjs');
function readSources(root){return Object.fromEntries(FILE_PATHS.map(p=>{
 const full=path.join(root,p);
 if(!fs.lstatSync(full).isFile()||fs.lstatSync(full).isSymbolicLink()||fs.realpathSync(full)!==path.resolve(full))throw Error('Regular source files required.');
 return [p,fs.readFileSync(full,'utf8')];
}));}
function applyCandidate(candidate,root,version){
 const before=readSources(root),after=verifySources(candidate,before,version);
 for(const p of FILE_PATHS)if(after[p]!==before[p])fs.writeFileSync(path.join(root,p),after[p]);
 return {before:scanInceptionSource(before,version),after:scanInceptionSource(after,version)};
}
function main(){
 const mode=process.argv[2];
 if(mode==='validate'){
  const raw=process.env.BUILDER_CANDIDATE||'';
  if(Buffer.byteLength(raw)>60000)throw Error('Candidate too large.');
  const candidate=openCandidate(JSON.parse(raw),process.env.BUILDER_SIGNING_KEY);
  fs.mkdirSync('builder-validated',{recursive:true});
  fs.writeFileSync('builder-validated/candidate.json',JSON.stringify(candidate));
  fs.appendFileSync(process.env.GITHUB_OUTPUT,'source_version='+candidate.sourceVersion+'\n');
  return;
 }
 const candidate=JSON.parse(fs.readFileSync('builder-validated/candidate.json','utf8'));
 const version=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 fs.mkdirSync('test-results/build-lab-builder',{recursive:true});
 if(mode==='apply'){
  const scans=applyCandidate(candidate,process.cwd(),version);
  fs.writeFileSync('test-results/build-lab-builder/source-comparison.json',JSON.stringify({
   sourceVersion:version,findingId:candidate.findingId,before:scans.before,after:scans.after,
   generatedSourceHashes:Object.fromEntries(candidate.edits.map(e=>[e.path,sha(fs.readFileSync(e.path,'utf8'))])),
   runtimeVerified:false,note:'Source inspection is separate from executed test results.',
  },null,2));
  const patch=execFileSync('git',['diff','--',...FILE_PATHS],{encoding:'utf8'});
  fs.writeFileSync('test-results/build-lab-builder/candidate.patch',patch);
  return;
 }
 if(mode==='report'){
  const status=process.env.BUILDER_TEST_STATUS;
  const comparison=JSON.parse(fs.readFileSync('test-results/build-lab-builder/source-comparison.json','utf8'));
  const after=scanInceptionSource(readSources(process.cwd()),version);
  const currentHashes=Object.entries(comparison.generatedSourceHashes).every(([p,h])=>sha(fs.readFileSync(p,'utf8'))===h);
  const runtimePassed=status==='success'&&currentHashes;
  const selectedStillPresent=after.findings.some(f=>f.id===candidate.findingId);
  const outcome=runtimePassed?'tests_passed_owner_review_required':'verification_failed';
  fs.writeFileSync('test-results/build-lab-builder/result.json',JSON.stringify({
   status:outcome,sourceVersion:version,findingId:candidate.findingId,summary:candidate.summary,
   testsPassed:runtimePassed,selectedFindingStillPresent:selectedStillPresent,
   browserResults:Object.fromEntries(['chromium','firefox','webkit'].map(name=>[name,process.env['BUILDER_'+name.toUpperCase()+'_RESULT']||'not_run'])),actualSafariTested:false,realDevicesTested:false,
   autoMerged:false,autoDeployed:false,runId:process.env.GITHUB_RUN_ID||null,
   note:'Passing fixed regressions does not establish the requested behavior is fixed. Review the patch, screenshots and acceptance criteria before applying it. Marker-based findings may remain after a valid improvement.',
  },null,2));
  if(!runtimePassed)process.exitCode=1;
  return;
 }
 throw Error('Unknown worker stage.');
}
if(require.main===module){try{main();}catch{console.error('Builder worker refused the candidate or could not complete verification.');process.exitCode=1;}}
module.exports={readSources,applyCandidate};
