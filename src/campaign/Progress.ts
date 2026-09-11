import { Level, type LevelSave } from './Level.js';
export type Booster='opener'|'shuffle'|'recolor'|'rocket'|'bomb'|'lightning';
export interface Progress { version:1; xp:number; caps:number; records:Record<string,{score:number;stars:number}>; inventory:Record<Booster,number>; achievements:string[]; daily:string; active:LevelSave|null; tutorial:boolean }
const fresh=():Progress=>({version:1,xp:0,caps:60,records:{},inventory:{opener:3,shuffle:2,recolor:2,rocket:1,bomb:1,lightning:1},achievements:[],daily:'',active:null,tutorial:false});
export class ProgressStore {
  data:Progress=fresh();private db:IDBDatabase|null=null;error=false;private queue:Promise<void>=Promise.resolve();
  async open():Promise<void>{
    try{const raw=localStorage.getItem('nightshift.progress.v1');if(raw)this.data=this.validate(JSON.parse(raw));}catch{this.error=true;}
    if(typeof indexedDB==='undefined')return;
    try{
      this.db=await new Promise<IDBDatabase>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Database timeout')),1500);const r=indexedDB.open('nightshift',1);r.onupgradeneeded=()=>r.result.createObjectStore('profile');r.onsuccess=()=>{clearTimeout(timer);resolve(r.result);};r.onerror=()=>{clearTimeout(timer);reject(r.error);};r.onblocked=()=>{clearTimeout(timer);reject(Error('Database blocked'));};});
      // localStorage is the synchronous latest checkpoint; IndexedDB retains a durable copy.
      const saved=await new Promise<unknown>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Read timeout')),1500);const r=this.db!.transaction('profile').objectStore('profile').get('progress');r.onsuccess=()=>{clearTimeout(timer);resolve(r.result);};r.onerror=()=>{clearTimeout(timer);reject(r.error);};});
      if(!localStorage.getItem('nightshift.progress.v1')&&saved)this.data=this.validate(saved);this.save();
    }catch{this.error=true;}
  }
  private validate(input:unknown):Progress{const p=input as Progress;if(!p||p.version!==1||!Number.isSafeInteger(p.xp)||p.xp<0||!Number.isSafeInteger(p.caps)||p.caps<0||!p.records||!p.inventory||Object.values(p.inventory).some(n=>!Number.isInteger(n)||n<0)||!Array.isArray(p.achievements))throw Error('Invalid progress');if(Object.keys(fresh().inventory).some(k=>!Number.isInteger(p.inventory[k as Booster])||p.inventory[k as Booster]<0)||Object.entries(p.records).some(([key,r])=>! /^(mission|puzzle):[1-9][0-9]*$/.test(key)||!Number.isSafeInteger(r.score)||r.score<0||!Number.isInteger(r.stars)||r.stars<1||r.stars>3)||typeof p.daily!=='string'||typeof p.tutorial!=='boolean')throw Error('Invalid profile fields');if(p.active)Level.restore(p.active);return p;}
  save():void{
    const snapshot=structuredClone(this.data);try{localStorage.setItem('nightshift.progress.v1',JSON.stringify(snapshot));this.error=false;}catch{this.error=true;}
    if(this.db)this.queue=this.queue.then(()=>new Promise<void>((resolve,reject)=>{const tx=this.db!.transaction('profile','readwrite');tx.objectStore('profile').put(snapshot,'progress');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);})).catch(()=>{this.error=true;});
  }
  async flush():Promise<void>{await this.queue;}
  get stars():number{return Object.entries(this.data.records).filter(([k])=>k.startsWith('mission')).reduce((n,[,v])=>n+v.stars,0);}
  unlocked(mode:string,id:number):boolean{return id===1||!!this.data.records[`${mode}:${id-1}`]&&(mode!=='mission'||id<=10||this.stars>=Math.floor((id-1)/10)*10);}
  complete(mode:string,id:number,score:number,stars:number):{xp:number;caps:number;achievements:string[]}{
    if(!stars)return {xp:0,caps:0,achievements:[]};const key=`${mode}:${id}`,old=this.data.records[key];const delta=Math.max(0,stars-(old?.stars??0));const xp=(!old?150:0)+delta*50,caps=(!old?20:0)+delta*5;
    this.data.records[key]={score:Math.max(score,old?.score??0),stars:Math.max(stars,old?.stars??0)};this.data.xp+=xp;this.data.caps+=caps;
    const earned:string[]=[];const achievements:[string,boolean][]=[['first',Object.keys(this.data.records).length>=1],['ten',Object.keys(this.data.records).length>=10],['stars',this.stars>=30],['puzzles',Object.keys(this.data.records).filter(k=>k.startsWith('puzzle')).length>=20],['night',Object.keys(this.data.records).filter(k=>k.startsWith('mission')).length>=30]];
    for(const [name,eligible] of achievements)if(eligible&&!this.data.achievements.includes(name)){this.data.achievements.push(name);this.data.caps+=30;this.data.inventory.opener++;earned.push(name);}
    this.data.active=null;this.save();return {xp,caps:caps+earned.length*30,achievements:earned};
  }
  claimDaily(day=new Date().toISOString().slice(0,10)):boolean{if(this.data.daily>=day)return false;this.data.daily=day;this.data.caps+=15;this.save();return true;}
  buy(type:Booster):boolean{const price=type==='lightning'?60:20;if(this.data.caps<price)return false;this.data.caps-=price;this.data.inventory[type]++;this.save();return true;}
  spend(type:Booster):boolean{if(this.data.inventory[type]<=0)return false;this.data.inventory[type]--;this.save();return true;}
  reset():void{this.data=fresh();this.save();}
}
