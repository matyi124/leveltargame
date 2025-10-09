// ===== Util =====
class ImagePreloader {
  static async load(urls){
    const uniq=[...new Set(urls)];
    const meta=new Map();
    await Promise.all(uniq.map(u=>new Promise(res=>{
      const im=new Image();
      im.onload=()=>{ meta.set(u,{w:im.naturalWidth,h:im.naturalHeight}); res(); };
      im.onerror=()=>{ meta.set(u,{w:512,h:512}); res(); };
      im.src=u;
    })));
    return meta;
  }
}
class BackgroundLayer {
  constructor(el){ this.el=el; this.speed=parseFloat(el.dataset.speed||'1'); }
  move(x){ const dx=Math.round(-x*this.speed); this.el.style.transform=`translate3d(${dx}px,0,0)`; }
}
class EventBus{ constructor(){this.m=new Map()} on(e,f){(this.m.get(e)||this.m.set(e,[]).get(e)).push(f)} emit(e,p){(this.m.get(e)||[]).forEach(fn=>fn(p))} }

// ===== House =====
class House {
  constructor({id,x=0,height=260,nudgeY=0,label}){
    this.id=id; this.x=x; this.height=height; this.nudgeY=nudgeY; this.label=label||id.toUpperCase();
    // filenames by convention
    this.imgBW=`${id}_bw.png`;
    this.imgColor=`${id}_color.png`;
    this.interior=`${id}_interior.png`;// eslint-disable-line
    this.unlocked=false;
    this.el=null;
  }
  build(meta,bus){
    const el=document.createElement('div');
    el.className='house locked';
    const src=this.unlocked?this.imgColor:this.imgBW;
    let w=this.height, h=this.height;
    if(meta.has(src)){ const m=meta.get(src); h=this.height; w=Math.round(h*(m.w/m.h)); }
    Object.assign(el.style,{left:`${this.x}px`, bottom:`${this.nudgeY}px`, width:`${w}px`, height:`${h}px`, backgroundImage:`url('${src}')`});
    el.classList.add('hasImg');
    el.dataset.id=this.id;
    el.title=this.label;
    el.addEventListener('click',()=>{ if(this.unlocked) bus.emit('house:enter', this); });
    this.el=el;
    return el;
  }
  setVisual(meta){
    if(!this.el) return;
    const src=this.unlocked?this.imgColor:this.imgBW;
    if(meta.has(src)){
      const m=meta.get(src); const h=parseInt(this.el.style.height,10); const w=Math.round(h*(m.w/m.h));
      this.el.style.width=`${w}px`;
    }
    this.el.style.backgroundImage=`url('${src}')`;
    this.el.classList.toggle('locked', !this.unlocked);
  }
  unlock(meta){ if(this.unlocked) return; this.unlocked=true; this.setVisual(meta); }
}

// ===== Blueprint tray =====
class BlueprintCard{
  constructor({id,img,label}){ this.id=id; this.img=img; this.label=label||id; this.el=null; }
  build(){
    const el=document.createElement('div'); el.className='bp-card'; el.draggable=true; el.dataset.id=this.id;
    const th=document.createElement('div'); th.className='thumb'; th.style.backgroundImage=`url('${this.img}')`;
    el.appendChild(th);
    el.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', this.id); e.dataTransfer.effectAllowed='move'; });
    this.el=el; return el;
  }
}
class BlueprintTray{
  constructor(rowEl){ this.rowEl=rowEl; this.cards=[]; }
  set(list){ this.cards=list.map(c=>new BlueprintCard(c)); this.render(); }
  render(){ this.rowEl.innerHTML=''; this.cards.forEach(c=>this.rowEl.appendChild(c.build())); }
  remove(id){ const i=this.cards.findIndex(c=>c.id===id); if(i>-1){ this.cards[i].el.remove(); this.cards.splice(i,1); } }
  isEmpty(){ return this.cards.length===0; }
}

