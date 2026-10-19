import test from 'node:test';
import assert from 'node:assert/strict';
import {createCipheriv, generateKeyPairSync, randomBytes, sign} from 'node:crypto';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const callback = require('../api/sandbox-sso/callback.js');
const {unsealState, equalState, validateIdToken, findStateCookie} = callback.__test;
const origin = 'https://elevationpilot-sandbox.vercel.app';
const config = {
  issuer: 'https://aszixzrdayrivungodwq.supabase.co/auth/v1',
  clientId: '00000000-0000-4000-8000-000000000044',
  origin,
};
const nonce = randomBytes(32).toString('base64url');
const stateValue = randomBytes(32).toString('base64url');
const verifier = randomBytes(32).toString('base64url');

function protect(data, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encoded = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encoded]).toString('base64url');
}

test('sandbox OAuth state rejects tampering, stale state and incorrect origin', () => {
  const key = randomBytes(32);
  const now = Date.now();
  const original = {state:stateValue, nonce, verifier, origin, createdAt:now - 1000};
  const token = protect(original, key);
  assert.deepEqual(unsealState(token, key, now), original);
  assert.equal(unsealState(token.slice(0, -2)+'AA',key,now), null);
  assert.equal(unsealState(token,randomBytes(32),now),null);
  assert.equal(unsealState(protect({...original,createdAt:now-3600000},key),key,now),null);
  assert.equal(unsealState(protect({...original,origin:'https://example.invalid'},key),key,now),null);
  assert.equal(equalState(stateValue, stateValue),true);
  assert.equal(equalState(randomBytes(32).toString('base64url'),stateValue),false);
  assert.equal(findStateCookie('__Host-eig_sandbox_oauth='+token),token);
  assert.equal(findStateCookie('__Host-eig_sandbox_oauth='+token+'; __Host-eig_sandbox_oauth='+token),null);
});

function fixtureJWT(changes={}, headerChanges={}) {
  const {privateKey, publicKey} = generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const jwk=publicKey.export({format:'jwk'});
  Object.assign(jwk,{kid:'fixture',alg:'ES256',use:'sig'});
  const now=Math.floor(Date.now()/1000);
  const base={
    iss:config.issuer, aud:config.clientId,
    nonce, sub:'00000000-0000-4000-8000-000000000055',
    email:'tester@example.invalid', email_verified:true,
    exp:now+200, iat:now,
  };
  const header=Buffer.from(JSON.stringify({typ:'JWT',kid:'fixture',alg:'ES256',...headerChanges})).toString('base64url');
  const body=Buffer.from(JSON.stringify({...base,...changes})).toString('base64url');
  const message=header+'.'+body;
  const sig=sign('sha256',Buffer.from(message),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  return {token:message+'.'+sig, jwk};
}

test('accepts verified ECDSA identity but never raw production token',()=>{
  const {token,jwk}=fixtureJWT();
  const result=validateIdToken(token,[jwk],config,nonce);
  assert.deepEqual(result,{id:'00000000-0000-4000-8000-000000000055',email:'tester@example.invalid'});
  assert.equal(Object.hasOwn(result,'token'),false);
});
test('refuses forged or mismatched provider identity',()=>{
  const {token,jwk}=fixtureJWT();
  const tampered=token.split('.');
  tampered[1]=Buffer.from('{"email":"attacker@example.invalid"}').toString('base64url');
  assert.equal(validateIdToken(tampered.join('.'),[jwk],config,nonce),null);
  for(const [data,header] of [
    [{aud:'different-client'},{}],
    [{iss:'https://fake.invalid'},{}],
    [{nonce:'wrong'},{}],
    [{email_verified:false},{}],
    [{exp:1},{}],
    [{iat:1},{}],
    [{sub:'not-a-uuid'},{}],
    [{email:'invalid'},{}],
    [{}, {alg:'none'}],
  ]) {
    const altered=fixtureJWT(data,header);
    assert.equal(validateIdToken(altered.token,[altered.jwk],config,nonce),null);
  }
  assert.equal(validateIdToken(token,[],config,nonce),null);
});

test('disabled callback never authenticates a user', async()=>{
  const response={
    headers:{}, statusCode:null,
    setHeader(name,value){this.headers[name]=value},
    status(code){this.statusCode=code;return this},
    end(){return this},
  };
  const original=process.env.SANDBOX_SHARED_LOGIN_BACKEND_READY;
  delete process.env.SANDBOX_SHARED_LOGIN_BACKEND_READY;
  try{
    await callback({method:'GET',headers:{host:'elevationpilot-sandbox.vercel.app'},query:{}},response);
    assert.equal(response.statusCode,503);
    assert.match(response.headers['Set-Cookie'],/Max-Age=0/);
    assert.equal(response.headers.Location,undefined);
  } finally {
    if(original===undefined) delete process.env.SANDBOX_SHARED_LOGIN_BACKEND_READY;
    else process.env.SANDBOX_SHARED_LOGIN_BACKEND_READY=original;
  }
});
