import React from 'react';
export default function BuildLabScanDestination({onViewBuckets}){
 return <div className="bl-scan-destination"><p>Findings collect automatically in <strong>Work Buckets</strong>. Review, revise or hold work there.</p>{onViewBuckets&&<button type="button" className="platform-primary-button" onClick={onViewBuckets}>View Work Buckets →</button>}</div>;
}

export function BuildLabReportBackup({legacyReview=false,children}){
 return legacyReview?<>{children}</>:<details className="bl-report-backup"><summary>Report backup</summary>{children}</details>;
}
