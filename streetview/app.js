// ---------- Util: képelőtöltő (méret arányokhoz) ----------
class ImagePreloader {
  static async load(urls){
    const uniq = [...new Set(urls)];
    const meta = new Map();
    const jobs = uniq.map(u=>new Promise(res=>{
      const im = new Image();
      im.onload = ()=>{ meta.set(u, {w: im.naturalWidth, h: im.naturalHeight}); res(); };
      im.onerror = ()=>{ meta.set(u, {w: 512, h: 512}); res(); };
      im.src = u;
    }));
    await Promise.all(jobs);
    return meta;
  }
}

// ---------- Parallax réteg (pixel-snap) ----------
class BackgroundLayer {
  constructor(el){ this.el = el; this.speed = parseFloat(el.dataset.speed||'1'); }
  move(x){ const dx = Math.round(-x * this.speed); this.el.style.transform = `translate3d(${dx}px,0,0)`; }
}

// ---------- Eseménybusz ----------
class EventBus{
  constructor(){this.map=new Map();}
  on(ev,fn){(this.map.get(ev)||this.map.set(ev,[]).get(ev)).push(fn);}
  emit(ev,p){(this.map.get(ev)||[]).forEach(fn=>fn(p));}
}

// ---------- Ház: locked/unlocked kép + drop ----------
class House {
  constructor(cfg){
    this.id = cfg.id;
    this.x = cfg.x || 0;
    this.label = cfg.label || '';
    this.height = cfg.height || Street.DEFAULT_HOUSE_HEIGHT;
    this.nudgeY = cfg.nudgeY || 0;

    this.lockedImg   = cfg.lockedImg;    // fekete-fehér utcafront
    this.unlockedImg = cfg.unlockedImg;  // színes utcafront
    this.blueprintId = cfg.blueprintId || cfg.id; // melyik kártya nyitja

    this.locked = true;
    this.el = null;
  }

  build(imageMeta, bus){
    const el = document.createElement('div');
    el.className = 'house';
    const src = this.locked ? this.lockedImg : this.unlockedImg;

    // méretezés az épp aktuális képarány alapján
    let w, h;
    if(src && imageMeta.has(src)){
      const m = imageMeta.get(src); h = this.height; w = Math.round(h * (m.w/m.h));
    } else { h = this.height; w = 220; }
    Object.assign(el.style,{ width:`${w}px`, height:`${h}px`, left:`${this.x}px`, bottom:`${this.nudgeY}px` });
    if(src){ el.style.backgroundImage = `url('${src}')`; el.classList.add('hasImg'); }

    const st=document.createElement('div'); st.className='status'; st.textContent='match kész'; el.appendChild(st);
    el.classList.add('locked');
    el.title = this.label || 'Ház'; el.style.cursor='pointer';

    // belépés csak feloldás után
    el.addEventListener('click', ()=>{ if(this.locked) return; bus.emit('house:enter', this); });

    // drop terület
    el.addEventListener('dragenter', e=>{ e.preventDefault(); el.classList.add('highlight'); });
    el.addEventListener('dragover',  e=>{ e.preventDefault(); });
    el.addEventListener('dragleave', ()=>{ el.classList.remove('highlight'); });
    el.addEventListener('drop', e=>{
      e.preventDefault(); el.classList.remove('highlight');
      const bp = e.dataTransfer.getData('text/plain');
      if(bp === this.blueprintId){ this.unlock(imageMeta); bus.emit('blueprint:matched', this); }
    });

    this.el = el;
    return el;
  }

  unlock(imageMeta){
    if(!this.locked) return;
    this.locked = false;
    if(this.el){
      this.el.classList.remove('locked'); this.el.classList.add('matched');
      // képcsere: locked → unlocked
      if(this.unlockedImg){
        this.el.style.backgroundImage = `url('${this.unlockedImg}')`;
        // ha az arány eltér, méretet is újraszámolunk
        if(imageMeta && imageMeta.has(this.unlockedImg)){
          const m = imageMeta.get(this.unlockedImg);
          const h = parseInt(this.el.style.height,10);
          const w = Math.round(h * (m.w/m.h));
          this.el.style.width = `${w}px`;
        }
      }
    }
  }
}

