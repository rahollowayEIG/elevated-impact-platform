const assert=require('node:assert/strict');
(async()=>{
 const {createServer}=await import('vite');
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});
 try {
  const React=require('react');
  const {renderToStaticMarkup}=require('react-dom/server');
  const {default:Manager}=await server.ssrLoadModule('/src/components/BuildLabManager.jsx');
  const helpers=await server.ssrLoadModule('/src/lib/buildLabMissionOrchestrator.mjs');
  const uid='11111111-1111-4111-8111-111111111111';
  const map=new Map();global.localStorage={getItem:key=>map.get(key)||null};
  let plan=helpers.stackScanBlueprint([{id:'render-test',type:'ai',scope:'invoices',source:'abc',savedAt:'2026-10-21T20:00:00Z',snapshot:{review:{recommendations:[{id:'fix',title:'Repair invoice preview',nextAction:'Reproduce and repair the preview',evidenceFiles:['src/Invoice.jsx']}]}}}]);
  plan=helpers.reviewManagerProposal(plan,'proposal-1','accept');plan=helpers.approveManagerBlueprint(plan);
  map.set(helpers.managerStorageKey(uid),JSON.stringify(plan));
  const markup=renderToStaticMarkup(React.createElement(Manager,{ownerUserId:uid}));
  assert.match(markup,/Ready for handoff/);assert.match(markup,/Agent execution not connected/);assert.match(markup,/Mr. Fixit/);assert.match(markup,/proposal-1-verify/);assert.match(markup,/proposal-1-inspect/);assert.match(markup,/3 of 3 proposed tasks shown/);
  const empty=renderToStaticMarkup(React.createElement(Manager,{ownerUserId:'22222222-2222-4222-8222-222222222222'}));
  assert.doesNotMatch(empty,/Ready for handoff/);assert.doesNotMatch(empty,/Repair invoice preview/);
  map.set(helpers.managerStorageKey(uid),'corrupt');
  const corrupt=renderToStaticMarkup(React.createElement(Manager,{ownerUserId:uid}));assert.match(corrupt,/Existing browser data has been preserved/);
  console.log('Manager rendering passed: saved review, proposed task graph, account separation and corrupt-state handling.');
 }finally{await server.close();delete global.localStorage;}
})().catch(e=>{console.error(e);process.exitCode=1;});
