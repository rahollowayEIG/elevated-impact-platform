/**
 * New first-party source files are explicitly registered to an App Stack
 * application before merging. Registration is a development ownership record,
 * NOT authorization for the production scanner to open the file.
 *
 * A CI coverage check compares newly added src/, server/ and api/ code files
 * with this inventory. The reviewer must choose which scanner will inspect it
 * and define tests before changing the fixed production scanner allowlist.
 *
 * Existing source files predating this gate are inventoried separately.
 */
export const APP_NEW_SOURCE_OWNERS=Object.freeze([
 {
  path:'src/lib/buildLabSourceOwners.mjs',
  appId:'build-lab',
  component:'build-lab',
  scannerStatus:'review_pending',
  reason:'Coverage enrollment registry and CI guard; production source scope unchanged.'
 }
]);
