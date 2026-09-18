const socket = io();
let myData = null, otherPlayers = {}, jobsCache = [], vendingCache = [];
let myPos = { x: 1000, y: 1000 }; // 넓은 맵 내 시작 위치
let currentBuilding = null, isFishing = false, fishingTimer = null;
const keys = {};

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'e' && currentBuilding) {
    openBuildingModal(currentBuilding);
  }
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

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
}

// 2D 카메라 팔로우 월드 렌더러
function startCanvasLoop() {
  const canvas = document.getElementById('world-canvas');
  const ctx = canvas.getContext('2d');

  // 대형 월드 건물 배치 정의 (x, y, width, height, name, id)
  const buildings = [
    { x: 200, y: 200, w: 140, h: 100, name: '🏪 24시 편의점', id: 'vending' },
    { x: 1200, y: 200, w: 140, h: 100, name: '🎣 힐링 낚시터', id: 'fishing' },
    { x: 700, y: 900, w: 140, h: 100, name: '⚡ 캐릭터 상점', id: 'upgrade' }
  ];

  setInterval(() => {
    let moved = false;
    let speed = 4;
    if (keys['arrowup'] || keys['w']) { myPos.y -= speed; moved = true; }
    if (keys['arrowdown'] || keys['s']) { myPos.y += speed; moved = true; }
    if (keys['arrowleft'] || keys['a']) { myPos.x -= speed; moved = true; }
    if (keys['arrowright'] || keys['d']) { myPos.x += speed; moved = true; }

    if (moved) socket.emit('player:move', myPos);

    // 카메라 중심점 계산 (캐릭터를 화면 정중앙에 고정)
    const camX = canvas.width / 2 - myPos.x;
    const camY = canvas.height / 2 - myPos.y;

    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(camX, camY);

    // 월드 바닥 그리드 및 테두리 (가상 2000x2000 맵)
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 2000, 2000);

    // 건물들 렌더링
    let nearBuilding = null;
    buildings.forEach(b => {
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#3b82f6';
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(b.name, b.x + 15, b.y + 55);

      // 플레이어와 건물 간 거리 체크 (충돌 및 인터랙션 반경)
      const dist = Math.hypot((myPos.x) - (b.x + b.w / 2), (myPos.y) - (b.y + b.h / 2));
      if (dist < 100) {
        nearBuilding = b.id;
      }
    });

    currentBuilding = nearBuilding;
    const popup = document.getElementById('interaction-popup');
    if (currentBuilding) popup.classList.remove('hidden');
    else popup.classList.add('hidden');

    // 다른 플레이어들 그리기
    for (let id in otherPlayers) {
      let p = otherPlayers[id];
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(p.username, p.x - 15, p.y - 20);
    }

    // 내 캐릭터 그리기
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(myPos.x, myPos.y, 16, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(myData.username + ' (나)', myPos.x - 22, myPos.y - 22);

    ctx.restore();
  }, 1000 / 60);
}

// 건물 모달 창 오픈 로직
function openBuildingModal(id) {
  const modal = document.getElementById('building-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  modal.classList.remove('hidden');

  if (id === 'vending') {
    title.textContent = '🏪 24시 편의점 & 미끼 상점';
    body.innerHTML = vendingCache.map(i => `
      <div class="card-item">
        <span>${i.name} (₩${i.cost.toLocaleString()})</span>
        <button class="btn primary" style="width:auto;padding:6px 12px;" onclick="socket.emit('vending:buy','${i.id}')">구매</button>
      </div>`).join('');
  } else if (id === 'upgrade') {
    title.textContent = '⚡ 캐릭터 강화 상점';
    const up = myData.upgrades || { fishingRod: 1, stomach: 1 };
    const maxH = myData.maxHunger || 100;
    body.innerHTML = `
      <div class="card-item">
        <div><h4>🎣 낚싯대 강화 (현재 Lv.${up.fishingRod})</h4><p class="desc-text">비용: ₩${(up.fishingRod * 150000).toLocaleString()}</p></div>
        <button class="btn success" style="width:auto;padding:8px;" onclick="socket.emit('upgrade:buy','fishingRod')">강화</button>
      </div>
      <div class="card-item">
        <div><h4>🍖 위장 강화 (현재 최대 포만감: ${maxH})</h4><p class="desc-text">비용: ₩${(up.stomach * 250000).toLocaleString()}</p></div>
        <button class="btn success" style="width:auto;padding:8px;" onclick="socket.emit('upgrade:buy','stomach')">강화</button>
      </div>`;
  } else if (id === 'fishing') {
    title.textContent = '🎣 힐링 낚시터';
    body.innerHTML = `
      <p>미끼를 장착하고 대어를 낚아보세요!</p>
      <button class="btn primary huge" id="btn-fish-action" style="margin-top:15px;padding:15px;" onclick="startFishingProcess()">🎣 낚싯대 던지기 (3초 쿨타임)</button>
      <div id="fishing-status-text" style="margin-top:10px;text-align:center;color:#f59e0b;font-weight:bold;"></div>`;
  }
}

function closeModal() {
  document.getElementById('building-modal').classList.add('hidden');
  if (isFishing) {
    clearTimeout(fishingTimer);
    isFishing = false;
  }
}

// 낚시 프로세스 (3초 쿨타임 + 5초 대기 연출)
function startFishingProcess() {
  if (isFishing) return;
  const btn = document.getElementById('btn-fish-action');
  const status = document.getElementById('fishing-status-text');

  isFishing = true;
  btn.disabled = true;
  btn.style.background = '#374151';

  status.textContent = '⏳ 낚싯대를 정중앙에 던졌습니다... (3초 대기)';
  
  setTimeout(() => {
    status.textContent = '🌊 찌가 물 위에 둥둥 떠 있습니다... 입질을 기다리는 중 (5초)';
    
    fishingTimer = setTimeout(() => {
      socket.emit('fish:catch');
      status.textContent = '🎉 물고기가 걸렸습니다! 인벤토리를 확인하세요.';
      isFishing = false;
      btn.disabled = false;
      btn.style.background = '#3b82f6';
    }, 5000);

  }, 3000);
}
