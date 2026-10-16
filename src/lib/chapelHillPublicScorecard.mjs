// Public course source captured 2026-10-16. This is NOT an approved print master.
// Reference: https://www.chapelhillgolf.net/aboutus/scorecard/
// Preserve the source exactly, including totals that may not reconcile.
export const CHAPEL_HILL_PUBLIC_SCORECARD = Object.freeze({
  sourceUrl: 'https://www.chapelhillgolf.net/aboutus/scorecard/',
  capturedOn: '2026-10-16',
  course: 'Chapel Hill Golf Course, Reading PA',
  holeNumbers: Array.from({length:18},(_,i)=>i+1),
  tees: [
    {name:'Blue', rating:'69.7', slope:125, yards:[396,306,176,528,350,377,295,354,375,356,307,409,211,560,140,421,191,304], publishedOut:3157,publishedIn:2899,publishedTotal:6056},
    {name:'White',rating:'67.4',slope:121,yards:[357,289,161,444,339,365,282,318,362,347,292,314,185,506,128,406,142,295], publishedOut:2917,publishedIn:2615,publishedTotal:5532},
    {name:'Gold',rating:'64.3',slope:111,yards:[324,265,136,376,306,317,266,253,290,269,235,286,161,442,119,377,131,270], publishedOut:2533,publishedIn:2290,publishedTotal:4823},
    {name:'Red',rating:'65.5',slope:113,yards:[310,245,119,315,281,276,255,231,284,259,201,235,135,387,115,332,107,200], publishedOut:2316,publishedIn:1971,publishedTotal:4287}
  ],
  menHandicap:[9,12,14,16,2,6,18,8,4,10,5,3,7,11,15,1,13,17],
  ladiesHandicap:[9,12,14,16,2,6,18,8,4,10,5,3,7,11,15,1,13,17],
  // Source publishes split tee-dependent par on #4 and #16; verify with course.
  parLabels:['4','4','3','5/4','4','4','4','4','4','4','4','4','3','5','3','4/5','3','4'],
  publishedPar:'70/70',
});
