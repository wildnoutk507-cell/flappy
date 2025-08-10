// Flappy Bird–style game, mobile friendly, with DPR-aware canvas scaling and offline-friendly assets.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const UI = {
  score: document.getElementById('score'),
  high: document.getElementById('high'),
  menu: document.getElementById('menu'),
  playBtn: document.getElementById('playBtn'),
  gameOver: document.getElementById('gameOver'),
  finalScore: document.getElementById('finalScore'),
  retryBtn: document.getElementById('retryBtn'),
  tapBtn: document.getElementById('tapBtn'),
};

// High score persistence
let highScore = Number(localStorage.getItem('flappy_high') || 0);
UI.high.textContent = `Best: ${highScore}`;

// Responsive canvas scaling
function fitCanvas() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  const w = Math.floor(rect.width * dpr);
  const h = Math.floor(rect.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
window.addEventListener('resize', fitCanvas, { passive: true });
fitCanvas();

// Game constants (logical units are based on 600x800 design; we scale drawing)
const DESIGN_W = 600;
const DESIGN_H = 800;

// Scale helper from design space to current canvas
function sx(x) { return x * (canvas.width / DESIGN_W); }
function sy(y) { return y * (canvas.height / DESIGN_H); }

// Bird
const bird = {
  x: 140,
  y: DESIGN_H * 0.45,
  vy: 0,
  r: 18,
};
const GRAVITY = 0.38;
const FLAP = -7.2;
const MAX_FALL = 11;

// Pipes
let pipes = [];
const PIPE_GAP = 190;
const PIPE_W = 80;
let pipeSpeed = 2.8;
let spawnTimer = 0;
const SPAWN_INTERVAL = 95; // frames

// Ground visual (simple)
let groundY = 740;

// Game state
let running = false;
let started = false;
let score = 0;
let frame = 0;
let gameOver = false;

// Input
function flap() {
  if (!running && !started) {
    startGame();
    return;
  }
  if (running) {
    bird.vy = FLAP;
  }
}
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') flap();
  if (e.code === 'KeyP') togglePause();
});
// Touch/tap
UI.tapBtn.addEventListener('click', flap);
canvas.addEventListener('pointerdown', flap);
UI.playBtn.addEventListener('click', () => startGame());
UI.retryBtn.addEventListener('click', () => resetGame());

function togglePause() {
  running = !running;
  if (running) requestAnimationFrame(loop);
}

// Game control
function startGame() {
  started = true;
  running = true;
  UI.menu.classList.add('hidden');
  UI.gameOver.classList.add('hidden');
  requestAnimationFrame(loop);
}

function resetGame() {
  bird.x = 140;
  bird.y = 400;
  bird.vy = 0;
  pipes = [];
  score = 0;
  frame = 0;
  gameOver = false;
  pipeSpeed = 3.2;
  spawnTimer = 0;
  UI.score.textContent = '0';
  UI.gameOver.classList.add('hidden');
  running = true;
  requestAnimationFrame(loop);
}

// Helpers
function rand(min, max) { return Math.random() * (max - min) + min; }

function addPipe() {
  const safeTop = 120 + PIPE_GAP / 2;               // keep away from ceiling
  const safeBottom = groundY - 120 - PIPE_GAP / 2;  // keep above ground
  const holeY = rand(safeTop, safeBottom);
  pipes.push({ x: DESIGN_W + PIPE_W, holeY, passed: false });
}

function collide(b, p) {
  // Bird circle vs axis-aligned rectangles (top & bottom pipe)
  const bx = b.x;
  const by = b.y;
  const r = b.r;
  // Top pipe rect: (p.x, 0) to (p.x+PIPE_W, p.holeY - PIPE_GAP/2)
  // Bottom pipe rect: (p.x, p.holeY + PIPE_GAP/2) to bottom
  const topRect = { x: p.x, y: 0, w: PIPE_W, h: p.holeY - PIPE_GAP/2 };
  const botRect = { x: p.x, y: p.holeY + PIPE_GAP/2, w: PIPE_W, h: DESIGN_H };

  function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
    const testX = Math.max(rx, Math.min(cx, rx + rw));
    const testY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - testX;
    const dy = cy - testY;
    return (dx*dx + dy*dy) <= cr*cr;
  }
  return circleRectCollide(bx, by, r, topRect.x, topRect.y, topRect.w, topRect.h) ||
         circleRectCollide(bx, by, r, botRect.x, botRect.y, botRect.w, botRect.h);
}

