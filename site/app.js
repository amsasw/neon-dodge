const canvas=document.querySelector('#toy');
const ctx=canvas.getContext('2d');
const stage=document.querySelector('#stage');
const shadow=document.querySelector('#shadow');
const speech=document.querySelector('#speech');
const mood=document.querySelector('#mood');
const hint=document.querySelector('#hint');
const countEl=document.querySelector('#count');
const toastEl=document.querySelector('#toast');

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let w=0,h=0,dpr=1,mode='squish',color='#ead9c3',softness=74,sizePct=100;
let pressed=false,pointerId=null,lastX=0,lastY=0,lastT=0,dragVX=0,dragVY=0;
let soundOn=false,audioCtx=null,count=Number(localStorage.getItem('puff-count')||0);
countEl.textContent=count;

const state={x:0,y:0,vx:0,vy:0,sx:1,sy:1,rot:0,press:0,wobble:0,blink:0,smile:0,air:0};
const target={x:0,y:0,sx:1,sy:1,rot:0,press:0,wobble:0,smile:0};

function resize(){
  const r=stage.getBoundingClientRect();w=r.width;h=r.height;dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize',resize);resize();

function hexToRgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
function mix(c,a){return c.map(v=>clamp(Math.round(v+a),0,255))}
function rgba(c,a=1){return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')'}

function blobPath(cx,cy,r,sx,sy,t){
  const pts=72;ctx.beginPath();
  for(let i=0;i<=pts;i++){
    const a=i/pts*Math.PI*2;
    const noise=Math.sin(a*3+t*2.1)*.026+Math.sin(a*5-t*1.7)*.015;
    const rr=r*(1+noise+state.wobble*.018*Math.sin(a*7+t*9));
    let x=Math.cos(a)*rr*sx,y=Math.sin(a)*rr*sy;
    x+=Math.sin(a)*state.rot*r*.12;y+=Math.cos(a)*state.rot*r*.04;
    const px=cx+x,py=cy+y;
    if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
  }
  ctx.closePath();
}

function draw(t){
  ctx.clearRect(0,0,w,h);
  const base=Math.min(w,h)*(innerWidth<760?.18:.205)*(sizePct/100);
  const cx=w/2+state.x,cy=h*.54+state.y;
  const rgb=hexToRgb(color),light=mix(rgb,28),dark=mix(rgb,-30);
  const grad=ctx.createRadialGradient(cx-base*.28,cy-base*.38,base*.12,cx,cy,base*1.12);
  grad.addColorStop(0,rgba(light,1));grad.addColorStop(.58,rgba(rgb,1));grad.addColorStop(1,rgba(dark,1));
  ctx.save();ctx.translate(cx,cy);ctx.rotate(state.rot);ctx.translate(-cx,-cy);
  blobPath(cx,cy,base,state.sx,state.sy,t*.001);
  ctx.fillStyle=grad;ctx.shadowColor='rgba(93,72,55,.16)';ctx.shadowBlur=24;ctx.shadowOffsetY=10;ctx.fill();
  ctx.shadowColor='transparent';

  const faceY=cy-base*.05*state.sy;
  const eyeGap=base*.24*state.sx,eyeY=faceY-base*.12;
  ctx.fillStyle='rgba(76,64,55,.78)';
  const blink=Math.max(0,state.blink);
  for(const dx of [-eyeGap,eyeGap]){
    ctx.beginPath();ctx.ellipse(cx+dx,eyeY,base*.035,base*.052*(1-blink)+1.5,0,0,Math.PI*2);ctx.fill();
  }
  ctx.lineWidth=2;ctx.strokeStyle='rgba(76,64,55,.72)';ctx.lineCap='round';
  ctx.beginPath();
  if(state.smile>.4){ctx.arc(cx,faceY+base*.12,base*.11,0,Math.PI);}
  else{ctx.moveTo(cx-base*.06,faceY+base*.13);ctx.quadraticCurveTo(cx,faceY+base*.15+state.press*base*.03,cx+base*.06,faceY+base*.13);}
  ctx.stroke();

  if(state.press>.18){ctx.fillStyle='rgba(210,127,120,'+(state.press*.16)+')';for(const dx of [-base*.31,base*.31]){ctx.beginPath();ctx.ellipse(cx+dx,faceY+base*.08,base*.09,base*.045,0,0,Math.PI*2);ctx.fill()}}
  ctx.restore();

  shadow.style.transform='translate('+state.x*.75+'px,'+state.y*.15+'px) scale('+clamp(state.sx,0.65,1.5)+','+clamp(1+state.y/base*.18,.65,1.25)+')';
  shadow.style.opacity=String(clamp(.75+state.y/base*.22,.25,.95));
}

let last=performance.now(),blinkAt=performance.now()+2200;
function loop(now){
  const dt=Math.min((now-last)/1000,.033);last=now;
  const stiffness=9+(100-softness)*.05;
  const damping=.78;
  for(const k of ['x','y']){
    const v='v'+k;
    state[v]+=((target[k]-state[k])*stiffness)*dt;
    state[v]*=Math.pow(damping,dt*60);state[k]+=state[v]*dt*60;
  }
  for(const k of ['sx','sy','rot','press','wobble','smile']) state[k]+=(target[k]-state[k])*(1-Math.pow(.001,dt));
  if(state.air){state.vy+=760*dt;target.y+=state.vy*dt;target.x+=state.vx*dt;target.rot=clamp(state.vx*.0015,-.35,.35);
    const floor=h*.17,limitX=w*.34;
    if(target.x>limitX||target.x<-limitX){target.x=clamp(target.x,-limitX,limitX);state.vx*=-.58;pop(135)}
    if(target.y>floor){target.y=floor;state.vy*=-.52;target.sx=1.15;target.sy=.84;setTimeout(()=>{target.sx=1;target.sy=1},100);pop(95);if(Math.abs(state.vy)<70){state.air=0;target.y=0;target.x=0;target.rot=0}}
  }
  if(!pressed&&now>blinkAt){state.blink=Math.sin(Math.min(Math.PI,(now-blinkAt)/150*Math.PI));if(now-blinkAt>300){state.blink=0;blinkAt=now+2400+Math.random()*3200}}
  draw(now);requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function speak(text,m='PUFF 正在努力保持柔软'){speech.textContent=text;mood.textContent=m;speech.style.transform='translate(-50%,-55%) rotate(-2deg)';setTimeout(()=>speech.style.transform='translate(-50%,-50%) rotate(-2deg)',180)}
function center(){target.x=0;target.y=0;target.sx=1;target.sy=1;target.rot=0;target.press=0;target.wobble=0;target.smile=0;state.air=0}
function hitTest(p){const cx=w/2+state.x,cy=h*.54+state.y,r=Math.min(w,h)*(innerWidth<760?.18:.205)*(sizePct/100);return Math.hypot((p.x-cx)/state.sx,(p.y-cy)/state.sy)<r*1.05}

canvas.addEventListener('pointerdown',e=>{
  const p=point(e);if(!hitTest(p))return;pressed=true;pointerId=e.pointerId;canvas.setPointerCapture(e.pointerId);lastX=p.x;lastY=p.y;lastT=performance.now();
  if(mode==='squish'){target.sx=1.16;target.sy=.78;target.press=.95;target.smile=.2;speak('噗叽——','被捏成一小团了');pop(220)}
  if(mode==='stretch'){target.sx=1;target.sy=1;target.press=.35;speak('慢一点，我会跟上的','正在被拉成长条')}
  if(mode==='tickle'){target.wobble=1;target.smile=1;speak('哈哈，那里很痒！','已经笑得站不稳了');chirp()}
  if(mode==='toss'){target.sx=1.05;target.sy=.9;speak('你该不会要把我扔出去吧…','有一点点紧张')}
});
canvas.addEventListener('pointermove',e=>{
  if(!pressed||e.pointerId!==pointerId)return;const p=point(e),dx=p.x-lastX,dy=p.y-lastY,now=performance.now(),dt=Math.max(16,now-lastT);dragVX=dx/dt*1000;dragVY=dy/dt*1000;lastX=p.x;lastY=p.y;lastT=now;
  target.x=clamp(target.x+dx,-w*.34,w*.34);target.y=clamp(target.y+dy,-h*.27,h*.2);
  if(mode==='stretch'){const mag=clamp(Math.hypot(target.x,target.y)/180,0,1);target.sx=1+.5*mag;target.sy=1-.22*mag;target.rot=clamp(target.x*.0012,-.3,.3)}
  if(mode==='tickle'){target.wobble=1;target.rot=Math.sin(now*.02)*.12;target.smile=1}
});
function release(e){
  if(!pressed||e.pointerId!==pointerId)return;pressed=false;canvas.releasePointerCapture(e.pointerId);
  if(mode==='toss'&&Math.hypot(dragVX,dragVY)>180){state.air=1;state.vx=dragVX*.65;state.vy=dragVY*.7;target.wobble=.5;speak('哇——！','正在空中努力保持体面');pop(320)}
  else{target.sx=1;target.sy=1;target.press=0;target.wobble=0;target.rot=0;target.smile=0;target.x=0;target.y=0;pop(170)}
}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
canvas.addEventListener('dblclick',surprise);

document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('.tool').forEach(x=>x.classList.toggle('active',x===b));center();const map={squish:'按住捏一捏，拖动可以把它拽走',stretch:'抓住往外拉，松手会软软弹回来',tickle:'按住来回移动，看它抖成一团',toss:'抓住后快速一甩，把它抛起来'};hint.textContent=map[mode];pop(480)});
document.querySelector('#reset').onclick=()=>{center();speak('回来了。这里刚刚好。','重新站稳了')};
document.querySelector('#surprise').onclick=surprise;
function surprise(){target.sx=.88;target.sy=1.22;target.wobble=.7;target.smile=1;speak(['送你一颗看不见的小糖','今天可以慢一点','你已经做得够多啦'][Math.floor(Math.random()*3)],'开心到有点膨胀');chirp();setTimeout(()=>{target.sx=1;target.sy=1;target.wobble=0;target.smile=0},900)}

