import { ProgressStore } from '../campaign/Progress.js';
interface TelegramApp { initData:string; ready():void; expand():void; isActive?:boolean; viewportStableHeight?:number; safeAreaInset?:{top:number;bottom:number}; contentSafeAreaInset?:{top:number;bottom:number}; BackButton:{show():void;hide():void;onClick(fn:()=>void):void}; HapticFeedback?:{impactOccurred(style:string):void}; onEvent(name:string,fn:()=>void):void }
declare global {interface Window{Telegram?:{WebApp:TelegramApp}}}
export function telegram():TelegramApp|undefined{return window.Telegram?.WebApp;}
try{const hash=sessionStorage.getItem('nightshift.telegramHash');if(!location.hash&&hash)history.replaceState(null,'',location.pathname+location.search+hash);if(new URLSearchParams(location.hash.slice(1)).has('tgWebAppData'))sessionStorage.setItem('nightshift.telegramHash',location.hash);}catch{/* Storage is optional. */}
// Telegram bridge is optional. Failed external loading never blocks the offline game.
if(new URLSearchParams(location.hash.slice(1)).has('tgWebAppData')||window.Telegram){
  const setup=():void=>{const app=telegram();if(!app)return;app.ready();app.expand();const viewport=():void=>{document.documentElement.style.setProperty('--tg-height',`${app.viewportStableHeight??innerHeight}px`);document.body.style.paddingTop=`${(app.safeAreaInset?.top??0)+(app.contentSafeAreaInset?.top??0)}px`;document.body.style.paddingBottom=`${(app.safeAreaInset?.bottom??0)+(app.contentSafeAreaInset?.bottom??0)}px`;};viewport();for(const event of ['viewportChanged','safeAreaChanged','contentSafeAreaChanged'])app.onEvent(event,viewport);
    app.BackButton.show();app.BackButton.onClick(()=>{const modal=document.querySelector<HTMLDialogElement>('dialog[open]');if(modal){modal.dispatchEvent(new Event('cancel',{cancelable:true}));if(modal.open)modal.close();}else if(location.pathname.endsWith('campaign.html')||location.pathname.endsWith('ranked.html'))location.href='./';else document.getElementById('pause')?.click();});
    app.onEvent('deactivated',()=>document.getElementById('pause')?.click());document.addEventListener('click',event=>{let enabled=true;try{enabled=JSON.parse(localStorage.getItem('nightshift.basic.v1')??'{}').settings?.vibration!==false;}catch{/* Default. */}if(enabled&&(event.target as Element).closest('button'))app.HapticFeedback?.impactOccurred('light');});
  };if(telegram())setup();else{const script=document.createElement('script');script.src='https://telegram.org/js/telegram-web-app.js';script.onload=setup;script.async=true;document.head.append(script);}
}
const en=document.documentElement.lang==='en';
const bar=document.createElement('div');bar.className='install-bar';document.body.append(bar);
interface InstallEvent extends Event {prompt():Promise<void>;userChoice:Promise<{outcome:string}>}
let pending:InstallEvent|null=null;
const install=document.createElement('button');install.textContent=en?'Install game':'Установить игру';bar.append(install);
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event as InstallEvent;});
install.onclick=async()=>{if(pending){await pending.prompt();await pending.userChoice;pending=null;}else alert(en?'On iPhone: Safari → Share → Add to Home Screen. On desktop: use the browser install option.':'На iPhone: Safari → Поделиться → На экран «Домой». На компьютере: кнопка установки в меню браузера.');};
window.addEventListener('appinstalled',()=>{install.hidden=true;});if(matchMedia('(display-mode: standalone)').matches)install.hidden=true;
if('serviceWorker' in navigator){
 try{const registration=await navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).href});let wantReload=false;const offer=():void=>{if(!registration.waiting)return;const button=document.createElement('button');button.textContent=en?'Update ready · Reload':'Обновление готово · Перезапустить';button.onclick=()=>{wantReload=true;window.dispatchEvent(new Event('pagehide'));registration.waiting?.postMessage({type:'SKIP_WAITING'});};bar.append(button);};offer();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)offer();});});let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(wantReload&&!refreshing){refreshing=true;location.reload();}});}catch{/* Unsupported context: ordinary online play still works. */}
}

const progressLabel=document.getElementById('player-progress');if(progressLabel){const progress=new ProgressStore();await progress.open();progressLabel.textContent=`LV ${1+Math.floor(progress.data.xp/1000)} · ${progress.data.xp} XP · ${progress.data.caps} ◉`;}