// ===== Street (scene) =====
class Street {
  constructor({sceneWidth=5200, houses, bus}){
    this.sceneWidth=sceneWidth; this.bus=bus;
    this.dom={
      viewport:document.getElementById('viewport'),
      houses:document.getElementById('houses'),
      slider:document.getElementById('slider'),
      pos:document.getElementById('pos'),
      vw:document.getElementById('vw'),
      sw:document.getElementById('sw')
    };
    this.layers=Array.from(document.querySelectorAll('.layer')).map(el=>new BackgroundLayer(el));
    this.housesData=houses.map(cfg=>new House(cfg));
    this.imageMeta=new Map();
  }
  async preload(){
    const urls=[];
    this.housesData.forEach(h=>{ urls.push(h.imgBW,h.imgColor); });
    this.imageMeta=await ImagePreloader.load(urls);
  }
  build(){
    document.documentElement.style.setProperty('--scene-width', this.sceneWidth+'px');
    this.dom.houses.innerHTML='';
    this.housesData.forEach(h=>{ this.dom.houses.appendChild(h.build(this.imageMeta,this.bus)); });

    // drag-pan
    this.dragging=false; this.dragStartX=0; this.dragStartVal=0;
    this.dom.viewport.addEventListener('mousedown', e=>{this.dragging=true; this.dragStartX=e.clientX; this.dragStartVal=+this.dom.slider.value||0; this.dom.viewport.style.cursor='grabbing';});
    window.addEventListener('mouseup', ()=>{this.dragging=false; this.dom.viewport.style.cursor='default';});
    window.addEventListener('mousemove', e=>{
      if(!this.dragging) return; const delta=e.clientX-this.dragStartX; const max=+this.dom.slider.max||0;
      let v=this.dragStartVal-delta; v=Math.max(0,Math.min(max,v)); this.dom.slider.value=String(v); this.applyCamera();
    });

    // classic slider
    this.dom.slider.addEventListener('input', ()=>this.applyCamera());
    window.addEventListener('resize', ()=>this.resize());
    this.resize();

    // enable drop on houses (precíz) + lenient drop a viewporton
    this.housesData.forEach(h=>{
      const el=h.el;
      ['dragenter','dragover'].forEach(ev=> el.addEventListener(ev, e=>{e.preventDefault();}));
      el.addEventListener('drop', e=>{
        e.preventDefault();
        const bp=e.dataTransfer.getData('text/plain');
        if(bp===h.id) this.bus.emit('blueprint:match',{house:h});
      });
    });
    // lenient: ha nem direkt a házra dobták, nézzük meg a legközelebbi házat
    ['dragover','drop'].forEach(ev=>{
      this.dom.viewport.addEventListener(ev, e=>{
        e.preventDefault();
        if(ev!=='drop') return;
        const bp=e.dataTransfer.getData('text/plain'); if(!bp) return;
        const pt={x:e.clientX, y:e.clientY};
        const nearest=this._nearestHouseAtScreenPoint(pt);
        if(nearest && nearest.house.id===bp && nearest.dist<=150){ // 150px engedékenység
          this.bus.emit('blueprint:match',{house:nearest.house});
        }
      });
    });
  }
  _nearestHouseAtScreenPoint(pt){
    // számoljuk a házok bounding rectjét és keressük a legkisebb távolságot a középponthoz
    let best=null;
    this.housesData.forEach(h=>{
      const r=h.el.getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;
      const dx=cx-pt.x, dy=cy-pt.y;
      const d=Math.hypot(dx,dy);
      if(!best || d<best.dist) best={house:h, dist:d};
    });
    return best;
  }
  resize(){
    const vw=this.dom.viewport.clientWidth;
    this.dom.vw.textContent=`${vw}×${this.dom.viewport.clientHeight}`;
    this.dom.sw.textContent=`${this.sceneWidth}px`;
    const max=Math.max(0,this.sceneWidth - vw);
    this.dom.slider.max=String(max);
    if(+this.dom.slider.value>max) this.dom.slider.value=String(max);
    this.applyCamera();
  }
  applyCamera(){
    const x=+this.dom.slider.value||0;
    this.layers.forEach(l=>l.move(x));
    this.dom.houses.style.transform=`translate3d(${-Math.round(x)}px,0,0)`;
    this.dom.pos.textContent=x;
  }
  unlockHouse(id){
    const h=this.housesData.find(x=>x.id===id); if(!h) return;
    h.unlock(this.imageMeta);
  }
  allUnlocked(){ return this.housesData.every(h=>h.unlocked); }
}

