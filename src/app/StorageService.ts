import { backupEndless } from './EndlessBackup.js';
import { Game, type Save } from '../game/core/index.js';
export interface Settings { master:number; music:number; effects:number; vibration:boolean; hints:boolean; quality:'auto'|'high'|'low'; reduced:boolean; symbols:boolean; language:'ru'|'en' }
export interface Session { game:Save; elapsed:number }
export interface Profile { version:1; session:Session|null; best:number; settings:Settings }
export const defaults:Settings={master:70,music:25,effects:50,vibration:true,hints:true,quality:'auto',reduced:false,symbols:false,language:'ru'};
export interface Store { getItem(key:string):string|null; setItem(key:string,value:string):void }
export class StorageService {
  static readonly key='nightshift.basic.v1';
  error=false;
  constructor(private readonly store:Store) {}
  load():Profile {
    const fallback:Profile={version:1,session:null,best:0,settings:{...defaults}};
    try {
      const raw=this.store.getItem(StorageService.key);if(!raw)return fallback;
      const data=JSON.parse(raw) as Profile;
      if(data.version!==1 || !Number.isSafeInteger(data.best) || data.best<0)throw new Error('Invalid profile');
      const s=data.settings;
      if(!s || ![s.master,s.music,s.effects].every(n=>Number.isFinite(n)&&n>=0&&n<=100) || ![s.vibration,s.hints,s.reduced,s.symbols].every(n=>typeof n==='boolean') || !['ru','en'].includes(s.language) || !['auto','high','low'].includes(s.quality))throw new Error('Invalid settings');
      if(data.session){Game.restore(data.session.game);if(!Number.isFinite(data.session.elapsed)||data.session.elapsed<0)throw new Error('Invalid elapsed');data.best=Math.max(data.best,data.session.game.score);}
      this.error=false;return data;
    }catch{this.error=true;return fallback;}
  }
  save(profile:Profile):boolean {
    try{const raw=JSON.stringify(profile);this.store.setItem(StorageService.key,raw);backupEndless(raw);this.error=false;return true;}catch{this.error=true;return false;}
  }
}
