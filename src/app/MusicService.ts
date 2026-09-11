/** Original, locally synthesized ambient loop. Starts only after a user gesture. */
export class MusicService {
  private ctx:AudioContext|null=null;
  private gain:GainNode|null=null;
  private timer:ReturnType<typeof setInterval>|null=null;
  private step=0;
  volume=0.175;
  async start():Promise<void>{
    if(this.volume===0){this.stop();return;}
    try{
      this.ctx??=new AudioContext();await this.ctx.resume();
      this.gain??=this.ctx.createGain();this.gain.gain.value=this.volume*0.12;this.gain.connect(this.ctx.destination);
      if(this.timer!==null)return;
      const note=():void=>{
        const ctx=this.ctx!;if(ctx.state!=='running')return;
        const now=ctx.currentTime;const osc=ctx.createOscillator();const env=ctx.createGain();
        osc.type='sine';osc.frequency.value=[130.81,164.81,196,246.94,196,164.81,146.83,196][this.step++%8]!;
        env.gain.setValueAtTime(0,now);env.gain.linearRampToValueAtTime(0.65,now+0.18);env.gain.exponentialRampToValueAtTime(0.001,now+1.5);
        osc.connect(env);env.connect(this.gain!);osc.start();osc.stop(now+1.6);osc.onended=()=>{osc.disconnect();env.disconnect();};
      };note();this.timer=setInterval(note,750);
    }catch{/* Audio is optional; the game remains playable. */}
  }
  stop():void{if(this.timer!==null)clearInterval(this.timer);this.timer=null;if(this.ctx?.state==='running')void this.ctx.suspend().catch(()=>undefined);}
}