// ===== Interior (opcionális) =====
class InteriorView{
  constructor(bus){ this.bus=bus; this.el=null; this.key=this.onKey.bind(this); }
  mount(){
    if(this.el) return;
    const root=document.createElement('div'); root.className='interior';
    root.innerHTML=`<div class="topbar"><div class="btn" id="backBtn">⟵ Vissza (Esc)</div><div class="title" id="title"></div></div>
    <div class="room"><div class="bg" id="bg"></div></div>`;
    document.body.appendChild(root); this.el=root;
    root.querySelector('#backBtn').addEventListener('click',()=>this.hide());
  }
  show({title,img}){
    this.mount();
    this.el.querySelector('#title').textContent=title||'Belső tér';
    const bg=this.el.querySelector('#bg');
    if(img){ bg.style.backgroundImage=`url('${img}')`; bg.style.backgroundSize='contain'; }
    this.el.classList.add('visible'); window.addEventListener('keydown', this.key);
  }
  hide(){ if(!this.el) return; this.el.classList.remove('visible'); window.removeEventListener('keydown', this.key); }
  onKey(e){ if(e.key==='Escape'||e.key==='Esc') this.hide(); }
}

// ===== App =====
class App{
  constructor(){
    this.bus=new EventBus();
    this.dom={
      viewport:document.getElementById('viewport'),
      bpPanel:document.getElementById('bpPanel'),
      bpRow:document.getElementById('bpRow'),
    };

    // --- KONFIG: házak (id + x + height); képek fájlnevei az id alapján automatikusak (h1_bw.png, h1_color.png, h1_bp.png, h1_interior.png)
    this.housesCfg=[
      { id:'h1', x: 300, height: 300, label:'Ház 1' },
      // további házak később: { id:'h2', x: 760, height: 320 }, stb.
    ];

    // scene
    this.street=new Street({sceneWidth:5200, houses:this.housesCfg, bus:this.bus});
    this.interior=new InteriorView(this.bus);

    // blueprint tálca
    this.tray=new BlueprintTray(this.dom.bpRow);

    // events
    this.bus.on('house:enter', (house)=>{
      if(!house.unlocked) return;
      this.interior.show({ title: house.label || house.id.toUpperCase(), img: `${house.id}_interior.png` });
    });
    this.bus.on('blueprint:match', ({house})=>{
      // match → feloldás + tálcából kivétel
      this.street.unlockHouse(house.id);
      this.tray.remove(house.id);
      // ha minden feloldva → vissza normál utcamód
      if(this.tray.isEmpty()){
        document.body.classList.remove('mode-blueprints');
      }
    });
  }

  async init(){
    // preload
    await this.street.preload();
    this.street.build();

    // tálca feltöltése blueprint képekkel
    const blueprints=this.housesCfg.map(h=>({ id:h.id, img:`${h.id}_bp.png`, label:h.label||h.id.toUpperCase() }));
    this.tray.set(blueprints);

    // ha van még blueprint → blueprint mód (fél-fél layout + háttér elrejtve)
    if(!this.tray.isEmpty()){
      document.body.classList.add('mode-blueprints');
    }
  }
}

window.addEventListener('DOMContentLoaded', ()=> new App().init());
