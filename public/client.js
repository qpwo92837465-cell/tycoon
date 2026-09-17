const socket = io();
let myData = null, stocksCache = [], jobListCache = [], questListCache = [];

function showToast(msg, isSuccess = true) {
  const toast = document.createElement('div');
  toast.className = `toast ${isSuccess ? 'success' : 'error'}`;
  toast.textContent = msg;
  document.getElementById('toast-box').appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn, .tab-panel').forEach(el => el.classList.remove('active'));
    btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

document.getElementById('btn-register').onclick = () => socket.emit('auth:register', { username: document.getElementById('auth-username').value, password: document.getElementById('auth-password').value });
document.getElementById('btn-login').onclick = () => socket.emit('auth:login', { username: document.getElementById('auth-username').value, password: document.getElementById('auth-password').value });

socket.on('notify', data => showToast(data.msg, data.success));
socket.on('auth:success', ({ userData, stocks, jobs, vending, questList }) => {
  document.getElementById('auth-modal').classList.add('hidden'); document.getElementById('game-app').classList.remove('hidden');
  myData = userData; stocksCache = stocks; jobListCache = jobs; questListCache = questList;
  renderAll(vending);
});

socket.on('player:sync', data => { myData = data; renderAll(); });
socket.on('player:sync:all', () => { if(myData) socket.emit('auth:login', { username: myData.username, password: '' }); });
socket.on('hunger:tick', () => { if(myData && myData.hunger>0) { myData.hunger -= 2; renderHUD(); } });
socket.on('stocks:update', stocks => { stocksCache = stocks; renderStocks(); });

function renderAll(vendingItems = null) { renderHUD(); renderJobs(); renderQuests(); renderStocks(); if(vendingItems) renderVending(vendingItems); }

function renderHUD() {
  document.getElementById('hud-username').textContent = myData.username;
  document.getElementById('hud-money').textContent = `₩${myData.money.toLocaleString()}`;
  document.getElementById('hud-job').textContent = jobListCache[myData.jobIndex]?.name || '무직';
  document.getElementById('hud-hunger-bar').style.width = `${myData.hunger}%`;
  document.getElementById('hud-hunger-val').textContent = `${myData.hunger} / 100`;
  const adminTag = document.getElementById('hud-admin-tag');
  if(myData.isAdmin) { adminTag.textContent = '👑 ADMIN'; adminTag.className = 'user-badge admin'; document.getElementById('tab-btn-admin').classList.remove('hidden'); }
}

function renderJobs() {
  document.getElementById('job-career-path').innerHTML = jobListCache.map((job, idx) => `
    <div class="card-item" style="${myData.jobIndex===idx ? 'border-color:var(--primary)' : ''}">
      <h4>${job.name} ${myData.jobIndex===idx ? '(현재)' : ''}</h4>
      <p>월급: ₩${job.salary.toLocaleString()} | 에너지: -${job.workEnergyCost} | 승진조건: ₩${job.reqMoney.toLocaleString()}</p>
    </div>`).join('');
}

function renderVending(items) {
  document.getElementById('vending-item-list').innerHTML = items.map(item => `
    <div class="card-item"><h4>${item.name} (+${item.restoreHunger}포만감)</h4><button class="btn primary" onclick="socket.emit('vending:buy','${item.id}')">₩${item.cost.toLocaleString()} 구매</button></div>`).join('');
}

function renderQuests() {
  const now = Date.now();
  document.getElementById('quest-item-list').innerHTML = questListCache.map(q => {
    const cd = Math.ceil((((myData.quests&&myData.quests[q.id])||0) + q.cooldownSec*1000 - now)/1000);
    return `<div class="card-item"><h4>${q.title}</h4><p>보상: ₩${q.rewardMoney.toLocaleString()} | 에너지: -${q.hungerCost}</p><button class="btn ${cd>0?'secondary':'primary'}" ${cd>0?'disabled':''} onclick="socket.emit('quest:start','${q.id}')">${cd>0?`대기(${cd}초)`:'수행'}</button></div>`;
  }).join('');
}

function renderStocks() {
  document.getElementById('stock-market-list').innerHTML = stocksCache.map(s => `
    <div class="card-item"><h4>${s.name} (${s.symbol})</h4><div class="text-green">₩${s.price.toLocaleString()}</div><p>보유: ${(myData.stocks&&myData.stocks[s.symbol])||0}주</p><div style="display:flex;gap:5px;"><button class="btn primary" onclick="if(confirm('1주 매수?')) socket.emit('stock:buy',{symbol:'${s.symbol}',amount:1})">매수</button><button class="btn secondary" onclick="if(confirm('1주 매도?')) socket.emit('stock:sell',{symbol:'${s.symbol}',amount:1})">매도</button></div></div>`).join('');
}

document.getElementById('btn-do-work').onclick = () => socket.emit('action:work');
document.getElementById('btn-promote').onclick = () => socket.emit('action:promote');
document.getElementById('btn-admin-give-money').onclick = () => socket.emit('admin:action', { targetUser: document.getElementById('admin-target-user').value, action: 'give_money', value: 100000000 });
document.getElementById('btn-admin-feed').onclick = () => socket.emit('admin:action', { targetUser: document.getElementById('admin-target-user').value, action: 'full_hunger' });

window.playCasino = (game, action, extra = null) => {
  let payload = {};
  if (game === 'dice') payload = { bet: document.getElementById('dice-bet').value, target: document.getElementById('dice-target').value };
  if (game === 'baccarat') payload = { bet: document.getElementById('bac-bet').value, betOn: extra };
  if (game === 'roulette') payload = { bet: document.getElementById('roulette-bet').value, betType: extra };
  if (game === 'mines' && action === 'start') payload = { bet: document.getElementById('mines-bet').value, minesCount: document.getElementById('mines-count').value };
  if (game === 'mines' && action === 'click') payload = { index: extra };
  if (game === 'blackjack' && action === 'start') payload = { bet: document.getElementById('bj-bet').value };
  socket.emit('casino:action', { game, action, payload });
};

socket.on('casino:state', res => {
  if (res.game === 'blackjack') {
    document.getElementById('btn-bj-start').classList.add('hidden'); document.getElementById('btn-bj-hit').classList.remove('hidden'); document.getElementById('btn-bj-stand').classList.remove('hidden'); document.getElementById('bj-table').classList.remove('hidden');
    document.getElementById('p-cards').textContent = '내 패: ' + res.pHand.map(c => c.suit+c.val).join(','); document.getElementById('d-cards').textContent = '딜러: ' + res.dHand.map(c => c.suit+c.val).join(',');
  }
  if (res.game === 'mines') {
    const grid = document.getElementById('mines-grid'); grid.classList.remove('hidden');
    document.getElementById('btn-mines-start').classList.add('hidden'); document.getElementById('btn-mines-cashout').classList.remove('hidden');
    if (res.state === 'playing' && res.clicked === undefined) {
      grid.innerHTML = Array(25).fill().map((_,i) => `<button class="mine-btn" onclick="playCasino('mines','click',${i})"></button>`).join('');
    } else if (res.clicked !== undefined) {
      grid.children[res.clicked].classList.add('safe'); grid.children[res.clicked].textContent = '💎'; grid.children[res.clicked].disabled = true; document.getElementById('mines-multi').textContent = `(x${res.multi})`;
    }
  }
});

socket.on('casino:result', res => {
  document.getElementById('casino-log').textContent = res.msg; showToast(res.msg, res.win);
  if (res.game === 'blackjack') {
    document.getElementById('p-cards').textContent = '내 패: ' + res.pHand.map(c => c.suit+c.val).join(','); document.getElementById('d-cards').textContent = '딜러: ' + res.dHand.map(c => c.suit+c.val).join(',');
    setTimeout(() => { document.getElementById('btn-bj-start').classList.remove('hidden'); document.getElementById('btn-bj-hit').classList.add('hidden'); document.getElementById('btn-bj-stand').classList.add('hidden'); }, 2000);
  }
  if (res.game === 'mines') {
    const grid = document.getElementById('mines-grid');
    res.grid.forEach((t, i) => { grid.children[i].disabled = true; if(t==='mine'){ grid.children[i].classList.add('boom'); grid.children[i].textContent='💣'; }else{ grid.children[i].textContent='💎'; } });
    setTimeout(() => { document.getElementById('btn-mines-start').classList.remove('hidden'); document.getElementById('btn-mines-cashout').classList.add('hidden'); grid.classList.add('hidden'); document.getElementById('mines-multi').textContent = ''; }, 2000);
  }
});
