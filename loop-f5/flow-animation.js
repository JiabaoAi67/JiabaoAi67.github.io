'use strict';
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  // These local definitions intentionally match site.js; no fetch is needed.
  const models = [
    {id:'baseline',label:'Baseline (18 × 1)',unique:18,color:'#757575',note:'18 unique · one pass',sequence:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]},
    {id:'full2',label:'CYCLE 9 × 2',unique:9,color:'#4878a8',note:'9 unique · two passes',sequence:[1,2,3,4,5,6,7,8,9,1,2,3,4,5,6,7,8,9]},
    {id:'sequence',label:'SEQUENCE 9 × 2',unique:9,color:'#8064aa',note:'9 unique · adjacent reuse',sequence:[1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9]},
    {id:'full3',label:'Loop 6 × 3',unique:6,color:'#65864f',note:'6 unique · three passes',sequence:[1,2,3,4,5,6,1,2,3,4,5,6,1,2,3,4,5,6]},
    {id:'prefix',label:'Prefix',unique:12,color:'#15877f',note:'12 unique · shared 1–6',sequence:[1,2,3,4,5,6,1,2,3,4,5,6,7,8,9,10,11,12]},
    {id:'middle',label:'Middle',unique:12,color:'#b98223',note:'12 unique · shared 4–9',sequence:[1,2,3,4,5,6,7,8,9,4,5,6,7,8,9,10,11,12]},
    {id:'suffix',label:'Suffix',unique:12,color:'#d56655',note:'12 unique · shared 7–12',sequence:[1,2,3,4,5,6,7,8,9,10,11,12,7,8,9,10,11,12]}
  ];
  const nodeX = n => 194 + (n - 1) * 42;
  const clamp = p => Math.max(0, Math.min(18, p));
  function tint(hex, amount) {
    const rgb = hex.slice(1).match(/../g).map(c => parseInt(c, 16));
    return `rgb(${rgb.map(c => Math.round(255 + (c - 255) * amount)).join(',')})`;
  }
  function svgNode(tag, attrs, text) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([key, value]) => el.setAttribute(key, String(value)));
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function init() {
    const host = document.getElementById('flow-animation');
    if (!host || host.dataset.flowInitialized) return;
    host.dataset.flowInitialized = 'true';
    host.classList.add('loop-flow');
    const uid = `loop-flow-${(window.__loopFlowCount = (window.__loopFlowCount || 0) + 1)}`;
    const figure = document.createElement('figure');
    figure.className = 'lf-figure';
    const viewport = document.createElement('div');
    viewport.className = 'lf-viewport';
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', 'Weight reuse diagram. Scroll horizontally on small screens.');
    const svg = svgNode('svg', {viewBox:'0 0 1000 760',xmlns:NS,class:'lf-svg',role:'img','aria-labelledby':`${uid}-title ${uid}-description`});
    svg.append(
      svgNode('title', {id:`${uid}-title`}, 'Hidden-state flow through seven Transformer layouts'),
      svgNode('desc', {id:`${uid}-description`}, 'Each row shows every unique Transformer block once. All rows execute 18 block calls in one network evaluation. Colored return arrows and self-loops revisit the same weights. Flow time t and conditioning c stay fixed; hidden states carry forward. This is not a sequence of 18 sampling steps.'),
      svgNode('rect', {width:1000,height:760,fill:'#ffffff'})
    );
    const defs = svgNode('defs');
    svg.append(defs);
    function marker(name, color) {
      const id = `${uid}-${name}`;
      const el = svgNode('marker', {id,viewBox:'0 0 8 8',refX:7,refY:4,markerWidth:6,markerHeight:6,orient:'auto',markerUnits:'userSpaceOnUse'});
      el.append(svgNode('path',{d:'M 0 1 L 7 4 L 0 7',fill:'none',stroke:color,'stroke-width':1.2,'stroke-linecap':'round','stroke-linejoin':'round'}));
      defs.append(el);
      return `url(#${id})`;
    }
    const grayMarker = marker('forward', '#b9bec5');
    svg.append(svgNode('text',{x:20,y:25,class:'lf-column-label'},'Layout'));
    svg.append(svgNode('text',{x:179,y:25,class:'lf-column-label'},'Unique Transformer blocks'));
    const counter = svgNode('text',{x:969,y:25,'text-anchor':'end',class:'lf-counter'},'Call 0 / 18');
    svg.append(counter, svgNode('line',{x1:20,y1:43,x2:978,y2:43,stroke:'#e4e7eb'}));

    const rows = models.map((m, ri) => {
      const y = 91 + ri * 93;
      const group = svgNode('g',{'data-model':m.id,class:'lf-model'});
      const rowMarker = marker(m.id, tint(m.color, .78));
      const totals = Array.from({length:m.unique},(_,i)=>m.sequence.filter(n=>n===i+1).length);
      group.append(svgNode('text',{x:20,y:y-3,class:'lf-model-name'},m.label));
      group.append(svgNode('text',{x:20,y:y+16,class:'lf-model-note'},m.note));
      const edges = svgNode('g',{class:'lf-edges','aria-hidden':'true'});
      const motionPaths = svgNode('g',{'aria-hidden':'true',fill:'none',stroke:'none'});
      group.append(edges,motionPaths);
      const routes = [];
      const visibleEdges = new Map();
      const returns = new Map();
      for (let call = 0; call < 18; call++) {
        const from = call ? m.sequence[call-1] : 0;
        const to = m.sequence[call];
        const a = from ? nodeX(from) : 163;
        const b = nodeX(to);
        let visible, motion, kind, lane = 0;
        if (from === to) {
          kind = 'self';
          visible = `M ${a+7} ${y-16} C ${a+27} ${y-45}, ${a-27} ${y-45}, ${a-7} ${y-16}`;
          motion = `M ${a} ${y+10} L ${a+7} ${y-16} C ${a+27} ${y-45}, ${a-27} ${y-45}, ${a-7} ${y-16} L ${b} ${y+10}`;
        } else if (to < from) {
          kind = 'return';
          const key = `${from}-${to}`;
          lane = returns.get(key) || 0;
          returns.set(key, lane+1);
          const h = 42 + lane * 12;
          const dx = lane ? -5 : 5;
          visible = `M ${a+dx} ${y-16} C ${a+dx} ${y-h}, ${b+dx} ${y-h}, ${b+dx} ${y-16}`;
          motion = `M ${a} ${y+10} L ${a+dx} ${y-16} C ${a+dx} ${y-h}, ${b+dx} ${y-h}, ${b+dx} ${y-16} L ${b} ${y+10}`;
        } else {
          kind = 'forward';
          visible = `M ${from ? a+16 : a} ${y} L ${b-17} ${y}`;
          motion = from ? `M ${a} ${y+10} L ${a} ${y} L ${b} ${y} L ${b} ${y+10}` : `M ${a} ${y} L ${b} ${y} L ${b} ${y+10}`;
        }
        const edgeKey = `${from}-${to}-${lane}`;
        if (!visibleEdges.has(edgeKey)) {
          const edge = svgNode('path',{d:visible,fill:'none',stroke:kind==='forward'?'#c9cdd3':tint(m.color,.48),'stroke-width':1.25,'marker-end':kind==='forward'?grayMarker:rowMarker,'data-from':from,'data-to':to,'data-kind':kind,'data-return':lane+1});
          edges.append(edge);
          visibleEdges.set(edgeKey,edge);
        }
        const path = svgNode('path',{d:motion,'data-call':call+1});
        motionPaths.append(path);
        routes.push({path,visible,kind,from,to,length:0});
      }
      const activeEdge = svgNode('path',{fill:'none',stroke:m.color,'stroke-width':2.1,class:'lf-active-edge','aria-hidden':'true'});
      group.append(activeEdge);
      const nodes = totals.map((total,i) => {
        const n = i+1, x = nodeX(n);
        const node = svgNode('g',{'data-model':m.id,'data-block':n,'data-visit':0,'data-total-visits':total,class:'lf-node'});
        const rect = svgNode('rect',{x:x-15,y:y-15,width:30,height:30,rx:3,stroke:total>1?tint(m.color,.44):'#d4d8dd','stroke-width':1,fill:total>1?tint(m.color,.10):'#f3f4f5'});
        const title = svgNode('title',{},`${m.label}, block ${n}: 0 of ${total} calls completed`);
        node.append(title,rect,svgNode('text',{x,y:y+4.6,'text-anchor':'middle',class:'lf-block-label'},n));
        group.append(node);
        return {node,rect,title,total};
      });
      const dot = svgNode('circle',{cx:163,cy:y,r:4.1,fill:m.color,stroke:'#fff','stroke-width':1.5,class:'lf-state-dot','aria-hidden':'true'});
      // Hide the traveling state inside a block; its outline marks computation.
      // Keeping block faces above the dot leaves layer IDs legible.
      group.insertBefore(dot,nodes[0].node);
      if (ri<6) group.append(svgNode('line',{x1:20,y1:y+47,x2:978,y2:y+47,stroke:'#f0f1f3'}));
      svg.append(group);
      return {model:m,y,group,nodes,routes,activeEdge,dot};
    });
    svg.append(svgNode('line',{x1:20,y1:701,x2:978,y2:701,stroke:'#e4e7eb'}));
    const legend = svgNode('g',{class:'lf-legend'});
    legend.append(svgNode('rect',{x:20,y:718,width:12,height:12,rx:2,fill:'#eef0f2',stroke:'#d4d8dd'}),svgNode('text',{x:39,y:729},'Unshared'));
    legend.append(svgNode('text',{x:160,y:729},'Shared:'));
    [1,2,3].forEach((n,i)=>{
      const x=218+i*106;
      legend.append(svgNode('rect',{x,y:718,width:12,height:12,rx:2,fill:tint('#4878a8',.12+.17*n),stroke:tint('#4878a8',.44)}),svgNode('text',{x:x+19,y:729},`${['1st','2nd','3rd'][i]} use`));
    });
    legend.append(svgNode('circle',{cx:587,cy:724,r:4,fill:'#4878a8'}),svgNode('text',{x:601,y:729},'Hidden state'));
    legend.append(svgNode('text',{x:20,y:751,class:'lf-scope-note'},'One network evaluation · 18 block calls · t and c stay fixed · hidden state carries forward'));
    svg.append(legend);
    viewport.append(svg);
    figure.append(viewport);
    host.append(figure);

    const controls = document.createElement('div');
    controls.className = 'lf-controls';
    const playButton = document.createElement('button');
    playButton.type='button'; playButton.className='lf-play'; playButton.textContent='Play';
    const restartButton = document.createElement('button');
    restartButton.type='button'; restartButton.className='lf-restart'; restartButton.textContent='Restart';
    const label = document.createElement('label');
    label.className='lf-slider-label'; label.htmlFor=`${uid}-progress`; label.textContent='Block calls';
    const slider = document.createElement('input');
    slider.type='range'; slider.min='0'; slider.max='18'; slider.step='0.01'; slider.value='0';
    slider.id=`${uid}-progress`; slider.className='lf-progress';
    const output = document.createElement('output');
    output.className='lf-progress-value'; output.htmlFor=slider.id; output.textContent='0 / 18';
    controls.append(playButton,restartButton,label,slider,output);
    host.append(controls);
    const live = document.createElement('p');
    live.className='lf-sr-only'; live.setAttribute('aria-live','polite'); host.append(live);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let progress=0, playing=false, frame=0, lastTime=null, visible=true, lastAnnouncement=-1;
    const millisecondsPerCall=650;
    rows.forEach(row=>row.routes.forEach(route=>{route.length=route.path.getTotalLength();}));

    function render(value) {
      progress=clamp(value);
      const completed=Math.floor(progress);
      const index=progress===0?-1:Math.min(17,Math.ceil(progress)-1);
      const fraction=index<0?0:progress-index;
      const display=Math.ceil(progress);
      counter.textContent=`Call ${display} / 18${progress===18?' · Complete':''}`;
      svg.setAttribute('data-progress',String(progress));
      slider.value=String(progress); output.textContent=`${display} / 18`;
      slider.setAttribute('aria-valuetext',`${completed} of 18 block calls completed${progress>completed?`; call ${display} in progress`:""}`);
      rows.forEach(row=>{
        const counts=Array(row.model.unique).fill(0);
        row.model.sequence.slice(0,completed).forEach(n=>counts[n-1]++);
        const active=index<0?0:row.model.sequence[index];
        row.group.setAttribute('data-completed-calls',String(completed));
        row.nodes.forEach((item,i)=>{
          const visits=counts[i], current=i+1===active && progress<18;
          item.node.setAttribute('data-visit',String(visits));
          item.node.setAttribute('data-active',String(current));
          item.rect.setAttribute('fill',item.total>1?tint(row.model.color,.12+.17*visits):(visits?'#e6e9ed':'#f3f4f5'));
          item.rect.setAttribute('stroke',current?row.model.color:(item.total>1?tint(row.model.color,.44):'#d4d8dd'));
          item.rect.setAttribute('stroke-width',current?'2.4':'1');
          item.title.textContent=`${row.model.label}, block ${i+1}: ${visits} of ${item.total} calls completed`;
        });
        if (index<0) {
          row.dot.setAttribute('cx','163'); row.dot.setAttribute('cy',String(row.y));
          row.activeEdge.setAttribute('visibility','hidden');
        } else {
          const route=row.routes[index];
          // The final 18% of each call rests inside the destination block.
          const travel=Math.min(1,fraction/.82);
          const point=route.path.getPointAtLength(route.length*travel);
          row.dot.setAttribute('cx',point.x.toFixed(3)); row.dot.setAttribute('cy',point.y.toFixed(3));
          row.activeEdge.setAttribute('d',route.visible);
          row.activeEdge.setAttribute('visibility',progress===18?'hidden':'visible');
          row.activeEdge.setAttribute('marker-end',`url(#${uid}-${row.model.id})`);
        }
      });
      if (!playing && completed!==lastAnnouncement) {
        live.textContent=progress===18?'Complete. All seven layouts have executed 18 block calls.':`${completed} of 18 block calls completed.`;
        lastAnnouncement=completed;
      }
    }
    function pause() {
      playing=false; lastTime=null;
      if (frame) cancelAnimationFrame(frame);
      frame=0; playButton.textContent=reducedMotion.matches?'Step':'Play'; playButton.setAttribute('aria-pressed','false');
    }
    function tick(time) {
      if (!playing) return;
      if (document.hidden || !visible) { pause(); return; }
      if (lastTime!==null) render(progress+Math.min(time-lastTime,100)/millisecondsPerCall);
      lastTime=time;
      if (progress>=18) { pause(); render(18); return; }
      frame=requestAnimationFrame(tick);
    }
    function play() {
      if (playing || document.hidden || !visible) return;
      if (progress>=18) render(0);
      if (reducedMotion.matches) {
        // An explicit call advances a static frame instead of animating motion.
        render(Math.min(18,Math.floor(progress)+1));
        live.textContent='Reduced motion: advanced one block call. Use the slider to explore.';
        return;
      }
      playing=true; lastTime=null; playButton.textContent='Pause'; playButton.setAttribute('aria-pressed','true');
      frame=requestAnimationFrame(tick);
    }
    function setProgress(value) {
      if (typeof value!=='number' || !Number.isFinite(value)) throw new TypeError('Progress must be a finite number from 0 to 18.');
      pause(); render(value); return progress;
    }
    function reset() { return setProgress(0); }
    playButton.addEventListener('click',()=>playing?pause():play());
    restartButton.addEventListener('click',reset);
    slider.addEventListener('input',()=>setProgress(Number(slider.value)));
    slider.addEventListener('keydown',event=>{
      if (['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'].includes(event.key)) {
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?18:progress+(['ArrowLeft','ArrowDown'].includes(event.key)?-1:1);
        setProgress(next);
      }
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden) pause();});
    if ('IntersectionObserver' in window) new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting;
      if (!visible) pause();
    },{threshold:0}).observe(host);
    function updateMotionPreference() {
      pause();
      playButton.textContent=reducedMotion.matches?'Step':'Play';
      playButton.title=reducedMotion.matches?'Reduced motion: advance one block call':'Play one network evaluation';
    }
    if (reducedMotion.addEventListener) reducedMotion.addEventListener('change',updateMotionPreference);
    window.LoopFlow={
      setProgress,play,pause,reset,
      step:()=>setProgress(Math.min(18,Math.floor(progress)+1)),
      getProgress:()=>progress,
      isPlaying:()=>playing,
      getState:()=>({progress,playing,completedCalls:Math.floor(progress),models:models.map(m=>({id:m.id,unique:m.unique,sequence:m.sequence.slice(),visits:Array.from({length:m.unique},(_,i)=>m.sequence.slice(0,Math.floor(progress)).filter(n=>n===i+1).length)}))}),
      svg,
      models:models.map(m=>Object.freeze({...m,sequence:Object.freeze(m.sequence.slice())}))
    };
    updateMotionPreference(); render(0);
    host.dispatchEvent(new CustomEvent('loopflow:ready',{bubbles:true}));
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