// ---------- Blueprint tálca ----------
class BlueprintCard {
  constructor(cfg){ this.id=cfg.id; this.label=cfg.label; this.img=cfg.img; this.el=null; }
  build(){
    const el=document.createElement('div'); el.className='card'; el.setAttribute('draggable','true'); el.dataset.id=this.id;
    const th=document.createElement('div'); th.className='thumb'; th.style.backgroundImage=`url('${this.img}')`;
    const lb=document.createElement('div'); lb.className='label'; lb.textContent=this.label||this.id;
    el.appendChild(th); el.appendChild(lb);
    el.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', this.id); e.dataTransfer.effectAllowed='move'; });
    this.el=el; return el;
  }
}
class BlueprintTray {
  constructor(rowEl){ this.rowEl=rowEl; this.cards=[]; }
  set(list){ this.cards=list.map(b=>new BlueprintCard(b)); this.render(); }
  render(){ this.rowEl.innerHTML=''; this.cards.forEach(c=> this.rowEl.appendChild(c.build())); }
  remove(id){ const i=this.cards.findIndex(c=>c.id===id); if(i>-1){ this.cards[i].el.remove(); this.cards.splice(i,1);} }
}

// ---------- Utcajelenet ----------
class Street {
  static DEFAULT_HOUSE_HEIGHT = 260;
  constructor(opts){
    this.sceneWidth = opts.sceneWidth || 5200;
    this.housesCfg = opts.houses || [];
    this.bus = opts.bus;
    this.dom = {
      viewport: document.getElementById('viewport'),
      houses: document.getElementById('houses'),
      slider: document.getElementById('slider'),
      pos: document.getElementById('pos'),
      vw: document.getElementById('vw'),
      sw: document.getElementById('sw')
    };
    this.layers = Array.from(document.querySelectorAll('.layer')).map(el=>new BackgroundLayer(el));
    this.imageMeta = new Map();
    this.houses = [];
  }

  async preload(){
    const urls = [];
    this.housesCfg.forEach(h=>{
      if(h.lockedImg)   urls.push(h.lockedImg);
      if(h.unlockedImg) urls.push(h.unlockedImg);
      if(h.blueprintImg)urls.push(h.blueprintImg);
    });
    this.imageMeta = await ImagePreloader.load(urls);
  }

  build(){
    document.documentElement.style.setProperty('--scene-width', this.sceneWidth+'px');

    this.dom.houses.innerHTML='';
    this.houses = this.housesCfg.map(cfg=>{
      const h = new House(cfg);
      this.dom.houses.appendChild(h.build(this.imageMeta, this.bus));
      return h;
    });

    this.resize();
    this.dom.slider.addEventListener('input', ()=>this.applyCamera());
    window.addEventListener('resize', ()=>this.resize());

    // drag-pan
    this.dragging=false; this.dragStartX=0; this.dragStartVal=0;
    this.dom.viewport.addEventListener('mousedown', e=>{this.dragging=true; this.dragStartX=e.clientX; this.dragStartVal=parseInt(this.dom.slider.value)||0; this.dom.viewport.style.cursor='grabbing';});
    window.addEventListener('mouseup', ()=>{this.dragging=false; this.dom.viewport.style.cursor='default';});
    window.addEventListener('mousemove', e=>{
      if(!this.dragging) return;
      const delta=e.clientX-this.dragStartX; let v=this.dragStartVal-delta; const max=parseInt(this.dom.slider.max)||0;
      this.dom.slider.value=String(Math.max(0,Math.min(max,v))); this.applyCamera();
    });
  }

