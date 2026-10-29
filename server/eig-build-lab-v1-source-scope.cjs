'use strict';
// Release-only source scope: no preview AI, invoice, commerce or unfinished pilots.
// This is a scope contract, not a replacement for full scanner integration.
const fs=require('node:fs');
const path=require('node:path');
const {FILE_PATHS,MODULES}=require('./eig-master-source-scan.cjs');

const EXCLUDED_MODULES=Object.freeze(['invoices','product-registry','contracts','pos-tax']);
const RELEASE_MODULES=Object.freeze(MODULES.filter(m=>!EXCLUDED_MODULES.includes(m.id)).map(m=>
  m.id==='build-lab' ? Object.freeze({...m,
    source:[['src/components/BuildLabLiveOwnerWorkspace.jsx','function BuildLabLiveOwnerWorkspace']],
    ui:[['src/PlatformApp.jsx','<BuildLabLiveOwnerWorkspace']],
    tests:[['tests/eig-build-lab-live-client.test.mjs','production owner workspace excludes preview-only development capabilities','test']]
  }) : m
));
const RELEASE_PATHS=Object.freeze(FILE_PATHS.filter(p=>
  !p.includes('EpInvoicePilot') && !p.includes('epInvoiceDraft') &&
  !p.includes('epProductCapture') && !p.includes('EpProductCapture') &&
  !p.includes('EpDiscoveryPilot') && !p.includes('epCommerceContractReadiness') &&
  !p.includes('ep-invoice-draft') && !p.includes('ep-product-capture') &&
  !p.includes('ep-commerce-contract-readiness') &&
  p!=='src/components/EigBuildLab.jsx' && p!=='tests/eig-build-lab-browser.cjs'
));
function validateReleaseSourceScope() {
  const moduleIds=new Set(RELEASE_MODULES.map(m=>m.id));
  if(moduleIds.size!==RELEASE_MODULES.length)throw new Error('Duplicate release modules');
  for(const id of EXCLUDED_MODULES)if(moduleIds.has(id))throw new Error('Excluded module enabled: '+id);
  if(!moduleIds.has('build-lab'))throw new Error('Build Lab module not retained');
  const missing=RELEASE_PATHS.filter(p=>!fs.existsSync(path.resolve(__dirname,'..',p)));
  const unscoped=[];
  for(const m of RELEASE_MODULES)for(const [p] of [...(m.source||[]),...(m.ui||[]),...(m.tests||[])])
    if(!RELEASE_PATHS.includes(p))unscoped.push({module:m.id,path:p});
  return {modules:RELEASE_MODULES.map(x=>x.id),paths:RELEASE_PATHS,missing,unscoped};
}

function scanReleaseV1(sourceVersion='local-unversioned') {
  const {readAllowlistedMasterSource,scanMasterSource}=require('./eig-master-source-scan.cjs');
  const state=validateReleaseSourceScope();
  if(state.missing.length||state.unscoped.length)
    throw new Error('V1 scanner source scope needs reviewed reconciliation: '+[...state.missing,...state.unscoped.map(x=>x.module+':'+x.path)].join(', '));
  return scanMasterSource(readAllowlistedMasterSource(RELEASE_PATHS),sourceVersion,new Date().toISOString(),null,'compare',{paths:RELEASE_PATHS,modules:RELEASE_MODULES});
}
module.exports={EXCLUDED_MODULES,RELEASE_MODULES,RELEASE_PATHS,validateReleaseSourceScope,scanReleaseV1};