// Drawing
function drawBackground() {
  // Simple clouds
  ctx.save();
  ctx.globalAlpha = 0.65;
  const clouds = 3;
  for (let i=0;i<clouds;i++) {
    const cx = (frame * 0.2 + i * 220) % (DESIGN_W + 200) - 100;
    const cy = 120 + i * 80;
    drawCloud(cx, cy, 40 + i*6);
  }
  ctx.restore();
}

function drawCloud(x, y, r) {
  ctx.beginPath();
  ctx.arc(sx(x), sy(y), sx(r), 0, Math.PI*2);
  ctx.arc(sx(x + r), sy(y + 10), sx(r*0.85), 0, Math.PI*2);
  ctx.arc(sx(x - r), sy(y + 15), sx(r*0.9), 0, Math.PI*2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
}

function drawBird() {
  // body
  ctx.save();
  const tilt = Math.max(-0.35, Math.min(0.45, bird.vy / 12));
  ctx.translate(sx(bird.x), sy(bird.y));
  ctx.rotate(tilt);
  // body
  ctx.fillStyle = "#ffd700";
  ctx.beginPath();
  ctx.arc(0, 0, sx(bird.r), 0, Math.PI*2);
  ctx.fill();
  // wing
  ctx.fillStyle = "#ffe680";
  ctx.beginPath();
  ctx.ellipse(sx(-6), sy(2), sx(10), sy(6), 0, 0, Math.PI*2);
  ctx.fill();
  // beak
  ctx.fillStyle = "#ff8c00";
  ctx.beginPath();
  ctx.moveTo(sx(10), 0);
  ctx.lineTo(sx(22), sy(-5));
  ctx.lineTo(sx(22), sy(5));
  ctx.closePath();
  ctx.fill();
  // eye
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(sx(4), sy(-6), sx(5), 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(sx(5), sy(-6), sx(2), 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawPipes() {
  ctx.fillStyle = "#2fbf71";
  for (const p of pipes) {
    // top
    ctx.fillRect(sx(p.x), sy(0), sx(PIPE_W), sy(p.holeY - PIPE_GAP/2));
    // bottom
    ctx.fillRect(sx(p.x), sy(p.holeY + PIPE_GAP/2), sx(PIPE_W), sy(DESIGN_H));
    // rims
    ctx.fillStyle = "#249e5e";
    ctx.fillRect(sx(p.x - 4), sy(p.holeY - PIPE_GAP/2 - 22), sx(PIPE_W + 8), sy(22));
    ctx.fillRect(sx(p.x - 4), sy(p.holeY + PIPE_GAP/2), sx(PIPE_W + 8), sy(22));
    ctx.fillStyle = "#2fbf71";
  }
}

function drawGround() {
  ctx.fillStyle = "#c0841a";
  ctx.fillRect(0, sy(groundY), canvas.width, sy(DESIGN_H - groundY));
  // stripes
  ctx.fillStyle = "#f6ad2e";
  for (let i=0;i<12;i++) {
    const gx = (i*80 - (frame*pipeSpeed*2)%80);
    ctx.fillRect(sx(gx), sy(groundY), sx(40), sy(10));
  }
}

function drawScore() {
  UI.score.textContent = String(score);
}

// Main loop
function loop() {
  if (!running) return;
  frame++;

  // physics
  bird.vy += GRAVITY;
  bird.vy = Math.min(bird.vy, MAX_FALL);
  bird.y += bird.vy;

  // spawn pipes
  spawnTimer++;
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer = 0;
    addPipe();
  }

  // move pipes & scoring
  for (const p of pipes) {
    p.x -= pipeSpeed;
    if (!p.passed && p.x + PIPE_W < bird.x - bird.r) {
      p.passed = true;
      score++;
      pipeSpeed += 0.05; // difficulty ramps
    }
  }
  // remove offscreen pipes
  pipes = pipes.filter(p => p.x + PIPE_W > -40);

  // collisions
  if (bird.y + bird.r > groundY || bird.y - bird.r < 0) {
    return endGame();
  }
  for (const p of pipes) {
    if (collide(bird, p)) return endGame();
  }

  // draw
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPipes();
  drawGround();
  drawBird();
  drawScore();

  requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  gameOver = true;
  UI.finalScore.textContent = `Score: ${score}`;
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('flappy_high', String(highScore));
  }
  UI.high.textContent = `Best: ${highScore}`;
  UI.gameOver.classList.remove('hidden');
}