document.querySelector('#settingsBtn').onclick=()=>document.querySelector('#settings').showModal();
document.querySelector('#closeSettings').onclick=document.querySelector('#doneSettings').onclick=()=>document.querySelector('#settings').close();
document.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{color=b.dataset.color;document.documentElement.style.setProperty('--blob',color);document.querySelectorAll('.swatch').forEach(x=>x.classList.toggle('selected',x===b));pop(420)});
document.querySelector('#softness').oninput=e=>{softness=Number(e.target.value);document.querySelector('#softOut').textContent=softness};
document.querySelector('#size').oninput=e=>{sizePct=Number(e.target.value);document.querySelector('#sizeOut').textContent=sizePct+'%'};

document.querySelector('#sound').onclick=async e=>{soundOn=!soundOn;if(soundOn){audioCtx??=new (window.AudioContext||window.webkitAudioContext)();await audioCtx.resume()}e.currentTarget.setAttribute('aria-pressed',soundOn);e.currentTarget.querySelector('span').textContent=soundOn?'声音开':'声音关';if(soundOn)chirp()};
function pop(freq=180){if(!soundOn||!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime;o.type='sine';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(70,freq*.45),t+.13);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.08,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.15);o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+.16)}
function chirp(){if(!soundOn||!audioCtx)return;[520,660,820].forEach((f,i)=>setTimeout(()=>pop(f),i*70))}

