import fs from 'node:fs';
import assert from 'node:assert/strict';
const platform = fs.readFileSync('src/PlatformApp.jsx','utf8');
const airport = fs.readFileSync('src/ElevationAirport.jsx','utf8');
assert.match(platform,/const IS_SANDBOX = import\.meta\.env\.VITE_ELEVATIONPILOT_SANDBOX === 'true'/);
assert.match(platform,/href=\{IS_SANDBOX \? undefined :/);
assert.match(platform,/IS_SANDBOX \? window\.location\.origin :/);
assert.match(airport,/app_origin: import\.meta\.env\.VITE_ELEVATIONPILOT_SANDBOX === 'true' \? window\.location\.origin :/);
console.log('Sandbox routing guards present. This is a source-level smoke test, not proof of full route isolation.');
