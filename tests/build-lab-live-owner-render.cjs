const assert=require('node:assert/strict');
(async()=>{
 const {createServer}=await import('vite');
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});
 try{
  const React=require('react');
  const {renderToStaticMarkup}=require('react-dom/server');
  const {default:LiveOwner}=await server.ssrLoadModule('/src/components/BuildLabLiveOwnerWorkspace.jsx');
  const html=renderToStaticMarkup(React.createElement(LiveOwner,{
   ownerUserId:'11111111-1111-4111-8111-111111111111',supabaseClient:null,onBack:()=>{}
  }));
  assert.match(html,/Owner Console: Read-only Scanning/);
  assert.match(html,/Run Master Scanner \(read-only\)/);
  assert.match(html,/Run IA Inspector \(read-only\)/);
  assert.match(html,/No AI generation, automatic fixes/);
  assert.match(html,/Back to Command Center/);
  assert.match(html,/1\. Scan/);
  assert.match(html,/2\. History/);
  assert.match(html,/3\. Work Buckets/);
  assert.match(html,/4\. Review &amp; Fix Plan/);
  assert.match(html,/Build Lab V1 owner workflow/);
  assert.doesNotMatch(html,/Bob the Builder|Mr\. Fixit|Agent execution|Issue Invoice|Send payment/);
  assert.match(html,/Permanent records/);
  console.log('Live owner console rendering passed: limited tools, separate owner workspace, storage feature gate.');
 }finally{await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
