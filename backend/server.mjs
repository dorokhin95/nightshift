import { createServer } from 'node:http';
import { randomBytes,createHash } from 'node:crypto';
import { replay } from '../dist/game/core/Replay.js';
import { validateTelegram,token,verifyToken } from './security.mjs';
const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,TELEGRAM_BOT_TOKEN,AUTH_SECRET,ALLOWED_ORIGIN}=process.env;
if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!TELEGRAM_BOT_TOKEN||!AUTH_SECRET||AUTH_SECRET.length<32||!ALLOWED_ORIGIN)throw Error('Configure backend environment; see backend/.env.example');
async function db(path,body,method='POST'){
 const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{method,headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Database request failed');const data=await r.text();return data?JSON.parse(data):null;
}
async function limited(key,limit){if(!await db('rpc/consume_rate',{p_key:key,p_limit:limit}))throw Object.assign(Error('Too many requests'),{status:429});}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>65536)throw Object.assign(Error('Body too large'),{status:413});}try{return JSON.parse(raw);}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}}
createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Origin');
 if(req.headers.origin&&req.headers.origin!==ALLOWED_ORIGIN){res.writeHead(403);res.end(JSON.stringify({error:'Origin rejected'}));return;}
 res.setHeader('Access-Control-Allow-Origin',ALLOWED_ORIGIN);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 try{
  const url=new URL(req.url,'http://localhost');let result;
  const ip=createHash('sha256').update(req.socket.remoteAddress??'unknown').digest('hex');await limited('ip:'+ip,120);
  if(url.pathname==='/health'&&req.method==='GET')result={ok:true,rules:'mvp2-v1'};
  else if(url.pathname==='/auth'&&req.method==='POST'){
   let user;try{user=validateTelegram((await body(req)).initData,TELEGRAM_BOT_TOKEN);}catch{throw Object.assign(Error('Telegram authorization failed'),{status:401});}
   await limited('auth:'+user.id,10);await db('profiles',{telegram_id:user.id,nickname:user.nickname});result={token:token(user,AUTH_SECRET),nickname:user.nickname};
  }else if(url.pathname==='/leaderboard'&&req.method==='GET'){
   let user=null;try{user=verifyToken(req.headers.authorization?.replace(/^Bearer /,''),AUTH_SECRET);}catch{/* Public top 100. */}
   const period=url.searchParams.get('period')??'day';if(!['day','week','season'].includes(period))throw Object.assign(Error('Invalid period'),{status:400});result=await db('rpc/read_leaderboard',{p_period:period,p_user:user?.id??null});
  }else{
   let user;try{user=verifyToken(req.headers.authorization?.replace(/^Bearer /,''),AUTH_SECRET);}catch{throw Object.assign(Error('Unauthorized'),{status:401});}await limited('user:'+user.id,30);
   if(url.pathname==='/session'&&req.method==='POST'){
    await limited('start:'+user.id,3);const day=new Date().toISOString().slice(0,10),seed=randomBytes(4).readUInt32LE();result=await db('rpc/start_ranked',{p_user:user.id,p_day:day,p_seed:seed});
   }else if(url.pathname==='/submit'&&req.method==='POST'){
    const input=await body(req);if(typeof input.sessionId!=='string'||!/^[0-9a-f-]{36}$/i.test(input.sessionId)||!Array.isArray(input.moves)||input.moves.length!==50||!Number.isSafeInteger(input.score)||input.score<0)throw Object.assign(Error('Invalid submission'),{status:400});
    const sessions=await db('ranked_sessions?id=eq.'+encodeURIComponent(input.sessionId)+'&telegram_id=eq.'+user.id,undefined,'GET');const session=sessions?.[0];if(session?.verified&&session.score===input.score&&JSON.stringify(session.moves)===JSON.stringify(input.moves)){res.end(JSON.stringify({verified:true,score:session.score}));return;}if(!session||session.verified||Date.parse(session.expires_at)<Date.now()||session.rules_version!=='mvp2-v1')throw Object.assign(Error('Session unavailable'),{status:409});
    let computed;try{computed=replay(Number(session.seed),input.moves,undefined,50);}catch{throw Object.assign(Error('Invalid replay'),{status:400});}if(computed.score!==input.score)throw Object.assign(Error('Score mismatch'),{status:400});
    result=await db('rpc/finish_ranked',{p_id:input.sessionId,p_user:user.id,p_score:computed.score,p_moves:input.moves});
   }else throw Object.assign(Error('Not found'),{status:404});
  }res.end(JSON.stringify(result));
 }catch(e){res.writeHead(e.status??503);res.end(JSON.stringify({error:e.status?e.message:'Service unavailable'}));}
}).listen(Number(process.env.PORT??8787),process.env.HOST??'127.0.0.1',()=>console.log('NightShift ranking server ready'));
