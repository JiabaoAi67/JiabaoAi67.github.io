(() => {
  'use strict';

  const canvas = document.getElementById('flow-canvas');
  const context = canvas.getContext('2d');
  const poster = document.getElementById('poster');
  const controls = document.getElementById('animation-controls');
  const play = document.getElementById('play-toggle');
  const replay = document.getElementById('replay');
  const slider = document.getElementById('progress');
  const progressValue = document.getElementById('progress-value');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const colors = { x: '#168c87', h: '#d97560' };
  const duration = 6400;
  const endHold = 1300;
  let paths;
  let bounds;
  let width = 0;
  let height = 0;
  let progress = 0;
  let elapsed = 0;
  let playing = false;
  let previousTime = null;
  let frame = null;

  function setPlaying(value) {
    playing = value;
    play.setAttribute('aria-pressed', String(value));
    play.setAttribute('aria-label', value ? 'Pause animation' : 'Play animation');
    play.querySelector('span').textContent = value ? 'Pause' : 'Play';
    play.querySelector('.play-icon').toggleAttribute('hidden', value);
    play.querySelector('.pause-icon').toggleAttribute('hidden', !value);
    previousTime = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = value && !document.hidden ? requestAnimationFrame(animate) : null;
  }

  function updateProgress(value) {
    progress = Math.max(0, Math.min(1, value));
    const percent = Math.round(progress * 100);
    slider.value = String(Math.round(progress * 1000));
    slider.style.background = `linear-gradient(to right,#678e91 ${progress * 100}%,#e7ecee ${progress * 100}%)`;
    slider.setAttribute('aria-valuetext', `${percent} percent`);
    progressValue.value = `${percent}%`;
    draw();
  }

  function animate(time) {
    if (!playing || document.hidden) { frame = null; return; }
    if (previousTime !== null) elapsed += Math.min(time - previousTime, 100);
    previousTime = time;
    if (elapsed >= duration + endHold) elapsed = 0;
    updateProgress(elapsed / duration);
    frame = requestAnimationFrame(animate);
  }

  function currentPoint(path) {
    const position = progress * (path.length - 1);
    const index = Math.floor(position);
    const next = path[Math.min(index + 1, path.length - 1)];
    const fraction = position - index;
    return [path[index][0] + (next[0] - path[index][0]) * fraction,
      path[index][1] + (next[1] - path[index][1]) * fraction];
  }

  function draw() {
    if (!paths || !width || !height) return;
    const ctx = context;
    ctx.clearRect(0, 0, width, height);
    const side = Math.min(width - 44, height - 30);
    const range = Math.max(bounds[1] - bounds[0], bounds[3] - bounds[2]);
    const scale = side / range;
    const left = (width - side) / 2;
    const top = (height - side) / 2;
    const cx = (bounds[0] + bounds[1]) / 2;
    const cy = (bounds[2] + bounds[3]) / 2;
    const px = x => width / 2 + (x - cx) * scale;
    const py = y => height / 2 - (y - cy) * scale;

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, side, side);
    ctx.clip();
    ctx.fillStyle = '#fbfcfc';
    ctx.fillRect(left, top, side, side);
    // Occupied cells of the original 4 × 4 checkerboard target.
    for (let ix = 0; ix < 4; ix++) {
      for (let iy = 0; iy < 4; iy++) {
        if ((ix + iy) % 2 !== 0) continue;
        ctx.fillStyle = '#e9eff1';
        ctx.fillRect(px(ix - 2), py(iy - 1), scale, scale);
      }
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#dfe6e9';
    for (let value = -2; value <= 2; value++) {
      ctx.beginPath();
      ctx.moveTo(px(value), top); ctx.lineTo(px(value), top + side);
      ctx.moveTo(left, py(value)); ctx.lineTo(left + side, py(value));
      ctx.stroke();
    }

    for (const name of ['h', 'x']) {
      const path = paths[name];
      const lastIndex = Math.floor(progress * (path.length - 1));
      const point = currentPoint(path);
      ctx.strokeStyle = colors[name];
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash(name === 'h' ? [6, 6] : []);
      // Pale complete paths preserve context while the saturated trace grows.
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      path.forEach((p, i) => i ? ctx.lineTo(px(p[0]), py(p[1])) : ctx.moveTo(px(p[0]), py(p[1])));
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px(path[0][0]), py(path[0][1]));
      for (let i = 1; i <= lastIndex; i++) ctx.lineTo(px(path[i][0]), py(path[i][1]));
      ctx.lineTo(px(point[0]), py(point[1]));
      ctx.stroke();
      ctx.setLineDash([]);

      const startX = px(path[0][0]), startY = py(path[0][1]);
      ctx.globalAlpha = .45;
      ctx.fillStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (name === 'x') ctx.arc(startX, startY, 3, 0, Math.PI * 2);
      else ctx.rect(startX - 3, startY - 3, 6, 6);
      ctx.fill(); ctx.stroke();
      ctx.globalAlpha = 1;

      const x = px(point[0]), y = py(point[1]);
      ctx.fillStyle = colors[name];
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = `${colors[name]}33`;
      ctx.shadowBlur = 9;
      ctx.beginPath();
      if (name === 'x') ctx.arc(x, y, 6.5, 0, Math.PI * 2);
      else ctx.roundRect(x - 6, y - 6, 12, 12, 2);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.font = 'italic 16px Georgia, serif';
      ctx.fillText(name.toUpperCase(), x + 12, y + (name === 'x' ? -10 : 20));
    }
    ctx.restore();
    ctx.strokeStyle = '#dfe5e7';
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, side, side);
  }

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  play.addEventListener('click', () => {
    if (!playing && progress >= 1) { elapsed = 0; updateProgress(0); }
    setPlaying(!playing);
  });
  replay.addEventListener('click', () => {
    elapsed = 0;
    updateProgress(0);
    setPlaying(true);
  });
  slider.addEventListener('input', () => {
    setPlaying(false);
    elapsed = Number(slider.value) / 1000 * duration;
    updateProgress(elapsed / duration);
  });
  document.addEventListener('visibilitychange', () => {
    if (playing) setPlaying(true);
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches && paths) {
      setPlaying(false);
      elapsed = duration;
      updateProgress(1);
    }
  });

  function validPath(path) {
    return Array.isArray(path) && path.length > 1 && path.every(point =>
      Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));
  }

  async function initialize() {
    try {
      if (!context) throw new Error('Canvas unavailable');
      const response = await fetch('assets/checkerboard-trajectories.json');
      if (!response.ok) throw new Error('Trajectory data unavailable');
      const data = await response.json();
      const pair = data.trajectories?.[0];
      if (!pair || !validPath(pair.x) || !validPath(pair.h)) throw new Error('Invalid trajectories');
      const extent = data.zoomBounds || data.bounds;
      if (!Array.isArray(extent) || extent.length !== 4 || !extent.every(Number.isFinite)
        || extent[1] <= extent[0] || extent[3] <= extent[2]) throw new Error('Invalid plot bounds');
      paths = pair;
      bounds = extent;
      canvas.hidden = false;
      poster.hidden = true;
      controls.hidden = false;
      resize();
      new ResizeObserver(resize).observe(canvas.parentElement);
      elapsed = reducedMotion.matches ? duration : 0;
      updateProgress(reducedMotion.matches ? 1 : 0);
      setPlaying(!reducedMotion.matches);
    } catch (error) {
      setPlaying(false);
      canvas.hidden = true;
      poster.hidden = false;
      controls.hidden = true;
      document.getElementById('load-message').hidden = false;
    }
  }

  initialize();
})();
