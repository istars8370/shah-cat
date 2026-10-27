import { createPublicKey, verify } from 'node:crypto';

function fail(message,status=401){throw Object.assign(Error(message),{status});}

export function verifyDiscordRequest({publicKeyHex,signatureHex,timestamp,body}){
  if(typeof publicKeyHex!=='string'||!/^[0-9a-fA-F]{64}$/.test(publicKeyHex)) fail('Discord public key 설정 오류',503);
  if(typeof signatureHex!=='string'||!/^[0-9a-fA-F]{128}$/.test(signatureHex)) fail('Discord 요청 서명 오류');
  if(typeof timestamp!=='string'||!/^[0-9]{10,13}$/.test(timestamp)) fail('Discord 요청 시각 오류');
  if(!Buffer.isBuffer(body)) body=Buffer.from(body||'');
  const der=Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),Buffer.from(publicKeyHex,'hex')]);
  const key=createPublicKey({key:der,format:'der',type:'spki'});
  const message=Buffer.concat([Buffer.from(timestamp,'utf8'),body]);
  if(!verify(null,message,key,Buffer.from(signatureHex,'hex'))) fail('Discord 요청 서명 검증 실패');
  return true;
}
