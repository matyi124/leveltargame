// --- Util: képelőtöltő ---
class ImagePreloader {
  static async load(urls){
    const meta = new Map();
    const jobs = urls.map(u=>new Promise(res=>{
      const im = new Image();
      im.onload = ()=>{ meta.set(u, {w: im.naturalWidth, h: im.naturalHeight}); res(); };
      im.onerror = ()=>{ meta.set(u, {w: 512, h: 512}); res(); };
      im.src = u;
    }));
    await Promise.all(jobs);
    return meta;
  }
}

// --- Háttérréteg ---
class BackgroundLayer {
  constructor(el){ this.el = el; this.speed = parseFloat(el.dataset.speed||'1'); }
  // PIXEL-SNAPPING: kerekítjük a parallax eltolást, hogy ne legyenek 1px-es illesztési csíkok
  move(x){ const dx = Math.round(-x * this.speed); this.el.style.transform = `translate3d(${dx}px,0,0)`; }
}

// --- Eseménybusz ---
class EventBus{ constructor(){this.map=new Map();} on(ev,fn){(this.map.get(ev)||this.map.set(ev,[]).get(ev)).push(fn);} emit(ev,p){(this.map.get(ev)||[]).forEach(fn=>fn(p));} }

// --- Ház ---
class House {
  constructor(cfg){
    this.id = cfg.id || ('h_'+Math.random().toString(36).slice(2,8));
    this.x = cfg.x || 0;
    this.img = cfg.img || null;
    this.label = cfg.label || '';
    this.height = cfg.height || Street.DEFAULT_HOUSE_HEIGHT;
    this.nudgeY = cfg.nudgeY || 0; // finom ülés
    this.el = null;
  }
  build(imageMeta, bus){
    const el = document.createElement('div');
    el.className = 'house';
    let w, h;
    if(this.img && imageMeta.has(this.img)){
      const m = imageMeta.get(this.img); h = this.height; w = Math.round(h * (m.w/m.h));
    } else { h = this.height; w = 220; }
    el.style.width = w+'px'; el.style.height = h+'px';
    el.style.left = this.x+'px'; el.style.bottom = this.nudgeY+'px';
    if(this.img){ el.style.backgroundImage = `url('${this.img}')`; el.classList.add('hasImg'); }
    el.title = this.label || 'Ház';
    el.style.cursor = 'pointer';
    el.addEventListener('click', ()=> bus && bus.emit('house:enter', this));
    this.el = el; return el;
  }
}

// --- Utcajelenet ---
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
    const urls = this.housesCfg.filter(h=>h.img).map(h=>h.img);
    this.imageMeta = await ImagePreloader.load(urls);
  }
  build(){
    // állandó értékek
    document.documentElement.style.setProperty('--scene-width', this.sceneWidth+'px');

    // házak
    this.dom.houses.innerHTML = '';
    this.houses = this.housesCfg.map(cfg=>{
      const h = new House(cfg);
      this.dom.houses.appendChild(h.build(this.imageMeta, this.bus));
      return h;
    });

    // UI értékek
    this.resize();
    this.dom.slider.addEventListener('input', ()=>this.applyCamera());
    window.addEventListener('resize', ()=>this.resize());

    // Egérhúzás a viewporton
    this.dragging = false; this.dragStartX = 0; this.dragStartVal = 0;
    this.dom.viewport.addEventListener('mousedown', e=>{this.dragging=true; this.dragStartX=e.clientX; this.dragStartVal=parseInt(this.dom.slider.value)||0; this.dom.viewport.style.cursor='grabbing';});
    window.addEventListener('mouseup', ()=>{this.dragging=false; this.dom.viewport.style.cursor='default';});
    window.addEventListener('mousemove', e=>{
      if(!this.dragging) return; const delta = (e.clientX - this.dragStartX);
      let v = this.dragStartVal - delta; const max = parseInt(this.dom.slider.max)||0; if(v<0) v=0; if(v>max) v=max;
      this.dom.slider.value = String(v); this.applyCamera();
    });
  }
  resize(){
    const vw = this.dom.viewport.clientWidth;
    this.dom.vw.textContent = `${vw}×${this.dom.viewport.clientHeight}`;
    this.dom.sw.textContent = `${this.sceneWidth}px`;
    const max = Math.max(0, this.sceneWidth - vw);
    this.dom.slider.max = String(max);
    if(parseInt(this.dom.slider.value) > max) this.dom.slider.value = String(max);
    this.applyCamera();
  }
  applyCamera(){
    const x = parseInt(this.dom.slider.value)||0;
    this.layers.forEach(l=>l.move(x));
    // PIXEL-SNAPPING az előtérre is
    const dx = Math.round(-x);
    this.dom.houses.style.transform = `translate3d(${dx}px,0,0)`;
    this.dom.pos.textContent = x;
  }
}

// --- Interior nézet ---
class InteriorView{
  constructor(bus, options){
    this.bus = bus; this.options = options||{}; this.el = null; this.keyHandler = this.onKey.bind(this);
  }
  mount(){
    if(this.el) return; const root = document.createElement('div'); root.className='interior';
    root.innerHTML = `
      <div class="topbar">
        <div class="btn" id="backBtn">⟵ Vissza az utcára (Esc)</div>
        <div class="title" id="title"></div>
      </div>
      <div class="room"><div class="bg" id="roomBg"></div></div>`;
    document.body.appendChild(root); this.el = root;
    this.el.querySelector('#backBtn').addEventListener('click', ()=>this.hide());
  }
  show(data){
    this.mount();
    const bg = this.el.querySelector('#roomBg');
    const title = this.el.querySelector('#title');
    title.textContent = data.title || 'Belső tér';
    if(data.img){ bg.style.backgroundImage = `url('${data.img}')`; bg.style.backgroundColor = 'transparent'; }
    else { bg.style.backgroundImage = 'none'; bg.style.background = 'radial-gradient(#223, #111)'; }
    this.el.classList.add('visible');
    window.addEventListener('keydown', this.keyHandler);
  }
  hide(){ if(!this.el) return; this.el.classList.remove('visible'); window.removeEventListener('keydown', this.keyHandler); this.bus.emit('interior:closed'); }
  onKey(e){ if(e.key==='Escape' || e.key==='Esc' || e.key==='Backspace'){ this.hide(); } }
}

// --- App / bootstrap ---
class App {
  constructor(){
    this.bus = new EventBus();
    this.street = new Street({
      sceneWidth: 5200,
      houses: [
        { id:'h1', x: 200, img: 'house1.png', label: 'Ház 1', height: 500, nudgeY: -120 },
        { id:'h2', x: 560, img: 'house2.png', label: 'Ház 2', height: 550, nudgeY: -73 },
        { id:'h3', x: 980, img: 'house3.png', label: 'Ház 3', height: 750, nudgeY: -205 },
      ],
      bus: this.bus
    });
    // egyszerű demo interior-katalógus
    this.interiors = {
      h1: { title:'Ház 1 – előtér', img: 'house1interior.png' },
      h2: { title:'Ház 2 – lépcsőház', img: 'house2interior.png' },
      h3: { title:'Ház 3 – szoba', img: 'house3interior.png' }
    };
    this.interiorView = new InteriorView(this.bus);

    // események
    this.bus.on('house:enter', (house)=>{
      const data = this.interiors[house.id] || { title: house.label || 'Belső tér' };
      this.interiorView.show(data);
    });
  }
  async init(){
    await this.street.preload();
    this.street.build();
  }
}

window.addEventListener('DOMContentLoaded', ()=> new App().init());
