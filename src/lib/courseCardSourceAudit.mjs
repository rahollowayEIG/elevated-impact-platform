// Audits scorecard source claims before any printed or public output.
// Never overwrites sourced values with calculated guesses.
function sum(values) {return values.reduce((a,b)=>a+b,0);}
export function auditCourseCardSource(card) {
  if (!card || !Array.isArray(card.tees) || !card.sourceUrl || card.holeNumbers?.length !== 18)
    throw new Error('Invalid scorecard source');
  const findings=[];
  for(const tee of card.tees) {
    if (!tee.name || !Array.isArray(tee.yards) || tee.yards.length!==18 ||
      tee.yards.some(x=>!Number.isInteger(x)||x<=0)) throw new Error('Invalid tee row');
    const computedOut=sum(tee.yards.slice(0,9));
    const computedIn=sum(tee.yards.slice(9));
    const computedTotal=computedOut+computedIn;
    for (const [label,published,calculated] of [
      ['out',tee.publishedOut,computedOut],
      ['in',tee.publishedIn,computedIn],
      ['total',tee.publishedTotal,computedTotal]
    ]) {
      if(published!==calculated) findings.push({
        id:tee.name.toLowerCase()+'-'+label,
        type:'published_total_mismatch',
        tee:tee.name,
        field:label,
        published,
        calculated,
        difference:calculated-published,
        sourceUrl:card.sourceUrl,
        status:'needs_course_approval'
      });
    }
  }
  if(card.parLabels?.some(x=>String(x).includes('/'))) findings.push({
    id:'split-par-rules',type:'ambiguous_par_by_tee',sourceUrl:card.sourceUrl,
    message:'Source shows alternative pars on holes 4 and 16. Confirm tee-dependent par assignments before print.',
    status:'needs_course_approval'
  });
  return {course:card.course,sourceUrl:card.sourceUrl,sourceCapturedOn:card.capturedOn,
    tees:card.tees.map(t=>({name:t.name,publishedTotal:t.publishedTotal,calculatedTotal:sum(t.yards)})),
    findings,printApproved:false,needsCourseReview:true};
}
