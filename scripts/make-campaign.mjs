import { writeFileSync } from 'node:fs';
import { Level } from '../dist/campaign/Level.js';
import { findPossibleMoves } from '../dist/game/core/MoveValidator.js';
const missions=[],puzzles=[];
const titles=['Первый заказ','Пицца для двоих','Лёд тронулся','Разбор поставки','Следы соуса','Закрытая кухня','Снять цепи','Доставка к утру','Большая уборка','Последний гость'];
const en=['First order','Pizza for two','Breaking the ice','Supply run','Spilled sauce','Closed kitchen','Breaking chains','Morning delivery','Closing cleanup','The last guest'];
const solve=(data)=>{let game=new Level(data);const solution=[];while(!game.over){let best=null;for(const move of findPossibleMoves(game.board)){const next=Level.restore(game.snapshot());try{if(!next.swap(move).accepted)continue;}catch{continue;}const value=next.data.goals.reduce((n,g)=>n+Math.min(1,next.value(g)/g.target),0)*100000+next.score*.02+next.destroyed*100+next.delivered*1000;if(!best||value>best.value)best={move,next,value};}if(!best)break;solution.push(best.move);game=best.next;}return {game,solution};};
for(let i=1;i<=30;i++){
 const kind=(i-1)%10,chapter=Math.floor((i-1)/10),obstacles=[];const holes=chapter>0?[0,7]:[];
 if(kind>=2&&kind<=6)for(let j=0;j<3+chapter;j++)obstacles.push({index:18+j*2,type:['ice','box','sauce','tray','chain'][kind-2],hp:kind===5?2:1+Number(kind===2&&chapter===2)});
 if(kind===8)for(let j=0;j<5;j++)obstacles.push({index:18+j*2,type:['ice','box','sauce','tray','chain'][j],hp:1});
 const goals=kind===0||kind===9?[{type:'score',target:3500+chapter*1800}]:kind===1?[{type:'collect',color:1,target:12+chapter*4}]:kind===7?[{type:'delivery',target:1}]:[{type:'obstacles',target:obstacles.length}];
 if(kind===8)goals.push({type:'collect',color:2,target:8+chapter*3});
 let data,result;
 for(let attempt=0;attempt<70;attempt++){data={id:i,mode:'mission',title:titles[kind],titleEn:en[kind],seed:10000+i*100+attempt,moves:24+chapter*3,stars:[6000+chapter*2000,10000+chapter*3000],goals,obstacles,holes,deliveries:kind===7?[11]:[]};try{result=solve(data);if(result.game.won)break;}catch{}}
 if(!result?.game.won)throw Error('Unsolved mission '+i);data.solution=result.solution;missions.push(data);console.log('Mission',i,'solution',data.solution.length);
}
for(let i=1;i<=20;i++){
 const depth=1+Math.floor((i-1)/5);const data={id:i,mode:'puzzle',title:['Один точный ход','Двойной расчёт','Три шага','Четыре хода'][depth-1]+' '+i,titleEn:['One perfect move','Double calculation','Three steps','Four moves'][depth-1]+' '+i,seed:900000+i*31,moves:depth,stars:[0,0],goals:[{type:'score',target:1000000}],obstacles:[],holes:[],deliveries:[]};
 const result=solve(data);data.goals[0].target=result.game.score;data.stars=[result.game.score,result.game.score];data.solution=result.solution;puzzles.push(data);
}
writeFileSync('public/data/missions.json',JSON.stringify(missions,null,2)+'\n');writeFileSync('public/data/puzzles.json',JSON.stringify(puzzles,null,2)+'\n');console.log('30 solvable missions and 20 deterministic puzzles written.');
