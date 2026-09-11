let database:IDBDatabase|null=null;
let opening:Promise<void>|null=null;
let writes:Promise<void>=Promise.resolve();
export function restoreEndlessBackup():Promise<void>{
 if(opening)return opening;
 opening=(async()=>{if(typeof indexedDB==='undefined')return;try{
 database=await new Promise<IDBDatabase>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Database timeout')),1500);const r=indexedDB.open('nightshift-endless',1);r.onupgradeneeded=()=>r.result.createObjectStore('save');r.onsuccess=()=>{clearTimeout(timer);resolve(r.result);};r.onerror=()=>{clearTimeout(timer);reject(r.error);};r.onblocked=()=>{clearTimeout(timer);reject(Error('Database blocked'));};});
 if(localStorage.getItem('nightshift.basic.v1'))return;
 const raw=await new Promise<string|undefined>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Read timeout')),1500);const r=database!.transaction('save').objectStore('save').get('basic');r.onsuccess=()=>{clearTimeout(timer);resolve(r.result as string|undefined);};r.onerror=()=>{clearTimeout(timer);reject(r.error);};});if(raw)localStorage.setItem('nightshift.basic.v1',raw);
 }catch{/* The synchronous localStorage checkpoint remains the fallback. */}})();return opening;
}
export function backupEndless(raw:string):void{
 if(!database)return;writes=writes.then(()=>new Promise<void>((resolve,reject)=>{const tx=database!.transaction('save','readwrite');tx.objectStore('save').put(raw,'basic');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);})).catch(()=>undefined);
}
