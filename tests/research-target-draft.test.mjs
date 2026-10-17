import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareResearchTarget} from '../src/lib/researchTargetDraft.mjs';
const core={kind:'website',focus:'full',compareTo:'event_builder'};
test('website draft is read-only and performs no external scan',()=>{
 const x=prepareResearchTarget({...core,target:'https://example.com'});
 assert.equal(x.readOnly,true);assert.equal(x.automaticCrawl,false);assert.equal(x.status,'draft_requires_review');
});
test('blocks local and credentialed URLs',()=>{
 for(const target of ['http://example.com','https://localhost','https://127.0.0.1','https://username:password@example.com','https://admin.internal']){
  assert.throws(()=>prepareResearchTarget({...core,target}));
 }
});
test('GitHub target must have github.com host',()=>{
 assert.throws(()=>prepareResearchTarget({...core,kind:'github',target:'https://example.com/repo'}));
 assert.equal(prepareResearchTarget({...core,kind:'github',target:'https://github.com/owner/repo'}).sourceType,'github');
});
test('mobile application names allowed as research drafts',()=>{
 assert.equal(prepareResearchTarget({...core,kind:'mobile_app',target:'Sample event app'}).target,'Sample event app');
});