function toast(s){toastEl.textContent=s;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),1600)}
document.querySelector('#collect').onclick=async()=>{count++;localStorage.setItem('puff-count',count);countEl.textContent=count;const url=makeCard();document.querySelector('#cardImage').src=url;document.querySelector('#cardDialog').showModal();chirp()};
document.querySelector('#closeCard').onclick=()=>document.querySelector('#cardDialog').close();
let cardUrl='';
function makeCard(){const c=document.createElement('canvas');c.width=900;c.height=1125;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,900,1125);g.addColorStop(0,'#fffdf9');g.addColorStop(1,color);x.fillStyle=g;x.fillRect(0,0,900,1125);x.fillStyle='#6a5b4c';x.font='700 28px system-ui';x.fillText('PUFF SOFT LAB',64,82);x.textAlign='right';x.font='500 20px system-ui';x.fillText(new Date().toLocaleDateString(),836,82);x.textAlign='center';x.font='700 54px system-ui';x.fillText('今天，也可以软一点',450,190);
  const rgb=hexToRgb(color),grad=x.createRadialGradient(390,420,40,450,520,290);grad.addColorStop(0,rgba(mix(rgb,30),1));grad.addColorStop(1,rgba(mix(rgb,-28),1));x.fillStyle=grad;x.beginPath();x.ellipse(450,535,240,215,0,0,Math.PI*2);x.fill();x.fillStyle='#56493f';x.beginPath();x.ellipse(380,500,9,14,0,0,Math.PI*2);x.ellipse(520,500,9,14,0,0,Math.PI*2);x.fill();x.strokeStyle='#56493f';x.lineWidth=5;x.beginPath();x.arc(450,555,38,0,Math.PI);x.stroke();x.font='700 30px system-ui';x.fillText('PUFF · '+count+' 次小快乐',450,842);x.font='400 22px system-ui';x.fillStyle='#8a7867';x.fillText('软糯程度 '+softness+' · 尺寸 '+sizePct+'%',450,887);x.font='400 22px system-ui';x.fillText('舒服一点，就很好。',450,1000);cardUrl=c.toDataURL('image/jpeg',.92);return cardUrl}
document.querySelector('#downloadCard').onclick=()=>{if(!cardUrl)return;const a=document.createElement('a');a.href=cardUrl;a.download='PUFF-'+new Date().toISOString().slice(0,10)+'.jpg';a.click();toast('收藏卡已生成')};
document.querySelector('#shareCard').onclick=async()=>{try{if(navigator.share)await navigator.share({title:'PUFF Soft Lab',text:'来捏捏这个小软物',url:location.href});else{await navigator.clipboard.writeText(location.href);toast('链接已复制')}}catch{}};
