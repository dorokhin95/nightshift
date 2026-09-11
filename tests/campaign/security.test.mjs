import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {validateTelegram,token,verifyToken} from '../../backend/security.mjs';
import {Game,replay} from '../../dist/game/core/index.js';
function signed(now){const bot='test-bot';const p=new URLSearchParams({auth_date:String(now),user:JSON.stringify({id:123,first_name:'Rita'})});const check=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');const secret=createHmac('sha256','WebAppData').update(bot).digest();p.set('hash',createHmac('sha256',secret).update(check).digest('hex'));return p.toString();}
test('Telegram valid signature accepted, tampering, wrong key and stale data rejected',()=>{const data=signed(10000);assert.equal(validateTelegram(data,'test-bot',10000).id,'123');assert.throws(()=>validateTelegram(data.replace('Rita','Hacker'),'test-bot',10000));assert.throws(()=>validateTelegram(data,'wrong',10000));assert.throws(()=>validateTelegram(data,'test-bot',14000));assert.throws(()=>validateTelegram(data+'&auth_date=10000','test-bot',10000));});
test('auth tokens are signed and expire',()=>{const secret='a'.repeat(32),value=token({id:'123',nickname:'Rita'},secret,1000);assert.equal(verifyToken(value,secret,1001).id,'123');assert.throws(()=>verifyToken(value+'x',secret,1001));assert.throws(()=>verifyToken(value,secret,5000));});
test('ranked replay verifies exactly 50 legal moves and ignores client score',()=>{const game=new Game(52),moves=[];for(let i=0;i<50;i++){const m=game.hint();moves.push(m);game.swap(m);}assert.equal(replay(52,moves,undefined,50).score,game.score);assert.throws(()=>replay(52,[...moves,moves[0]],undefined,50));assert.throws(()=>replay(52,[{from:[0,0],to:[7,7]}],undefined,50));});
