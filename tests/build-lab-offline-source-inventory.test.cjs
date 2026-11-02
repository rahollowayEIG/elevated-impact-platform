'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {inventorySourceTree}=require('../scripts/build-lab-offline-source-inventory.cjs');
function fixture(run){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'eig-inventory-'));
 try{fs.mkdirSync(path.join(root,'src'),{recursive:true});return run(root);}
 finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('read-only source inventory resolves literal imports and flags missing sources',()=>fixture(root=>{
 fs.writeFileSync(path.join(root,'src','a.js'),"import './b.js';\nimport './missing';\n");
 fs.writeFileSync(path.join(root,'src','b.js'),'export const b = true;\n');
 const old=fs.readFileSync(path.join(root,'src','a.js'),'utf8');
 const result=inventorySourceTree(root,{dirs:['src'],files:[]});
 assert.equal(result.sourceFileCount,2);
 assert.equal(result.literalRelativeImports,2);
 assert.equal(result.unresolvedCount,1);
 assert.deepEqual(result.unresolved.map(x=>x.specifier),['./missing']);
 assert.equal(result.safety.autoDeleted,false);
 assert.equal(result.readOnly,true);
 assert.equal(fs.readFileSync(path.join(root,'src','a.js'),'utf8'),old);
}));
test('does not follow symlinked files out of the approved source tree',()=>fixture(root=>{
 const outside=path.join(root,'private.txt');
 fs.writeFileSync(outside,'private');
 fs.symlinkSync(outside,path.join(root,'src','linked.js'));
 const result=inventorySourceTree(root,{dirs:['src'],files:[]});
 assert.equal(result.sourceFileCount,0);
 assert.ok(result.ignored.some(x=>x.reason==='symlink'));
 assert.ok(!JSON.stringify(result).includes('private'));
}));
test('reports a relative import escaping inventory directories without reading it',()=>fixture(root=>{
 fs.writeFileSync(path.join(root,'src','a.js'),"import '../../private.js';\n");
 const result=inventorySourceTree(root,{dirs:['src'],files:[]});
 assert.equal(result.unresolvedCount,1);
 assert.equal(result.unresolved[0].reason,'outside-allowed-tree');
}));
test('all actual platform source reports stay read-only',()=>{
 const result=inventorySourceTree(path.resolve(__dirname,'..'));
 assert.ok(result.sourceFileCount>0);
 assert.equal(result.safety.deletedItems,0);
 assert.equal(result.safety.autoDeployed,false);
 assert.ok(result.sourceFingerprint.length===64);
});
