import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAPEL_HILL_PUBLIC_SCORECARD} from '../src/lib/chapelHillPublicScorecard.mjs';
import {auditCourseCardSource} from '../src/lib/courseCardSourceAudit.mjs';
test('official published page is flagged for mismatched total yardage rather than silently fixed',()=>{
 const report=auditCourseCardSource(CHAPEL_HILL_PUBLIC_SCORECARD);
 assert.equal(report.printApproved,false);
 assert.equal(report.needsCourseReview,true);
 assert.ok(report.findings.some(f=>f.type==='published_total_mismatch'));
 assert.ok(report.findings.some(f=>f.id==='split-par-rules'));
});
test('reject incomplete source instead of inventing holes',()=>{
 assert.throws(()=>auditCourseCardSource({...CHAPEL_HILL_PUBLIC_SCORECARD,holeNumbers:[1]}),/Invalid scorecard source/);
});
test('audit preserves direct source and published row totals',()=>{
 const report=auditCourseCardSource(CHAPEL_HILL_PUBLIC_SCORECARD);
 assert.equal(report.sourceUrl,'https://www.chapelhillgolf.net/aboutus/scorecard/');
 assert.equal(report.tees.find(x=>x.name==='Blue').publishedTotal,6056);
 assert.equal(report.tees.find(x=>x.name==='Blue').calculatedTotal,6117);
});
