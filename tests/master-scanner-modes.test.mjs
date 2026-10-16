import test from 'node:test';import assert from 'node:assert/strict';
import {scanCourseResearch,scanPhotoAssets,scanPrinterQuotes,scanScannerHealth} from '../src/lib/masterScannerModes.mjs';
test('research finds source conflicts and missing claims',()=>{
 const r=scanCourseResearch([{url:'https://a.example/a',claims:[{key:'course_name',value:'Chapel Hill'},{key:'hole_count',value:'18'}]},{url:'https://b.example/b',claims:[{key:'hole_count',value:'9'}]}]);
 assert.ok(r.findings.some(x=>x.id==='conflict-hole_count'));assert.ok(r.findings.some(x=>x.id==='missing-yardages'));
});
test('photos flag rights and insufficient source resolution',()=>{
 const r=scanPhotoAssets([{id:'hole1',width:800,height:700,rightsApproved:false,source:'https://example.com/photo'}]);
 assert.equal(r.findings.length,2);
});
test('printer comparisons normalize landed cost and prohibit misleading scope comparison',()=>{
 const r=scanPrinterQuotes([{id:'a',vendor:'A',minQty:100,unitPrice:.2,setup:10,shipping:20,tax:0,specification:'folded',verified:true},{id:'b',vendor:'B',minQty:100,unitPrice:.1,setup:50,shipping:40,tax:10,specification:'flat',verified:false}],20000);
 assert.equal(r.quotes[0].landed,2100);assert.ok(r.findings.some(x=>x.id==='noncomparable-quotes'));
});
test('self scanner flags missing test/security evidence',()=>{
 const r=scanScannerHealth([{id:'photo',owner:'EIG',testsPassed:false,evidenceValidation:false,permissionBoundary:false,writesWithoutApproval:true}]);
 assert.equal(r.findings.length,4);
});
test('malformed inputs rejected',()=>{
 assert.throws(()=>scanCourseResearch([{url:'file:///etc/passwd',claims:[]}]),/Invalid/);
 assert.throws(()=>scanPrinterQuotes([{id:'bad',vendor:'X',minQty:1,unitPrice:-1,setup:0,shipping:0,tax:0}],1),/Invalid/);
});