  resize(){
    const vw=this.dom.viewport.clientWidth;
    this.dom.vw.textContent=`${vw}×${this.dom.viewport.clientHeight}`;
    this.dom.sw.textContent=`${this.sceneWidth}px`;
    const max=Math.max(0,this.sceneWidth - vw);
    this.dom.slider.max=String(max);
    if(parseInt(this.dom.slider.value)>max) this.dom.slider.value=String(max);
    this.applyCamera();
  }

  applyCamera(){
    const x=parseInt(this.dom.slider.value)||0;
    this.layers.forEach(l=>l.move(x));
    const dx=Math.round(-x);
    this.dom.houses.style.transform=`translate3d(${dx}px,0,0)`;
    this.dom.pos.textContent=x;
  }
}

// ---------- Interior ----------
class InteriorView{
  constructor(bus){ this.bus=bus; this.el=null; this.keyHandler=this.onKey.bind(this); }
  mount(){
    if(this.el) return;
    const root=document.createElement('div'); root.className='interior';
    root.innerHTML=`
      <div class="topbar">
        <div class="btn" id="backBtn">⟵ Vissza az utcára (Esc)</div>
        <div class="title" id="title"></div>
      </div>
      <div class="room"><div class="bg" id="roomBg"></div></div>`;
    document.body.appendChild(root); this.el=root;
    this.el.querySelector('#backBtn').addEventListener('click', ()=>this.hide());
  }
  show(data){
    this.mount();
    const bg=this.el.querySelector('#roomBg'), title=this.el.querySelector('#title');
    title.textContent=data.title||'Belső tér';
    if(data.img){ bg.style.backgroundImage=`url('${data.img}')`; bg.style.backgroundColor='transparent'; }
    else { bg.style.backgroundImage='none'; bg.style.background='radial-gradient(#223,#111)'; }
    this.el.classList.add('visible'); window.addEventListener('keydown', this.keyHandler);
  }
  hide(){ if(!this.el) return; this.el.classList.remove('visible'); window.removeEventListener('keydown', this.keyHandler); this.bus.emit('interior:closed'); }
  onKey(e){ if(e.key==='Escape'||e.key==='Esc'||e.key==='Backspace'){ this.hide(); } }
}

// ---------- App / bootstrap ----------
class App {
  constructor(){
    this.bus = new EventBus();
    this.tray = new BlueprintTray(document.getElementById('bpRow'));

    // <<< ITT ÁLLÍTOD BE A SAJÁT KÉPEKET >>>
    this.street = new Street({
      sceneWidth: 5200,
      houses: [
        {
          id:'h1', x:200, label:'Ház 1', height:300,
          lockedImg:'h1_bw.png',     // fekete-fehér utcafront
          unlockedImg:'h1_color.png',// színes utcafront
          blueprintImg:'h1_bp.png'   // tálca képe
        }
      ],
      bus:this.bus
    });

    // belső nézet (opcionális külön képpel)
    this.interiors = {
      h1:{ title:'Ház 1 – előtér', img:'h1_interior.png' },
      h2:{ title:'Ház 2 – lépcsőház', img:'h2_interior.jpg' },
      h3:{ title:'Ház 3 – szoba', img:'h3_interior.jpg' }
    };

    this.interiorView = new InteriorView(this.bus);

    // belépés
    this.bus.on('house:enter', (house)=>{
      const data = this.interiors[house.id] || { title: house.label || 'Belső tér' };
      this.interiorView.show(data);
    });
    // sikeres párosítás után a kártyát eltávolítjuk
    this.bus.on('blueprint:matched', (house)=>{ this.tray.remove(house.id); });
  }

  async init(){
    await this.street.preload();
    this.street.build();

    // tálcát feltöltjük a megadott blueprint képekkel
    const blueprints = this.street.housesCfg.map(h=>({ id:h.id, label:h.label||h.id, img:h.blueprintImg }));
    this.tray.set(blueprints);
  }
}

window.addEventListener('DOMContentLoaded', ()=> new App().init());
