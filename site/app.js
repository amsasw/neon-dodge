(function(){
'use strict';

function $(s){return document.querySelector(s)}
function $$(s){return Array.from(document.querySelectorAll(s))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function lerp(a,b,t){return a+(b-a)*t}
function safeGet(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch{return d}}
function safeSet(k,v){try{localStorage.setItem(k,String(v))}catch{}}

const canvas=$('#toy'),fx=$('#fx'),stage=$('#stage');
const ctx=canvas&&canvas.getContext('2d'),fctx=fx&&fx.getContext('2d');
if(!canvas||!fx||!stage||!ctx||!fctx){document.body.innerHTML='<p style="padding:40px">Canvas 初始化失败，请刷新页面。</p>';return}

const shadow=$('#shadow'),speech=$('#speech'),mood=$('#mood'),hint=$('#hint'),toastEl=$('#toast');
const comboEl=$('#combo'),levelEl=$('#level'),bestComboEl=$('#bestCombo'),achievementEl=$('#achievement');
let w=0,h=0,dpr=1,mode='squish',color='#f1d7c3',softness=74,sizePct=100;
let soundOn=false,audioCtx=null,pressed=false,pointerId=null,lastPX=0,lastPY=0,lastPT=0,dragVX=0,dragVY=0;
let count=Number(safeGet('puff-count',0))||0,interactions=Number(safeGet('puff-interactions',0))||0,bestCombo=Number(safeGet('puff-best-combo',0))||0;
let combo=0,lastInteraction=0,comboTimer=0,party=false,partyTimer=0,idleTimer=0,lastFrame=performance.now();
let particles=[];

const state={x:0,y:0,vx:0,vy:0,sx:1,sy:1,rot:0,press:0,wobble:0,smile:0,blink:0,lookX:0,lookY:0,flying:false};
const target={x:0,y:0,sx:1,sy:1,rot:0,press:0,wobble:0,smile:0,lookX:0,lookY:0};

$('#count').textContent=count;
bestComboEl.textContent='BEST x'+bestCombo;
updateLevel();

function resize(){
  const r=stage.getBoundingClientRect();
  w=Math.max(320,r.width);h=Math.max(520,r.height);dpr=Math.min(window.devicePixelRatio||1,2);
  [canvas,fx].forEach(c=>{c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);c.style.width=w+'px';c.style.height=h+'px'});
  ctx.setTransform(dpr,0,0,dpr,0,0);fctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize',resize);resize();

function rgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
function shift(c,n){return c.map(v=>clamp(v+n,0,255))}
function rgba(c,a){return 'rgba('+Math.round(c[0])+','+Math.round(c[1])+','+Math.round(c[2])+','+a+')'}
function bodyRadius(){return Math.min(w,h)*(innerWidth<760?.205:.235)*(sizePct/100)}
function center(){return{x:w/2+state.x,y:h*.55+state.y}}

function drawEar(x,y,r,side,base,light){
  ctx.save();ctx.translate(x,y);ctx.rotate(side*(.18+state.rot*.4));ctx.scale(state.sx,state.sy);
  ctx.beginPath();ctx.moveTo(0,r*.38);ctx.bezierCurveTo(side*r*.72,-r*.18,side*r*.62,-r*1.12,0,-r*1.18);ctx.bezierCurveTo(-side*r*.38,-r*.62,-side*r*.26,.08*r,0,r*.38);ctx.closePath();
  const g=ctx.createLinearGradient(0,-r,0,r*.4);g.addColorStop(0,rgba(light,1));g.addColorStop(1,rgba(base,1));ctx.fillStyle=g;ctx.shadowColor='rgba(104,78,62,.10)';ctx.shadowBlur=10;ctx.fill();ctx.shadowColor='transparent';
  ctx.beginPath();ctx.moveTo(0,r*.15);ctx.bezierCurveTo(side*r*.30,-r*.2,side*r*.26,-r*.78,0,-r*.83);ctx.bezierCurveTo(-side*r*.12,-r*.45,-side*r*.08,-r*.05,0,r*.15);ctx.fillStyle='rgba(220,132,145,.22)';ctx.fill();ctx.restore();
}

function drawArm(cx,cy,r,side,base,light){
  ctx.save();ctx.translate(cx+side*r*.78,cy+r*.12);ctx.rotate(side*(-.35+state.wobble*.12*Math.sin(performance.now()/90)));ctx.scale(state.sx,state.sy);
  const g=ctx.createLinearGradient(0,-r*.1,side*r*.42,r*.38);g.addColorStop(0,rgba(light,1));g.addColorStop(1,rgba(base,1));ctx.fillStyle=g;
  ctx.beginPath();ctx.ellipse(0,0,r*.17,r*.35,side*.45,0,Math.PI*2);ctx.fill();ctx.restore();
}

function drawFoot(cx,cy,r,side,base){
  ctx.save();ctx.translate(cx+side*r*.35,cy+r*.79);ctx.rotate(side*.08);ctx.scale(state.sx,state.sy);
  ctx.beginPath();ctx.ellipse(0,0,r*.30,r*.17,0,0,Math.PI*2);ctx.fillStyle=rgba(shift(base,-7),1);ctx.fill();ctx.restore();
}

function drawCharacter(t){
  ctx.clearRect(0,0,w,h);
  const c=center(),r=bodyRadius(),base=rgb(color),light=shift(base,27),dark=shift(base,-28);
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(state.rot);ctx.translate(-c.x,-c.y);

  drawEar(c.x-r*.42,c.y-r*.57,r*.58,-1,base,light);
  drawEar(c.x+r*.42,c.y-r*.57,r*.58,1,base,light);
  drawFoot(c.x,c.y,r,-1,base);drawFoot(c.x,c.y,r,1,base);
  drawArm(c.x,c.y,r,-1,base,light);drawArm(c.x,c.y,r,1,base,light);

  ctx.save();ctx.translate(c.x,c.y);ctx.scale(state.sx,state.sy);ctx.translate(-c.x,-c.y);
  const grad=ctx.createRadialGradient(c.x-r*.34,c.y-r*.43,r*.12,c.x,c.y,r*1.08);
  grad.addColorStop(0,rgba(shift(light,13),1));grad.addColorStop(.46,rgba(base,1));grad.addColorStop(1,rgba(dark,1));
  ctx.beginPath();
  ctx.moveTo(c.x,c.y-r*.82);
  ctx.bezierCurveTo(c.x+r*.67,c.y-r*.78,c.x+r*.92,c.y-r*.25,c.x+r*.78,c.y+r*.35);
  ctx.bezierCurveTo(c.x+r*.67,c.y+r*.88,c.x+r*.24,c.y+r*.98,c.x,c.y+r*.91);
  ctx.bezierCurveTo(c.x-r*.24,c.y+r*.98,c.x-r*.67,c.y+r*.88,c.x-r*.78,c.y+r*.35);
  ctx.bezierCurveTo(c.x-r*.92,c.y-r*.25,c.x-r*.67,c.y-r*.78,c.x,c.y-r*.82);
  ctx.closePath();
  ctx.shadowColor='rgba(91,66,52,.16)';ctx.shadowBlur=26;ctx.shadowOffsetY=14;ctx.fillStyle=grad;ctx.fill();ctx.shadowColor='transparent';

  const shine=ctx.createRadialGradient(c.x-r*.35,c.y-r*.44,0,c.x-r*.35,c.y-r*.44,r*.52);
  shine.addColorStop(0,'rgba(255,255,255,.52)');shine.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=shine;ctx.beginPath();ctx.ellipse(c.x-r*.18,c.y-r*.24,r*.52,r*.65,-.25,0,Math.PI*2);ctx.fill();

  ctx.fillStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.ellipse(c.x,c.y+r*.32,r*.47,r*.35,0,0,Math.PI*2);ctx.fill();

  const faceY=c.y-r*.06;
  const eyeGap=r*.28,eyeY=faceY-r*.13,blink=clamp(state.blink,0,1);
  for(const side of [-1,1]){
    const ex=c.x+side*eyeGap;
    ctx.fillStyle='rgba(72,55,52,.92)';ctx.beginPath();ctx.ellipse(ex,eyeY,r*.075,r*.095*(1-blink)+1.2,0,0,Math.PI*2);ctx.fill();
    if(blink<.75){
      ctx.fillStyle='rgba(255,255,255,.92)';ctx.beginPath();ctx.arc(ex-r*.022+state.lookX*r*.016,eyeY-r*.028+state.lookY*r*.014,r*.024,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.58)';ctx.beginPath();ctx.arc(ex+r*.026+state.lookX*r*.012,eyeY+r*.02+state.lookY*r*.012,r*.012,0,Math.PI*2);ctx.fill();
    }
  }

  ctx.fillStyle='rgba(225,119,133,.20)';for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(c.x+side*r*.48,faceY+r*.09,r*.13,r*.07,0,0,Math.PI*2);ctx.fill()}
  ctx.strokeStyle='rgba(91,63,58,.78)';ctx.lineWidth=Math.max(2,r*.018);ctx.lineCap='round';ctx.beginPath();
  if(state.smile>.45){ctx.arc(c.x,faceY+r*.10,r*.11,0,Math.PI)}
  else{ctx.moveTo(c.x-r*.055,faceY+r*.13);ctx.quadraticCurveTo(c.x,faceY+r*(.16+state.press*.05),c.x+r*.055,faceY+r*.13)}
  ctx.stroke();

  ctx.fillStyle='rgba(255,255,255,.60)';ctx.beginPath();ctx.ellipse(c.x-r*.36,c.y-r*.47,r*.15,r*.07,-.6,0,Math.PI*2);ctx.fill();
  ctx.restore();ctx.restore();

  shadow.style.transform='translate('+state.x*.72+'px,'+state.y*.13+'px) scale('+clamp(state.sx,.72,1.42)+','+clamp(1+state.y/r*.12,.7,1.2)+')';
  shadow.style.opacity=String(clamp(.72+state.y/r*.18,.25,.9));
}

function drawFx(dt){
  fctx.clearRect(0,0,w,h);particles=particles.filter(p=>p.life>0);
  for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.g*dt;p.rot+=p.spin*dt;fctx.save();fctx.globalAlpha=clamp(p.life/p.max,0,1);fctx.translate(p.x,p.y);fctx.rotate(p.rot);fctx.font=p.size+'px system-ui';fctx.textAlign='center';fctx.textBaseline='middle';fctx.fillStyle=p.color;fctx.fillText(p.char,0,0);fctx.restore()}
}
function burst(x,y,n){const chars=['✦','♡','●','○'];const colors=['#e07a8a','#9c86d5','#65a6a1','#d9a55d','#8f786b'];for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=45+Math.random()*150;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-45,g:120,life:.7+Math.random()*.6,max:1.3,char:chars[(Math.random()*chars.length)|0],color:colors[(Math.random()*colors.length)|0],size:8+Math.random()*13,rot:Math.random()*6,spin:(Math.random()-.5)*6})}}

