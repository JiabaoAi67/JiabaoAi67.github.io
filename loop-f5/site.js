'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const models = [
    {id:'baseline',label:'Baseline (18 × 1)',formula:'18 unique blocks · one pass',params:157.965668,unique:18,color:'#757575',sequence:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]},
    {id:'full2',label:'Loop 9 × 2',formula:'9 unique blocks · two passes',params:83.557988,unique:9,color:'#757575',sequence:[1,2,3,4,5,6,7,8,9,1,2,3,4,5,6,7,8,9]},
    {id:'full3',label:'Loop 6 × 3',formula:'6 unique blocks · three passes',params:58.755428,unique:6,color:'#757575',sequence:[1,2,3,4,5,6,1,2,3,4,5,6,1,2,3,4,5,6]},
    {id:'prefix',label:'Prefix',formula:'6 × 2 + 6',params:108.360548,unique:12,color:'#15877f',sequence:[1,2,3,4,5,6,1,2,3,4,5,6,7,8,9,10,11,12]},
    {id:'middle',label:'Middle',formula:'3 + 6 × 2 + 3',params:108.360548,unique:12,color:'#b98223',sequence:[1,2,3,4,5,6,7,8,9,4,5,6,7,8,9,10,11,12]},
    {id:'suffix',label:'Suffix',formula:'6 + 6 × 2',params:108.360548,unique:12,color:'#d56655',sequence:[1,2,3,4,5,6,7,8,9,10,11,12,7,8,9,10,11,12]},
  ];
  let samples = null;
  function pauseAll() { $$('audio').forEach((audio) => audio.pause()); }
  document.addEventListener('play', (event) => {
    if (event.target.tagName === 'AUDIO') $$('audio').forEach((audio) => { if (audio !== event.target) audio.pause(); });
  }, true);
  function rowClass(model) { return model.id === 'baseline' ? 'baseline-row' : model.id === 'prefix' ? 'partial-start' : ''; }
  function renderArchitecture() {
    $('#architecture').innerHTML = '<div class="architecture-head"><span>Layout</span><span>18 block calls →</span><span>Unique</span><span>Params</span></div>' + models.map((m) => {
      const counts = m.sequence.reduce((a, n) => (a[n] = (a[n] || 0) + 1, a), {});
      const blocks = m.sequence.map((n, i) => `<span class="block${counts[n] > 1 ? ' shared' : ''}${i > 0 && n < m.sequence[i - 1] ? ' pass-start' : ''}" title="Call ${i + 1}: block ${n}${counts[n] > 1 ? ' (shared)' : ''}">${n}</span>`).join('');
      return `<div class="architecture-row ${rowClass(m)}" style="--color:${m.color}"><span class="layout-label">${m.label}<small>${m.formula}</small></span><div class="block-track" aria-label="${esc(m.label)}: blocks ${m.sequence.join(', ')}">${blocks}</div><span class="layout-number">${m.unique}</span><span class="layout-number">${m.params.toFixed(1)}M</span></div>`;
    }).join('');
  }
  function renderSample(index) {
    if (!samples) return;
    pauseAll();
    const sample = samples.samples[index];
    $('#sample-text').textContent = sample.text;
    $('#reference-audio').src = sample.reference.src;
    $('#reference-audio').setAttribute('aria-label', `Reference voice, example ${index + 1}`);
    $('#reference-text').textContent = sample.reference.text;
    $('#sample-content').setAttribute('aria-busy', 'false');
    $('#audio-rows').innerHTML = models.map((m) => `<tr class="${rowClass(m)}" data-model="${m.id}"><th scope="row">${m.label}<small>${m.params.toFixed(1)}M parameters</small></th>${[32,4].map((steps) => `<td data-steps="${steps} steps"><audio controls preload="metadata" src="${esc(sample.outputs[String(steps)][m.id].src)}" aria-label="${esc(m.label)}, ${steps} steps, example ${index + 1}"></audio></td>`).join('')}</tr>`).join('');
    $$('#audio-rows audio').forEach((audio) => audio.addEventListener('error', () => {
      if (!audio.parentElement.querySelector('.audio-error')) {
        const note = document.createElement('small');
        note.className = 'audio-error'; note.setAttribute('role','alert'); note.textContent = 'Audio could not load. Please reload to retry.';
        audio.parentElement.append(note);
      }
    }));
  }
  function renderResults(data) {
    const cols = [['seedtts','32'],['seedtts','4'],['lspc','32'],['lspc','4']];
    const best = cols.map(([dataset,steps]) => Math.min(...models.map((m) => Number(data.quality[dataset][steps][m.id].wer.toFixed(2)))));
    $('#results-rows').innerHTML = models.map((m) => {
      const r = data.resources[m.id];
      const values = cols.map(([dataset,steps],i) => {const value = data.quality[dataset][steps][m.id].wer.toFixed(2);return `<td>${Number(value) === best[i] ? `<strong>${value}</strong>` : value}</td>`;}).join('');
      return `<tr class="${rowClass(m)}" data-model="${m.id}"><th scope="row">${m.label}</th><td>${m.params.toFixed(1)}</td>${values}<td>${r.inference_mb.toFixed(1)}</td><td>${r.training_allocated_gib.toFixed(2)}</td><td>${r.rtf.toFixed(4)}</td></tr>`;
    }).join('');
    $('#quality-tables').innerHTML = '<div class="metric-tables">' + [['seedtts','Seed-TTS'],['lspc','LibriSpeech-PC']].map(([dataset,label]) => `<div class="scroll-region" tabindex="0" role="region" aria-label="${label} speaker similarity and predicted quality"><table class="results-table"><caption>${label}</caption><thead><tr><th scope="col" rowspan="2">Model</th><th scope="colgroup" colspan="2">32 steps</th><th scope="colgroup" colspan="2">4 steps</th></tr><tr><th scope="col">SIM-o ↑</th><th scope="col">UTMOS ↑</th><th scope="col">SIM-o ↑</th><th scope="col">UTMOS ↑</th></tr></thead><tbody>${models.map((m) => `<tr class="${rowClass(m)}"><th scope="row">${m.label}</th>${['32','4'].map((steps) => `<td>${data.quality[dataset][steps][m.id].sim.toFixed(3)}</td><td>${data.quality[dataset][steps][m.id].utmos.toFixed(2)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`).join('') + '</div>';
    $('#training-rows').innerHTML = models.map((m) => {const r = data.resources[m.id];return `<tr class="${rowClass(m)}"><th scope="row">${m.label}</th><td>${esc(r.training_gpu)}</td><td>${r.training_allocated_gib.toFixed(2)}</td><td>${r.training_reserved_gib.toFixed(2)}</td><td>${r.seconds_per_update.toFixed(4)}</td></tr>`;}).join('');
  }
  async function readJSON(path) { const response = await fetch(path); if (!response.ok) throw new Error(`${path}: ${response.status}`); return response.json(); }
  function showError(selector, message, error) { const el = $(selector); el.hidden = false; el.textContent = message; console.error(error); }
  renderArchitecture();
  $('#sample-select').addEventListener('change', (event) => renderSample(Number(event.target.value)));
  readJSON('data/samples.json').then((data) => {
    if (!data.samples?.length) throw new Error('No samples in manifest');
    samples = data;
    $('#sample-select').innerHTML = data.samples.map((sample,index) => `<option value="${index}">${String(index + 1).padStart(2,'0')} · ${esc(sample.length_group[0].toUpperCase() + sample.length_group.slice(1))} sentence</option>`).join('');
    renderSample(0);
  }).catch((error) => showError('#audio-load-error', 'The audio examples could not load. Please reload the page, or open the sample manifest below.', error));
  readJSON('data/results.json').then(renderResults).catch((error) => showError('#results-load-error', 'The results table could not load. Please reload the page, or open the result data below.', error));
})();
