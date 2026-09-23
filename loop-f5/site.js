'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const models = [
    {id:'baseline',label:'Baseline (18 × 1)',formula:'18 unique blocks · one pass',params:157.965668,unique:18,color:'#757575',sequence:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18]},
    {id:'full2',label:'CYCLE 9 × 2',formula:'9 unique blocks · two passes',params:83.557988,unique:9,color:'#4878a8',sequence:[1,2,3,4,5,6,7,8,9,1,2,3,4,5,6,7,8,9]},
    {id:'sequence',label:'SEQUENCE 9 × 2',formula:'Each block repeated immediately',params:83.557988,unique:9,color:'#8064aa',sequence:[1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9]},
    {id:'full3',label:'Loop 6 × 3',formula:'6 unique blocks · three passes',params:58.755428,unique:6,color:'#65864f',sequence:[1,2,3,4,5,6,1,2,3,4,5,6,1,2,3,4,5,6]},
    {id:'prefix',label:'Prefix',formula:'6 × 2 + 6',params:108.360548,unique:12,color:'#15877f',sequence:[1,2,3,4,5,6,1,2,3,4,5,6,7,8,9,10,11,12]},
    {id:'middle',label:'Middle',formula:'3 + 6 × 2 + 3',params:108.360548,unique:12,color:'#b98223',sequence:[1,2,3,4,5,6,7,8,9,4,5,6,7,8,9,10,11,12]},
    {id:'suffix',label:'Suffix',formula:'6 + 6 × 2',params:108.360548,unique:12,color:'#d56655',sequence:[1,2,3,4,5,6,7,8,9,10,11,12,7,8,9,10,11,12]},
  ];
  const metrics = {
    wer: {label:'WER',name:'Word error rate',direction:'↓',digits:2,asset:'placement-budget',lower:true,
      definition:'Mean utterance WER (%) measures transcription errors; lower is better.',
      axis:'Axes start at zero: 0–3% at 32 steps, 0–20% at four steps.',
      finding:'At four steps, Suffix has 3.44 / 5.97 percentage points higher WER than Prefix on Seed-TTS / LibriSpeech-PC. Among the partial loops, Middle has the lowest 32-step WER on both datasets.'},
    sim: {label:'SIM-o',name:'Speaker similarity',direction:'↑',digits:3,asset:'placement-budget-sim',lower:false,
      definition:'SIM-o measures speaker similarity; higher is better.',
      axis:'All panels use the same zero-based 0–0.65 axis.',
      finding:'At 32 steps, Suffix has the highest speaker similarity among the partial loops on both datasets. SEQUENCE 9 × 2 has the highest overall 32-step SIM-o on both datasets.'},
    utmos: {label:'UTMOS',name:'Predicted naturalness',direction:'↑',digits:2,asset:'placement-budget-utmos',lower:false,
      definition:'UTMOS predicts naturalness; higher is better. It is an automatic score, not human MOS.',
      axis:'All panels use the same zero-based 0–5 axis.',
      finding:'Prefix has the highest four-step UTMOS on both datasets. At 32 steps, Suffix leads on Seed-TTS and Prefix on LibriSpeech-PC. These are automatic predictions, not human listening scores.'}
  };
  let samples = null;
  let qualityData = null;
  let qualityMetric = 'wer';
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
    const metric = metrics[qualityMetric];
    const cols = [['seedtts','32'],['seedtts','4'],['lspc','32'],['lspc','4']];
    const best = cols.map(([dataset,steps]) => (metric.lower ? Math.min : Math.max)(...models.map((m) => data.quality[dataset][steps][m.id][qualityMetric]).filter(Number.isFinite).map(v => Number(v.toFixed(metric.digits)))));
    $('#seedtts-metric-heading').textContent = `Seed-TTS ${metric.label} ${metric.direction}`;
    $('#lspc-metric-heading').textContent = `LibriSpeech-PC ${metric.label} ${metric.direction}`;
    $('#results-caption').textContent = `All seven models: ${metric.name} on Seed-TTS and LibriSpeech-PC at 32 and 4 steps, parameters and allocated memory as percentages of Baseline.`;
    $('#quality-table-note').textContent = `${metric.definition} Means over four inference seeds on Seed-TTS and three on LibriSpeech-PC. Bold: ${metric.lower ? 'lowest' : 'highest'} displayed mean in each quality column, including ties. All quality results use 500k-update EMA checkpoints.`;
    $('#results-rows').innerHTML = models.map((m) => {
      const r = data.resources[m.id];
      const baseline = data.resources.baseline;
      const inferencePercent = (100 * r.inference_mb / baseline.inference_mb).toFixed(1);
      const trainingPercent = (100 * r.training_allocated_gib / baseline.training_allocated_gib).toFixed(1);
      const values = cols.map(([dataset,steps],i) => {const raw = data.quality[dataset][steps][m.id][qualityMetric]; if (!Number.isFinite(raw)) return '<td class="pending" title="Audio generated; objective evaluation pending">Pending</td>'; const value = raw.toFixed(metric.digits);return `<td>${Number(value) === best[i] ? `<strong>${value}</strong>` : value}</td>`;}).join('');
      return `<tr class="${rowClass(m)}" data-model="${m.id}"><th scope="row">${m.label}</th><td>${m.params.toFixed(1)}</td>${values}<td title="${r.inference_mb.toFixed(1)} MB allocated">${inferencePercent}%</td><td title="${r.training_allocated_gib.toFixed(2)} GiB allocated; ${esc(r.training_gpu)}">${trainingPercent}%</td></tr>`;
    }).join('');
  }
  function selectQualityMetric(key) {
    if (!Object.hasOwn(metrics, key)) return;
    qualityMetric = key;
    const metric = metrics[key];
    $$('[data-quality-metric]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.qualityMetric === key)));
    $('#quality-figure-source').srcset = `assets/figures/${metric.asset}-mobile.svg?v=5`;
    $('#quality-figure-image').src = `assets/figures/${metric.asset}.svg?v=7`;
    $('#quality-figure-image').alt = `${metric.name} for all seven models: Baseline, CYCLE 9 by 2, SEQUENCE 9 by 2, Loop 6 by 3, Prefix, Middle, and Suffix, on Seed-TTS and LibriSpeech-PC at 32 and 4 sampling steps. ${metric.finding} Exact means are also available in the comparison table below.`;
    $('#metric-finding').textContent = metric.finding;
    $('#quality-figure-caption').textContent = `${metric.definition} Means over four inference seeds on Seed-TTS and three on LibriSpeech-PC. ${metric.axis} All seven models execute 18 block calls per network evaluation; only the three partial loops share the same 108.4M parameter count.`;
    if (qualityData) renderResults(qualityData);
  }
  async function readJSON(path) { const response = await fetch(path); if (!response.ok) throw new Error(`${path}: ${response.status}`); return response.json(); }
  function showError(selector, message, error) { const el = $(selector); el.hidden = false; el.textContent = message; console.error(error); }
  renderArchitecture();
  $$('[data-quality-metric]').forEach((button) => button.addEventListener('click', () => selectQualityMetric(button.dataset.qualityMetric)));
  $('#sample-select').addEventListener('change', (event) => renderSample(Number(event.target.value)));
  readJSON('data/samples.json?v=5').then((data) => {
    if (!data.samples?.length) throw new Error('No samples in manifest');
    samples = data;
    $('#sample-select').innerHTML = data.samples.map((sample,index) => `<option value="${index}">${String(index + 1).padStart(2,'0')} · ${esc(sample.length_group[0].toUpperCase() + sample.length_group.slice(1))} sentence</option>`).join('');
    renderSample(0);
  }).catch((error) => showError('#audio-load-error', 'The audio examples could not load. Please reload the page, or open the sample manifest below.', error));
  readJSON('data/results.json?v=7').then((data) => { qualityData = data; renderResults(data); }).catch((error) => showError('#results-load-error', 'The results table could not load. Please reload the page, or open the result data below.', error));
})();
