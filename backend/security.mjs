import { createHmac,timingSafeEqual } from 'node:crypto';
export function validateTelegram(initData,botToken,now=Math.floor(Date.now()/1000)){
 if(typeof initData!=='string'||initData.length>16000)throw Error('Invalid initData');
 const p=new URLSearchParams(initData),hash=p.get('hash');if(!hash||!/^[a-f0-9]{64}$/i.test(hash)||new Set([...p.keys()]).size!==[...p.keys()].length)throw Error('Invalid signature');
 p.delete('hash');const check=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');
 const secret=createHmac('sha256','WebAppData').update(botToken).digest();const expected=createHmac('sha256',secret).update(check).digest();if(!timingSafeEqual(expected,Buffer.from(hash,'hex')))throw Error('Invalid signature');
 const date=Number(p.get('auth_date'));if(!Number.isInteger(date)||date>now+30||now-date>3600)throw Error('Expired initData');
 const user=JSON.parse(p.get('user')??'null');if(!user||!Number.isSafeInteger(user.id)||user.id<=0)throw Error('Invalid user');return {id:String(user.id),nickname:String(user.first_name??'Player').slice(0,60)};
}
export function token(user,secret,now=Math.floor(Date.now()/1000)){const body=Buffer.from(JSON.stringify({...user,exp:now+3600})).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');}
export function verifyToken(value,secret,now=Math.floor(Date.now()/1000)){
 if(typeof value!=='string'||value.length>2000)throw Error('Unauthorized');const parts=value.split('.');if(parts.length!==2)throw Error('Unauthorized');const [body,signature]=parts,expected=createHmac('sha256',secret).update(body).digest();const supplied=Buffer.from(signature,'base64url');if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw Error('Unauthorized');const user=JSON.parse(Buffer.from(body,'base64url').toString());if(!user.exp||user.exp<=now||!/^\d+$/.test(user.id))throw Error('Expired token');return user;
}
