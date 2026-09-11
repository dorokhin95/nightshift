import { indexOf, tileColor, tileKind, type Board, type BoardEvent } from '../game/core/index.js';
import { VISUAL } from './visual-config.js';
export class BoardRenderer {
  private atlas:HTMLImageElement|null=null;
  private lastBoard:Board|null=null;
  private ctx: CanvasRenderingContext2D;
  reduced = false;
  paused = false;
  symbols = false;
  economical = false;
  selected: number | null = null;
  hints: number[] = [];
  constructor(readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas 2D is unavailable');
    this.ctx = context;
    if(typeof Image!=='undefined'){this.atlas=new Image();this.atlas.src=new URL('../art/food-atlas.png',import.meta.url).href;this.atlas.onload=()=>{if(this.lastBoard&&!this.paused)this.draw(this.lastBoard);};}
    const dpr = Math.min(VISUAL.maxDpr, window.devicePixelRatio || 1);
    canvas.width = VISUAL.size * dpr; canvas.height = VISUAL.size * dpr;
    context.scale(dpr, dpr);
  }
  private tile(tile: number, x: number, y: number, cell: number, alpha = 1, scale = 1): void {
    const c = this.ctx; const color = VISUAL.colors[tileColor(tile) % VISUAL.colors.length]!; const kind = tileKind(tile);
    c.save(); c.translate(x + cell / 2, y + cell / 2); c.scale(scale * cell / 64, scale * cell / 64); c.globalAlpha = alpha;
    const gradient = c.createLinearGradient(0, -25, 0, 25);
    gradient.addColorStop(0, '#304456'); gradient.addColorStop(1, '#1b293c');
    c.fillStyle = gradient; c.strokeStyle = kind === 'normal' ? '#41546b' : color;
    c.lineWidth = kind === 'normal' ? 1 : 2;
    c.beginPath(); c.roundRect(-26, -26, 52, 52, 12); c.fill(); c.stroke();
    c.fillStyle = color; c.strokeStyle = color; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
    if (kind.startsWith('rocket')) {
      if (kind === 'rocket-v') c.rotate(-Math.PI / 2);
      c.beginPath(); c.moveTo(-16,-7); c.lineTo(8,-7); c.lineTo(21,0); c.lineTo(8,7); c.lineTo(-16,7); c.closePath();c.fill();
      c.fillStyle='#fff5dc';c.fillRect(-10,-3,9,6);c.strokeStyle='#ff847c';
      c.beginPath();c.moveTo(-20,-5);c.lineTo(-25,-7);c.moveTo(-20,5);c.lineTo(-25,7);c.stroke();
    } else if (kind === 'bomb') {
      c.beginPath();c.arc(0,4,14,0,Math.PI*2);c.fill();
      c.beginPath();c.moveTo(0,-9);c.quadraticCurveTo(1,-23,13,-17);c.stroke();
      c.fillStyle='#17243a';c.beginPath();c.arc(-4,0,4,0,Math.PI*2);c.fill();
      c.strokeStyle='#fff';c.beginPath();c.moveTo(13,-23);c.lineTo(13,-12);c.moveTo(8,-18);c.lineTo(18,-18);c.stroke();
    } else if (kind === 'lightning') {
      c.fillStyle='#fff4a9';c.beginPath();c.moveTo(4,-22);c.lineTo(-16,4);c.lineTo(-2,4);c.lineTo(-6,23);c.lineTo(17,-5);c.lineTo(4,-5);c.closePath();c.fill();
    } else if(this.atlas?.complete&&this.atlas.naturalWidth){
      const col=tileColor(tile)%3,row=Math.floor(tileColor(tile)/3);c.drawImage(this.atlas,col*this.atlas.naturalWidth/3,row*this.atlas.naturalHeight/2,this.atlas.naturalWidth/3,this.atlas.naturalHeight/2,-26,-26,52,52);
    } else {
      switch (tileColor(tile) % 6) {
        case 0: // bottle
          c.beginPath();c.roundRect(-9,-7,18,28,5);c.fill();c.fillRect(-5,-22,10,17);
          c.fillStyle='#f8e8bb';c.fillRect(-8,3,16,9);c.fillStyle='#72593a';c.fillRect(-5,-23,10,4);break;
        case 1: // pizza
          c.beginPath();c.moveTo(-19,-15);c.lineTo(20,-11);c.lineTo(-5,22);c.closePath();c.fill();
          c.strokeStyle='#ffe18a';c.lineWidth=6;c.beginPath();c.moveTo(-19,-15);c.lineTo(20,-11);c.stroke();
          c.fillStyle='#b54c53';for(const [px,py] of [[-5,-5],[7,-5],[-4,7]]){c.beginPath();c.arc(px!,py!,3,0,Math.PI*2);c.fill();}break;
        case 2: // burger
          c.fillStyle='#f5b96c';c.beginPath();c.ellipse(0,-5,20,13,0,Math.PI,Math.PI*2);c.fill();
          c.fillStyle=color;c.fillRect(-21,-2,42,5);c.fillStyle='#a85c42';c.fillRect(-19,4,38,7);
          c.fillStyle='#f5b96c';c.beginPath();c.roundRect(-20,12,40,7,3);c.fill();break;
        case 3: // shot
          c.fillStyle='#d6e7f2';c.beginPath();c.moveTo(-15,-17);c.lineTo(15,-17);c.lineTo(10,20);c.lineTo(-10,20);c.closePath();c.fill();
          c.fillStyle=color;c.beginPath();c.moveTo(-11,-4);c.lineTo(11,-4);c.lineTo(7,15);c.lineTo(-7,15);c.closePath();c.fill();break;
        case 4: // fries
          c.fillStyle='#ffd36f';for(let i=0;i<5;i++)c.fillRect(-16+i*7,-23+(i%2)*5,5,29);
          c.fillStyle='#df7563';c.beginPath();c.moveTo(-21,-2);c.lineTo(21,-2);c.lineTo(14,21);c.lineTo(-14,21);c.closePath();c.fill();break;
        case 5: // pretzel
          c.lineWidth=6;c.beginPath();c.moveTo(-11,17);c.bezierCurveTo(-36,-5,-11,-29,0,-7);
          c.bezierCurveTo(11,-29,36,-5,11,17);c.bezierCurveTo(-4,28,-18,-8,-9,-2);
          c.lineTo(13,18);c.stroke();break;
      }
    }
    if(this.symbols){c.fillStyle='#ffffff';c.font='bold 16px sans-serif';c.textAlign='left';c.fillText(String(tileColor(tile)+1),-23,-12);}
    c.restore();
  }
  draw(board: Board, event?: BoardEvent, progress = 1, previous?: Board): void {
    this.lastBoard=board;
    const c = this.ctx; const size = VISUAL.size; const cell = size / board.width;
    c.clearRect(0,0,size,size);c.save();
    const bomb = event?.type === 'combo' && event.name.includes('bomb') || event?.type === 'special-activated' && event.kind === 'bomb';
    if (bomb && !this.reduced) c.translate(Math.sin(progress * 45) * VISUAL.shake * (1-progress),0);
    c.fillStyle='#101c2e';c.beginPath();c.roundRect(0,0,size,size,20);c.fill();
    for(let i=0;i<board.cells.length;i++){
      const x=(i%board.width)*cell;const y=Math.floor(i/board.width)*cell;
      c.fillStyle='#162339';c.beginPath();c.roundRect(x+3,y+3,cell-6,cell-6,12);c.fill();
      const highlighted=this.selected===i || this.hints.includes(i);
      if(highlighted){c.strokeStyle=this.selected===i?'#fff9cb':'#9befd7';c.lineWidth=2;c.stroke();}
    }
    const p=this.reduced?1:1-Math.pow(1-progress,3);
    const origin=previous ?? board;
    for(let i=0;i<board.cells.length;i++){
      let tile=board.cells[i];let x=i%board.width;let y=Math.floor(i/board.width);let alpha=1;let scale=1;
      if(event?.type==='swap' && previous){
        const a=indexOf(board,event.move.from);const b=indexOf(board,event.move.to);
        if(i===a || i===b){const from=i===a?b:a;x=(from%board.width)*(1-p)+x*p;y=Math.floor(from/board.width)*(1-p)+y*p;}
      }
      if(event?.type==='gravity' && previous && tile!==null){
        const col=i%board.width;const source:number[]=[];
        for(let row=0;row<board.height;row++)if(previous.cells[row*board.width+col]!==null)source.push(row);
        const firstTarget=board.height-source.length;const sourceY=source[Math.floor(i/board.width)-firstTarget];
        if(sourceY!==undefined)y=sourceY*(1-p)+y*p;
      }
      if(event?.type==='spawn' && origin.cells[i]===null){y=-1*(1-p)+y*p;alpha=p;}
      if(event?.type==='clear' && event.indices.includes(i)){tile=origin.cells[i];scale=1-p;alpha=1-p;}
      if(event?.type==='special-created' && event.index===i)scale=1+Math.sin(progress*Math.PI)*0.2;
      if(event?.type==='shuffle')alpha=0.4+0.6*p;
      if(tile!==null && tile!==undefined)this.tile(tile,x*cell,y*cell,cell,alpha,scale);
    }
    if(event && !this.reduced && !this.economical)this.effect(event,progress,cell);
    c.restore();
  }
  private effect(event: BoardEvent, p: number, cell: number): void {
    const c=this.ctx;
    const point=(i:number):[number,number]=>[(i%event.board.width+0.5)*cell,(Math.floor(i/event.board.width)+0.5)*cell];
    if(event.type==='special-activated' || event.type==='combo'){
      const index=event.type==='combo'?event.indices[0]:event.index;
      const [x,y]=point(index);const name=event.type==='combo'?event.name:event.kind;
      c.globalAlpha=1-p*0.7;
      if(name.includes('bomb')){
        c.strokeStyle='#ffb989';c.lineWidth=5*(1-p)+1;c.beginPath();c.arc(x,y,cell*(0.25+p*(name==='bomb+bomb'?4:2.5)),0,Math.PI*2);c.stroke();
        c.fillStyle=`rgba(255,201,143,${(1-p)*0.22})`;c.fillRect(0,0,VISUAL.size,VISUAL.size);
      }
      c.strokeStyle=name.includes('lightning')?'#fff5b0':'#8ff1dc';c.lineWidth=3;
      for(const i of event.targets){
        const [tx,ty]=point(i);
        if(name.includes('lightning')){
          c.beginPath();c.moveTo(x,y);c.lineTo((x+tx)/2+Math.sin(i*7+p*15)*8,(y+ty)/2+Math.cos(i*3+p*15)*8);c.lineTo(tx,ty);c.stroke();
        }else if(name.includes('rocket')){
          c.beginPath();c.moveTo(x,y);c.lineTo(x+(tx-x)*Math.min(1,p*2),y+(ty-y)*Math.min(1,p*2));c.stroke();
        }
      }
      for(let i=0;i<VISUAL.particleCount;i++){
        const angle=i*2.39996;const r=p*cell*(1+(i%3));c.fillStyle=i%2?'#ffe0ad':'#83e6cf';
        c.fillRect(x+Math.cos(angle)*r,y+Math.sin(angle)*r,3*(1-p)+1,3*(1-p)+1);
      }
      c.globalAlpha=1;
    }
  }
  animate(previous: Board, event: BoardEvent): Promise<void> {
    const duration=this.reduced?VISUAL.reducedDuration:VISUAL.durations[event.type];
    let elapsed=0;let last:number|undefined;
    return new Promise(resolve=>{
      const frame=(now:number):void=>{
        if(document.hidden || this.paused){last=undefined;requestAnimationFrame(frame);return;}
        if(last!==undefined)elapsed+=Math.min(VISUAL.maxFrameDelta,now-last);
        last=now;const p=Math.min(1,elapsed/duration);this.draw(event.board,event,p,previous);
        if(p<1)requestAnimationFrame(frame);else resolve();
      };requestAnimationFrame(frame);
    });
  }
}
