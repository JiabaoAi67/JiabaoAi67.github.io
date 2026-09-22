'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const models = [
    {id:'baseline',label:'Baseline',params_m:157.965668,unique_blocks:18,color:'#59636f',sequence:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]},
    {id:'full2',label:'Full ×2',params_m:83.557988,unique_blocks:9,color:'#8d97a1',sequence:[1,2,3,4,5,6,7,8,9,1,2,3,4,5,6,7,8,9]},
    {id:'full3',label:'Full ×3',params_m:58.755428,unique_blocks:6,color:'#b6bdc6',sequence:[1,2,3,4,5,6,1,2,3,4,5,6,1,2,3,4,5,6]},
    {id:'prefix',label:'Prefix',params_m:108.360548,unique_blocks:12,color:'#15877f',sequence:[1,2,3,4,5,6,1,2,3,4,5,6,7,8,9,10,11,12]},
    {id:'middle',label:'Middle',params_m:108.360548,unique_blocks:12,color:'#b98223',sequence:[1,2,3,4,5,6,7,8,9,4,5,6,7,8,9,10,11,12]},
    {id:'suffix',label:'Suffix',params_m:108.360548,unique_blocks:12,color:'#d56655',sequence:[1,2,3,4,5,6,7,8,9,10,11,12,7,8,9,10,11,12]},
  ];
  const state = {sample:0,audioSteps:4,allLayouts:false,dataset:'seedtts',tableSteps:32,zoom:false,results:null,samples:null};
  const datasetLabel = () => state.dataset === 'seedtts' ? 'Seed-TTS' : 'LibriSpeech-PC';
  function activate(attribute, value) {
    $$(`[${attribute}]`).forEach((el) => {const active = el.getAttribute(attribute) === String(value);el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
  }
  function pauseAll() { $$('audio').forEach((audio) => audio.pause()); }
  document.addEventListener('play',(event)=>{if(event.target.tagName==='AUDIO') $$('audio').forEach((audio)=>{if(audio!==event.target)audio.pause();});},true);
  function renderArchitecture() {
    $('#architecture').innerHTML = '<div class="architecture-head"><span>Layout</span><span class="direction">18 block calls, left to right</span><span>Unique</span><span>Params</span></div>' + models.map((m) => {
      const counts = m.sequence.reduce((a,n)=>(a[n]=(a[n]||0)+1,a),{});
      const blocks = m.sequence.map((n,i)=>`<span class="block${counts[n]>1?' shared':''}${i>0 && n<m.sequence[i-1]?' pass-start':''}" data-weight="${n}" title="${esc(m.label)} · call ${i+1} · block ${n}${counts[n]>1?' (shared)':''}">${n}</span>`).join('');
      return `<div class="architecture-row${m.id==='prefix'?' partial-start':''}" style="--color:${m.color}"><span class="layout-label">${m.label}</span><div class="block-track" aria-label="${esc(m.label)} executes blocks ${m.sequence.join(', ')}">${blocks}</div><span class="layout-number">${m.unique_blocks}</span><span class="layout-number">${m.params_m.toFixed(1)}M</span></div>`;
    }).join('');
    $$('.block-track').forEach(track=>{
      track.addEventListener('pointerover',event=>{const n=event.target.dataset.weight;if(n)track.querySelectorAll('.block').forEach(b=>b.classList.toggle('match',b.dataset.weight===n));});
      track.addEventListener('pointerleave',()=>track.querySelectorAll('.match').forEach(b=>b.classList.remove('match')));
    });
  }
  function renderSample() {
    if (!state.samples) return;
    pauseAll();
    const sample = state.samples.samples[state.sample];
    $('#sample-select').value = String(state.sample);
    $('#sample-text').textContent = sample.text;
    $('#sample-meta').textContent = `Example ${String(state.sample+1).padStart(2,'0')} of ${state.samples.samples.length} · ${sample.length_group[0].toUpperCase()+sample.length_group.slice(1)} target duration · Seed-TTS test-en`;
    $('#reference-audio').src = sample.reference.src;
    $('#reference-text').textContent = sample.reference.text;
    $('#reference-audio').setAttribute('aria-label',`Reference voice for example ${state.sample+1}`);
    $('#sample-content').setAttribute('aria-busy','false');
    const shown = models.filter(m => state.allLayouts || ['prefix','middle','suffix'].includes(m.id));
    const showMetrics = $('#show-clip-metrics').checked;
    $('#audio-grid').innerHTML = shown.map(m=>{
      const output=sample.outputs[String(state.audioSteps)][m.id];
      return `<article class="audio-card" style="--model-color:${m.color}"><div class="audio-card-header"><h3><i class="model-dot" aria-hidden="true"></i>${m.label}</h3><span>${m.params_m.toFixed(1)}M params</span></div><audio controls preload="none" src="${esc(output.src)}" aria-label="${esc(m.label)}, ${state.audioSteps} steps, example ${state.sample+1}"></audio><p class="clip-duration">${state.audioSteps} sampling steps · ${output.duration_seconds.toFixed(1)} s</p><div class="clip-metrics"${showMetrics?'':' hidden'}><span>WER ↓<strong>${output.wer.toFixed(2)}%</strong></span><span>SIM-o ↑<strong>${output.sim.toFixed(3)}</strong></span><span>UTMOS ↑<strong>${output.utmos.toFixed(2)}</strong></span></div></article>`;
    }).join('');
    $('#listen-status').textContent = `${state.allLayouts?'Six layouts':'Three positions · same parameter count'} · ${state.audioSteps} steps`;
    $('#all-layouts').setAttribute('aria-pressed',String(state.allLayouts));
    $('#all-layouts').innerHTML = state.allLayouts?'Show the three positions <span aria-hidden="true">↗</span>':'Show all six layouts <span aria-hidden="true">↗</span>';
    $$('#audio-grid audio').forEach(audio=>audio.addEventListener('error',()=>{const line=audio.closest('.audio-card').querySelector('.clip-duration');line.textContent='Audio could not load. Please retry or reload the page.';line.setAttribute('role','alert');}));
  }
  function renderChart() {
    if (!state.results) return;
    const mobile=window.innerWidth<650,W=mobile?580:980,H=mobile?330:325;
    const margin={left:mobile?53:53,right:24,top:24,bottom:55}, width=W-margin.left-margin.right,height=H-margin.top-margin.bottom;
    const steps=state.zoom?[8,16,32]:[4,8,16,32];
    const ymin=state.zoom?1.5:0,ymax=state.zoom?4.25:20;
    const ticks=state.zoom?[1.5,2,2.5,3,3.5,4]:[0,5,10,15,20];
    const x=(i)=>margin.left+i*width/(steps.length-1),y=(v)=>margin.top+(ymax-v)/(ymax-ymin)*height;
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
    if(!state.zoom)svg+=`<rect x="${margin.left}" y="${margin.top}" width="${width/6}" height="${height}" fill="#f5f7f2"/>`;
    ticks.forEach(t=>{svg+=`<line x1="${margin.left}" x2="${W-margin.right}" y1="${y(t)}" y2="${y(t)}" stroke="#e5ebe5"/><text class="chart-label" x="${margin.left-13}" y="${y(t)+5}" text-anchor="end">${t}</text>`;});
    svg+=`<text class="chart-label" x="${margin.left}" y="14">WER (%)</text>`;
    steps.forEach((n,i)=>{svg+=`<text class="chart-label" x="${x(i)}" y="${H-29}" text-anchor="middle">${n}</text>`;});
    svg+=`<text class="chart-label" x="${margin.left+width/2}" y="${H-3}" text-anchor="middle">Sampling steps</text>`;
    const descriptions=[];
    models.forEach((m,index)=>{
      const vals=state.results.curves[state.dataset][m.id];
      const points=steps.map((n,i)=>[x(i),y(vals[state.results.curves.steps.indexOf(n)]),vals[state.results.curves.steps.indexOf(n)],n]);
      svg+=`<polyline fill="none" stroke="${m.color}" stroke-width="${index<3?2:3}"${index<3?' stroke-dasharray="7 5"':''} stroke-linecap="round" stroke-linejoin="round" points="${points.map(p=>p.slice(0,2).join(',')).join(' ')}"/>`;
      points.forEach(p=>{svg+=`<circle cx="${p[0]}" cy="${p[1]}" r="${index<3?4:5}" fill="${m.color}" stroke="white" stroke-width="1.5"><title>${esc(m.label)} · ${p[3]} steps: ${p[2].toFixed(2)}% WER</title></circle>`;});
      descriptions.push(`${m.label}: ${points.map(p=>`${p[2].toFixed(2)}% at ${p[3]} steps`).join(', ')}`);
    });
    svg+='</svg>';
    $('#wer-chart').innerHTML=svg;
    $('#wer-chart').setAttribute('aria-label',`${datasetLabel()}, WER. ${descriptions.join('. ')}`);
    $('#chart-legend').innerHTML=models.map((m,i)=>`<span><i class="legend-line" style="--model-color:${m.color};${i<3?'border-top-style:dashed':''}" aria-hidden="true"></i>${m.label}</span>`).join('');
    const q=state.results.quality[state.dataset]['4'];
    const gap=(q.suffix.wer-q.prefix.wer).toFixed(2);
    $('#finding-text').innerHTML=`<strong>At four steps, Suffix has ${gap} percentage points higher WER than Prefix.</strong> This is the full-test-set mean over ${state.dataset==='seedtts'?'four':'three'} inference seeds. The fixed-seed curves show their mean ordering reversing by eight steps${state.dataset==='seedtts'?'; the eight-step paired interval still includes zero':''}.`;
  }
  function renderTable() {
    if(!state.results)return;
    const q=state.results.quality[state.dataset][String(state.tableSteps)];
    const precision={wer:2,sim:3,utmos:2};
    const best={};
    Object.keys(precision).forEach(metric=>{const values=models.map(m=>Number(q[m.id][metric].toFixed(precision[metric])));best[metric]=(metric==='wer'?Math.min:Math.max)(...values);});
    $('#table-caption').textContent=`Quality on ${datasetLabel()} at ${state.tableSteps} steps. All resource columns use 32-step Seed-TTS measurements.`;
    $('#results-rows').innerHTML=models.map(m=>{
      const resource=state.results.resources[m.id];
      return `<tr${m.id==='prefix'?' class="partial-start"':''}><td><span><i class="model-dot" style="--model-color:${m.color}" aria-hidden="true"></i>${m.label}</span></td><td>${m.params_m.toFixed(1)}</td><td>${resource.inference_mb.toFixed(1)}</td><td>${resource.rtf.toFixed(4)}</td>${Object.keys(precision).map(metric=>{const value=q[m.id][metric].toFixed(precision[metric]);return `<td>${Number(value)===best[metric]?`<strong>${value}</strong>`:value}</td>`;}).join('')}</tr>`;
    }).join('');
    $('#training-rows').innerHTML=models.map(m=>{const r=state.results.resources[m.id];return `<tr><td>${m.label}</td><td>${esc(r.training_gpu)}</td><td>${r.training_allocated_gib.toFixed(2)}</td><td>${r.training_reserved_gib.toFixed(2)}</td><td>${r.seconds_per_update.toFixed(4)}</td></tr>`;}).join('');
  }
  async function readJSON(path) {const response=await fetch(path);if(!response.ok)throw new Error(`${path}: ${response.status}`);return response.json();}
  function error(selector,message,error) {const el=$(selector);el.hidden=false;el.textContent=message;console.error(error);}
  renderArchitecture();
  $('#sample-select').addEventListener('change',e=>{state.sample=Number(e.target.value);renderSample();});
  $('#previous-sample').addEventListener('click',()=>{if(state.samples){state.sample=(state.sample-1+state.samples.samples.length)%state.samples.samples.length;renderSample();}});
  $('#next-sample').addEventListener('click',()=>{if(state.samples){state.sample=(state.sample+1)%state.samples.samples.length;renderSample();}});
  $$('[data-audio-steps]').forEach(button=>button.addEventListener('click',()=>{state.audioSteps=Number(button.dataset.audioSteps);activate('data-audio-steps',state.audioSteps);renderSample();}));
  $('#all-layouts').addEventListener('click',()=>{state.allLayouts=!state.allLayouts;renderSample();});
  $('#show-clip-metrics').addEventListener('change',e=>$$('.clip-metrics').forEach(el=>{el.hidden=!e.target.checked;}));
  $$('[data-dataset]').forEach(button=>button.addEventListener('click',()=>{state.dataset=button.dataset.dataset;activate('data-dataset',state.dataset);renderChart();renderTable();}));
  $$('[data-table-steps]').forEach(button=>button.addEventListener('click',()=>{state.tableSteps=Number(button.dataset.tableSteps);activate('data-table-steps',state.tableSteps);renderTable();}));
  $('#chart-zoom').addEventListener('change',e=>{state.zoom=e.target.checked;renderChart();});
  let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderChart,120);});
  readJSON('data/samples.json').then(data=>{
    if(!data.samples?.length)throw new Error('No audio examples in manifest');
    state.samples=data;
    $('#sample-select').innerHTML=data.samples.map((s,i)=>`<option value="${i}">${String(i+1).padStart(2,'0')} · ${esc(s.length_group[0].toUpperCase()+s.length_group.slice(1))} sentence</option>`).join('');renderSample();
  }).catch(e=>error('#audio-load-error','Audio examples could not load. Please reload the page. The sample manifest remains available below.',e));
  readJSON('data/results.json').then(data=>{state.results=data;renderChart();renderTable();}).catch(e=>error('#results-load-error','Interactive results could not load. Please reload the page or open the results data below for the complete table.',e));
})();
