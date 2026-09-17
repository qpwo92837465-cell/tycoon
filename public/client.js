const socket = io();
let myData = null, otherPlayers = {}, jobsCache = [], vendingCache = [];
let myPos = { x: 400, y: 250 };
const keys = {};

window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

function showToast(msg, isSuccess = true) {
  const toast = document.createElement('div');
  toast.className = `toast ${isSuccess ? '' : 'error'}`;
  toast.textContent = msg;
  document.getElementById('toast-box').appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn, .tab-panel').forEach(el => el.classList.remove('active'));
    btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

document.getElementById('btn-register').onclick = () => socket.emit('auth:register', { username: document.getElementById('auth-username').value, password: document.getElementById('auth-password').value });
document.getElementById('btn-login').onclick = () => socket.emit('auth:login', { username: document.getElementById('auth-username').value, password: document.getElementById('auth-password').value });

socket.on('notify', d => showToast(d.msg, d.success));
socket.on('auth:success', ({ username, userData, stocks, jobs, vending }) => {
  document.getElementById('auth-modal').classList.add('hidden');
  document.getElementById('game-app').classList.remove('hidden');
  myData = userData; jobsCache = jobs; vendingCache = vending;
  renderAll();
  startCanvasLoop();
});

socket.on('player:sync', data => { myData = data; renderAll(); });
socket.on('players:update', players => { otherPlayers = players; });

function renderAll() {
  const maxH = myData.maxHunger || 100;
  document.getElementById('hud-username').textContent = myData.username;
  document.getElementById('hud-money').textContent = `₩${myData.money.toLocaleString()}`;
  document.getElementById('hud-job').textContent = jobsCache[myData.jobIndex]?.name || '무직';
  document.getElementById('hud-hunger-bar').style.width = `${(myData.hunger / maxH) * 100}%`;
  document.getElementById('hud-hunger-val').textContent = `${myData.hunger} / ${maxH}`;

  if(myData.isAdmin) document.getElementById('tab-btn-admin').classList.remove('hidden');

  document.getElementById('job-list').innerHTML = jobsCache.map((j, idx) => `
    <div class="card-item" style="${myData.jobIndex === idx ? 'border-color:var(--primary); background:#1e293b;' : ''}">
      <div>
        <h4>${j.name} ${myData.jobIndex === idx ? '(현재)' : ''}</h4>
        <p class="desc-text">월급: ₩${j.salary.toLocaleString()} / 30초 | 에너지: -${j.workEnergyCost}</p>
      </div>
      <div style="font-size:12px; text-align:right;">승진조건<br><strong>₩${j.reqMoney.toLocaleString()}</strong></div>
    </div>`).join('');

  const inv = myData.inventory || {};
  document.getElementById('inventory-list').innerHTML = Object.keys(inv).length === 0 ? '<p style="color:gray;">가방이 비었습니다.</p>' :
    Object.keys(inv).map(id => `<div class="card-item"><span>${id} (${inv[id]}개)</span><button class="btn success" style="width:auto;padding:5px 10px;" onclick="socket.emit('inventory:use','${id}')">사용/판매</button></div>`).join('');

  document.getElementById('vending-list').innerHTML = vendingCache.map(i => `
    <div class="card-item"><span>${i.name} (₩${i.cost.toLocaleString()})</span><button class="btn primary" style="width:auto;padding:5px 10px;" onclick="socket.emit('vending:buy','${i.id}')">구매</button></div>`).join('');

  const up = myData.upgrades || { fishingRod: 1, stomach: 1 };
  document.getElementById('rod-info').textContent = `현재 Lv.${up.fishingRod} (비용: ₩${(up.fishingRod * 150000).toLocaleString()})`;
  document.getElementById('stomach-info').textContent = `현재 Lv.${up.stomach} (최대 포만감: ${maxH}, 비용: ₩${(up.stomach * 250000).toLocaleString()})`;
}

function startCanvasLoop() {
  const canvas = document.getElementById('world-canvas');
  const ctx = canvas.getContext('2d');

  setInterval(() => {
    let moved = false;
    if (keys['ArrowUp'] || keys['w']) { myPos.y -= 3; moved = true; }
    if (keys['ArrowDown'] || keys['s']) { myPos.y += 3; moved = true; }
    if (keys['ArrowLeft'] || keys['a']) { myPos.x -= 3; moved = true; }
    if (keys['ArrowRight'] || keys['d']) { myPos.x += 3; moved = true; }

    if (moved) socket.emit('player:move', myPos);

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1f2937';
    ctx.fillRect(50, 50, 120, 80); ctx.fillStyle = '#fff'; ctx.fillText('🏪 편의점', 75, 95);
    ctx.fillRect(630, 50, 120, 80); ctx.fillStyle = '#fff'; ctx.fillText('🎣 힐링 낚시터', 645, 95);

    for (let id in otherPlayers) {
      let p = otherPlayers[id];
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText(p.username, p.x - 15, p.y - 18);
    }

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(myPos.x, myPos.y, 14, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(myData.username + ' (나)', myPos.x - 20, myPos.y - 20);

  }, 1000 / 60);
}

window.execAdmin = (command, value) => {
  const targetUser = document.getElementById('admin-target').value.trim();
  if(!targetUser || !value) return alert('대상 유저와 값을 입력하세요.');
  socket.emit('admin:execute', { targetUser, command, value });
};