let blinkAt=performance.now()+1800;
function frame(now){
  const dt=Math.min((now-lastFrame)/1000,.034);lastFrame=now;
  const spring=1-Math.pow(.001,dt*(.7+(100-softness)/90));
  ['sx','sy','rot','press','wobble','smile','lookX','lookY'].forEach(k=>state[k]=lerp(state[k],target[k],spring));
  if(!state.flying){state.x=lerp(state.x,target.x,spring);state.y=lerp(state.y,target.y,spring)}
  else{
    state.vy+=760*dt;state.x+=state.vx*dt;state.y+=state.vy*dt;state.rot=clamp(state.vx*.0012,-.36,.36);
    const floor=h*.17,limit=w*.33;
    if(Math.abs(state.x)>limit){state.x=clamp(state.x,-limit,limit);state.vx*=-.55;pop(130)}
    if(state.y>floor){state.y=floor;state.vy*=-.48;burst(w/2+state.x,h*.72,7);pop(100);if(Math.abs(state.vy)<70){state.flying=false;target.x=state.x=0;target.y=state.y=0;target.rot=0}}
  }
  if(!pressed&&now>blinkAt){state.blink=Math.sin(Math.min(Math.PI,(now-blinkAt)/135*Math.PI));if(now-blinkAt>270){state.blink=0;blinkAt=now+2200+Math.random()*3000}}
  drawCharacter(now);drawFx(dt);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function say(text,sub){speech.textContent=text;mood.textContent=sub||'今天心情软乎乎';speech.classList.remove('pop');void speech.offsetWidth;speech.classList.add('pop')}
function resetPose(){state.flying=false;state.vx=state.vy=0;target.x=target.y=target.rot=0;target.sx=target.sy=1;target.press=target.wobble=target.smile=0}
function updateLevel(){levelEl.textContent='PUFF Lv.'+(Math.floor(interactions/10)+1)}
function register(){
  const now=performance.now();combo=now-lastInteraction<1700?combo+1:1;lastInteraction=now;interactions++;safeSet('puff-interactions',interactions);updateLevel();
  if(combo>bestCombo){bestCombo=combo;safeSet('puff-best-combo',bestCombo);bestComboEl.textContent='BEST x'+bestCombo}
  comboEl.querySelector('b').textContent='x'+combo;comboEl.classList.add('show');clearTimeout(comboTimer);comboTimer=setTimeout(()=>{combo=0;comboEl.classList.remove('show')},1800);
  if(combo===5||combo===10||combo===20){const c=center();burst(c.x,c.y,combo===20?34:20);say('连击 x'+combo+'！',combo>=10?'已经开心到变形了':'开始上头了');chirp()}
  if(interactions===10)achievementEl.textContent='ACHIEVEMENT · PUFF FRIEND';
  if(interactions===30)achievementEl.textContent='ACHIEVEMENT · SQUISH MASTER';
  scheduleIdle();
}

function localPoint(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
function hit(p){const c=center(),r=bodyRadius();return Math.hypot((p.x-c.x)/(r*1.05),(p.y-c.y)/(r*1.12))<1.35}
function pointerDown(e){
  const p=localPoint(e);if(!hit(p)){target.lookX=clamp((p.x-w/2)/160,-1,1);target.lookY=clamp((p.y-h*.55)/160,-1,1);burst(p.x,p.y,4);return}
  e.preventDefault();pressed=true;pointerId=e.pointerId;canvas.setPointerCapture?.(e.pointerId);lastPX=p.x;lastPY=p.y;lastPT=performance.now();register();
  if(mode==='squish'){target.sx=1.18;target.sy=.77;target.press=1;target.smile=.35;say(['噗叽！','脸要扁啦！','再轻一点点～'][(Math.random()*3)|0],'被你捏成奶冻了');pop(230)}
  if(mode==='stretch'){target.press=.35;target.smile=.15;say('慢慢拉，我很有弹性的。','准备变成长条');pop(340)}
  if(mode==='tickle'){target.wobble=1;target.smile=1;say('哈哈哈哈，痒！','已经笑得站不稳了');chirp()}
  if(mode==='toss'){target.sx=1.04;target.sy=.91;say('等等，你不会要扔我吧？','突然紧张');pop(180)}
}
function pointerMove(e){
  const p=localPoint(e);
  if(!pressed){const c=center(),r=bodyRadius();target.lookX=clamp((p.x-c.x)/(r*1.3),-1,1);target.lookY=clamp((p.y-c.y)/(r*1.3),-1,1);return}
  if(e.pointerId!==pointerId)return;e.preventDefault();
  const now=performance.now(),dt=Math.max(16,now-lastPT),dx=p.x-lastPX,dy=p.y-lastPY;dragVX=dx/dt*1000;dragVY=dy/dt*1000;lastPX=p.x;lastPY=p.y;lastPT=now;
  target.x=clamp(target.x+dx,-w*.32,w*.32);target.y=clamp(target.y+dy,-h*.23,h*.18);
  if(mode==='stretch'){const mag=clamp(Math.hypot(dx,dy)/45+Math.hypot(target.x,target.y)/300,0,1);target.sx=1+.42*mag;target.sy=1-.20*mag;target.rot=clamp(target.x*.001,-.28,.28)}
  if(mode==='tickle'){target.rot=Math.sin(now/55)*.11;target.wobble=1;target.smile=1;if(Math.random()<.08){const c=center();burst(c.x+(Math.random()-.5)*80,c.y+(Math.random()-.5)*70,2)}}
}
function pointerUp(e){
  if(!pressed||e.pointerId!==pointerId)return;e.preventDefault();pressed=false;canvas.releasePointerCapture?.(e.pointerId);
  if(mode==='toss'&&Math.hypot(dragVX,dragVY)>150){state.flying=true;state.vx=dragVX*.65;state.vy=dragVY*.72;target.wobble=.55;say('哇——！','正在努力优雅落地');pop(410)}
  else{target.sx=target.sy=1;target.press=target.wobble=target.rot=target.smile=0;target.x=target.y=0;pop(175)}
}
canvas.addEventListener('pointerdown',pointerDown,{passive:false});
canvas.addEventListener('pointermove',pointerMove,{passive:false});
canvas.addEventListener('pointerup',pointerUp,{passive:false});
canvas.addEventListener('pointercancel',pointerUp,{passive:false});
canvas.addEventListener('dblclick',()=>{register();surprise()});

$$('.tool').forEach(btn=>btn.addEventListener('click',()=>{
  mode=btn.dataset.mode;$$('.tool').forEach(x=>x.classList.toggle('active',x===btn));resetPose();
  hint.textContent={squish:'直接点角色；按住拖动也可以',stretch:'抓住角色往外拉，松手会弹回去',tickle:'按住角色来回移动，挠它痒痒',toss:'抓住角色快速一甩，把它抛起来'}[mode];
  say({squish:'来捏我吧。',stretch:'看看我能拉多长。',tickle:'不许挠肚子！',toss:'我有不好的预感……'}[mode],'玩法已切换');pop(420)
}));

$('#reset').addEventListener('click',()=>{resetPose();say('回到最舒服的位置啦。','重新站稳')});
$('#surprise').addEventListener('click',()=>{register();surprise()});
function surprise(){const lines=[['送你一颗看不见的小糖。','偷偷开心'],['今天可以慢一点。','认真点头'],['检测到你很可爱。','系统判断完成'],['不要再点了……骗你的。','其实还想玩']];const x=lines[(Math.random()*lines.length)|0];target.sx=.88;target.sy=1.18;target.wobble=.7;target.smile=1;say(x[0],x[1]);const c=center();burst(c.x,c.y,18);chirp();setTimeout(()=>{target.sx=target.sy=1;target.wobble=target.smile=0},850)}

function openDialog(d){if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','')}
function closeDialog(d){if(typeof d.close==='function')d.close();else d.removeAttribute('open')}
$('#settingsBtn').addEventListener('click',()=>openDialog($('#settings')));
$('#closeSettings').addEventListener('click',()=>closeDialog($('#settings')));
$('#doneSettings').addEventListener('click',()=>closeDialog($('#settings')));
$$('.swatch').forEach(b=>b.addEventListener('click',()=>{color=b.dataset.color;$$('.swatch').forEach(x=>x.classList.toggle('selected',x===b));register();pop(390)}));
$('#softness').addEventListener('input',e=>{softness=Number(e.target.value);$('#softOut').textContent=softness});
$('#size').addEventListener('input',e=>{sizePct=Number(e.target.value);$('#sizeOut').textContent=sizePct+'%'});

$('#party').addEventListener('click',toggleParty);
function toggleParty(){party=!party;document.body.classList.toggle('party',party);$('#party').setAttribute('aria-pressed',String(party));clearInterval(partyTimer);if(party){say('派对模式启动 ✦','理智暂时离线');partyTimer=setInterval(()=>{const c=center();burst(c.x+(Math.random()-.5)*180,c.y+(Math.random()-.5)*100,7)},480);chirp()}else say('呼，安静下来了。','恢复正常')}

$('#sound').addEventListener('click',async e=>{soundOn=!soundOn;if(soundOn){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();await audioCtx.resume()}catch{soundOn=false}}e.currentTarget.setAttribute('aria-pressed',String(soundOn));e.currentTarget.querySelector('span').textContent=soundOn?'声音开':'声音关';if(soundOn)chirp()});
function pop(freq){if(!soundOn||!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime;o.type='sine';o.frequency.setValueAtTime(freq||220,t);o.frequency.exponentialRampToValueAtTime(Math.max(80,(freq||220)*.5),t+.13);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.08,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+.16)}
function chirp(){if(!soundOn||!audioCtx)return;[520,680,850].forEach((f,i)=>setTimeout(()=>pop(f),i*65))}

function scheduleIdle(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>{if(pressed||state.flying){scheduleIdle();return}const acts=[
()=>{target.sy=.74;target.sx=1.16;target.y=28;say('我先融化一下……','奶冻模式');setTimeout(resetPose,1300)},
()=>{target.wobble=1;target.sy=1.12;say('哈啾！','自己吓自己一跳');const c=center();burst(c.x,c.y-60,8);setTimeout(resetPose,750)},
()=>{target.smile=1;target.lookX=1;say('你还在吗？','偷偷确认你没走');setTimeout(resetPose,1200)}
];acts[(Math.random()*acts.length)|0]();scheduleIdle()},6500+Math.random()*6500)}
scheduleIdle();

window.addEventListener('keydown',e=>{if(e.target&&/input|button/i.test(e.target.tagName))return;if(e.code==='Space'&&!e.repeat){e.preventDefault();register();target.sx=1.18;target.sy=.76;target.press=1;say('键盘也可以捏！','被 Space 压扁了');pop(230)}if(e.key.toLowerCase()==='p')toggleParty();if(e.key.toLowerCase()==='s'){register();surprise()}const d=34;if(e.key==='ArrowLeft')target.x-=d;if(e.key==='ArrowRight')target.x+=d;if(e.key==='ArrowUp')target.y-=d;if(e.key==='ArrowDown')target.y+=d});
window.addEventListener('keyup',e=>{if(e.code==='Space'){target.sx=target.sy=1;target.press=0}});

function toast(s){toastEl.textContent=s;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),1500)}
$('#collect').addEventListener('click',()=>{register();count++;safeSet('puff-count',count);$('#count').textContent=count;$('#cardImage').src=makeCard();openDialog($('#cardDialog'));chirp()});
$('#closeCard').addEventListener('click',()=>closeDialog($('#cardDialog')));
let cardUrl='';
function makeCard(){const c=document.createElement('canvas');c.width=900;c.height=1125;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,900,1125);g.addColorStop(0,'#fffdf9');g.addColorStop(1,color);x.fillStyle=g;x.fillRect(0,0,900,1125);x.fillStyle='#6a554d';x.font='700 28px system-ui';x.fillText('PUFF SOFT LAB',64,82);x.textAlign='right';x.font='500 20px system-ui';x.fillText(new Date().toLocaleDateString(),836,82);x.textAlign='center';x.font='700 54px system-ui';x.fillText('今天，把世界捏软了一点',450,190);const b=rgb(color),gg=x.createRadialGradient(360,410,20,450,530,290);gg.addColorStop(0,rgba(shift(b,30),1));gg.addColorStop(1,rgba(shift(b,-25),1));x.fillStyle=gg;x.beginPath();x.ellipse(450,535,225,240,0,0,Math.PI*2);x.fill();x.fillStyle='#59433f';x.beginPath();x.ellipse(380,500,16,22,0,0,Math.PI*2);x.ellipse(520,500,16,22,0,0,Math.PI*2);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(374,493,5,0,Math.PI*2);x.arc(514,493,5,0,Math.PI*2);x.fill();x.strokeStyle='#6a4d48';x.lineWidth=5;x.beginPath();x.arc(450,558,38,0,Math.PI);x.stroke();x.fillStyle='#6a554d';x.font='700 30px system-ui';x.fillText('PUFF · '+count+' 次小快乐',450,850);x.font='400 22px system-ui';x.fillStyle='#8d786f';x.fillText('最高连击 x'+bestCombo+' · Lv.'+(Math.floor(interactions/10)+1),450,895);x.fillText('今天舒服一点，就很好。',450,1005);cardUrl=c.toDataURL('image/jpeg',.93);return cardUrl}
$('#downloadCard').addEventListener('click',()=>{if(!cardUrl)return;const a=document.createElement('a');a.href=cardUrl;a.download='PUFF-'+new Date().toISOString().slice(0,10)+'.jpg';a.click();toast('收藏卡已生成')});
$('#shareCard').addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:'PUFF Soft Lab',text:'来摸摸 PUFF',url:location.href});else if(navigator.clipboard){await navigator.clipboard.writeText(location.href);toast('链接已复制')}}catch{}});

window.addEventListener('error',()=>toast('脚本遇到问题，请刷新页面'));
say('点我一下试试 ✦','今天心情软乎乎');
})();