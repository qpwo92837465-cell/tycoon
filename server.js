const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rczxhjndnrsjzihmzbqr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hBQ1_MFYQaDBt5jPFWONcg_NXN2NqOV';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

async function getUserByUsername(username) {
  const { data } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
  return data;
}

async function saveUser(userObj) {
  const payload = {
    username: userObj.username,
    passwordhash: userObj.passwordHash || userObj.passwordhash,
    money: userObj.money,
    jobindex: userObj.jobIndex !== undefined ? userObj.jobIndex : userObj.jobindex,
    hunger: userObj.hunger,
    maxhunger: userObj.maxHunger || userObj.maxhunger || 100,
    isadmin: userObj.isAdmin !== undefined ? userObj.isAdmin : userObj.isadmin,
    stocks: userObj.stocks || {},
    inventory: userObj.inventory || {},
    upgrades: userObj.upgrades || { fishingRod: 1, stomach: 1 }
  };
  await supabase.from('users').upsert([payload], { onConflict: 'username' });
}

const JOBS = [
  { id: 'job_0', name: '무직 / 취준생', salary: 0, reqMoney: 0, workEnergyCost: 0 },
  { id: 'job_1', name: '편의점 야간 알바', salary: 35000, reqMoney: 0, workEnergyCost: 5 },
  { id: 'job_2', name: '동네 카페 바리스타', salary: 85000, reqMoney: 300000, workEnergyCost: 8 },
  { id: 'job_3', name: '중소기업 평사원', salary: 220000, reqMoney: 1200000, workEnergyCost: 11 },
  { id: 'job_4', name: '대기업 대리', salary: 650000, reqMoney: 5000000, workEnergyCost: 14 },
  { id: 'job_5', name: '대기업 팀장', salary: 1800000, reqMoney: 22000000, workEnergyCost: 17 },
  { id: 'job_6', name: '대기업 임원 (이사)', salary: 5000000, reqMoney: 100000000, workEnergyCost: 20 },
  { id: 'job_7', name: '스타트업 대표 (CEO)', salary: 15000000, reqMoney: 450000000, workEnergyCost: 23 },
  { id: 'job_8', name: '중견기업 총괄 회장', salary: 45000000, reqMoney: 2000000000, workEnergyCost: 26 },
  { id: 'job_9', name: '글로벌 대기업 회장', salary: 130000000, reqMoney: 9000000000, workEnergyCost: 29 },
  { id: 'job_10', name: '세계적인 재벌 총수', salary: 400000000, reqMoney: 40000000000, workEnergyCost: 32 },
  { id: 'job_11', name: '우주 개척 기업 총사령관', salary: 1500000000, reqMoney: 180000000000, workEnergyCost: 35 }
];

const VENDING_ITEMS = [
  { id: 'water', name: '생수', cost: 1000, restoreHunger: 15 },
  { id: 'snack', name: '초코바', cost: 3500, restoreHunger: 35 },
  { id: 'gimbap', name: '참치 삼각김밥', cost: 7000, restoreHunger: 60 },
  { id: 'bento', name: '프리미엄 도시락', cost: 25000, restoreHunger: 100 },
  { id: 'steak', name: '한우 특상 스테이크', cost: 120000, restoreHunger: 180 },
  { id: 'bait_normal', name: '지렁이 미끼', cost: 5000, type: 'bait', bonus: 1 },
  { id: 'bait_gold', name: '황금 새우 미끼', cost: 30000, type: 'bait', bonus: 2.5 }
];

const FISH_ITEMS = [
  { id: 'fish_small', name: '피라미', value: 15000, chance: 50 },
  { id: 'fish_mid', name: '월척 잉어', value: 50000, chance: 30 },
  { id: 'fish_big', name: '대왕 연어', value: 180000, chance: 15 },
  { id: 'fish_rare', name: '황금 상어', value: 850000, chance: 4.5 },
  { id: 'fish_legend', name: '네스호 고대 심해어', value: 4000000, chance: 0.5 }
];

let STOCKS = [
  { symbol: 'NVX', name: '엔빅스 테크놀로지', price: 150000, min: 20000, max: 2000000 },
  { symbol: 'BIO', name: '그린 바이오팜', price: 42000, min: 5000, max: 800000 },
  { symbol: 'SPX', name: '스페이스 코스모', price: 310000, min: 50000, max: 5000000 },
  { symbol: 'COIN', name: '도지 로켓 코인', price: 1200, min: 50, max: 100000 },
];

setInterval(() => {
  STOCKS.forEach(s => {
    const rate = (Math.random() * 0.24 - 0.11);
    s.price = Math.max(s.min, Math.min(s.max, Math.round(s.price * (1 + rate))));
  });
  io.emit('stocks:update', STOCKS);
}, 5000);

setInterval(async () => {
  const { data: users } = await supabase.from('users').select('*');
  if (!users) return;
  for (let u of users) {
    const job = JOBS[u.jobindex] || JOBS[0];
    if (u.hunger > 0 && job.salary > 0) {
      u.money += job.salary;
      u.hunger = Math.max(0, u.hunger - job.workEnergyCost);
      await saveUser(u);
    }
  }
  io.emit('player:sync:all');
}, 30000);

app.use(express.static(path.join(__dirname, 'public')));
const onlinePlayers = {};

io.on('connection', (socket) => {
  let currentUser = null;

  async function syncUser() {
    if (!currentUser) return;
    const u = await getUserByUsername(currentUser);
    if (u) {
      socket.emit('player:sync', {
        username: u.username, money: u.money, jobIndex: u.jobindex,
        hunger: u.hunger, maxHunger: u.maxhunger || 100, isAdmin: u.isadmin,
        inventory: u.inventory || {}, upgrades: u.upgrades || { fishingRod: 1, stomach: 1 }
      });
    }
  }

  socket.on('auth:register', async ({ username, password }) => {
    if (!username || username.trim().length < 2) return socket.emit('notify', { success: false, msg: '아이디는 2자 이상 입력해주세요.' });
    if (await getUserByUsername(username)) return socket.emit('notify', { success: false, msg: '이미 존재하는 아이디입니다.' });
    await saveUser({ username, passwordHash: hashPassword(password), money: 200000, jobIndex: 0, hunger: 100, maxHunger: 100, isAdmin: false, inventory: {}, upgrades: { fishingRod: 1, stomach: 1 } });
    socket.emit('notify', { success: true, msg: '가입 완료! 로그인하세요.' });
  });

  socket.on('auth:login', async ({ username, password }) => {
    const u = await getUserByUsername(username);
    if (!u || u.passwordhash !== hashPassword(password)) return socket.emit('notify', { success: false, msg: '로그인 실패' });
    currentUser = username;
    onlinePlayers[socket.id] = { username, x: 600, y: 600 };

    socket.emit('auth:success', {
      username,
      userData: { 
        username: u.username, money: u.money, jobIndex: u.jobindex, 
        hunger: u.hunger, maxHunger: u.maxhunger || 100, isAdmin: u.isadmin, 
        inventory: u.inventory || {}, upgrades: u.upgrades || { fishingRod: 1, stomach: 1 }
      },
      stocks: STOCKS, jobs: JOBS, vending: VENDING_ITEMS
    });
  });

  socket.on('player:move', (pos) => {
    if (!currentUser || !onlinePlayers[socket.id]) return;
    onlinePlayers[socket.id].x = pos.x;
    onlinePlayers[socket.id].y = pos.y;
    socket.broadcast.emit('players:update', onlinePlayers);
  });

  socket.on('action:promote', async () => {
    if (!currentUser) return;
    const u = await getUserByUsername(currentUser);
    const nextJob = JOBS[u.jobindex + 1];
    if (!nextJob) return socket.emit('notify', { success: false, msg: '이미 최고 직급입니다!' });
    if (u.money < nextJob.reqMoney) return socket.emit('notify', { success: false, msg: `승진 자산 부족 (필요: ₩${nextJob.reqMoney.toLocaleString()})` });

    u.jobindex++;
    await saveUser(u);
    await syncUser();
    socket.emit('notify', { success: true, msg: `🎉 승진 축하합니다! [${nextJob.name}] 진급!` });
  });

  // 미끼 반영 낚시 시스템
  socket.on('fish:catch', async () => {
    if (!currentUser) return;
    const u = await getUserByUsername(currentUser);
    if (u.hunger < 5) return socket.emit('notify', { success: false, msg: '배가 고파서 낚시를 할 수 없습니다!' });

    u.hunger -= 5;
    const rodLevel = (u.upgrades && u.upgrades.fishingRod) || 1;
    
    // 미끼 소모 체크 (인벤토리에 미끼가 있으면 소모하여 확률 대폭 버프)
    let baitBonus = 1;
    if (u.inventory) {
      if (u.inventory['bait_gold'] && u.inventory['bait_gold'] > 0) {
        u.inventory['bait_gold']--;
        baitBonus = 3.0;
      } else if (u.inventory['bait_normal'] && u.inventory['bait_normal'] > 0) {
        u.inventory['bait_normal']--;
        baitBonus = 1.8;
      }
    }

    let rand = Math.random() * 100;
    let acc = 0, caught = FISH_ITEMS[0];
    for(let f of FISH_ITEMS) {
      acc += (f.chance * (rodLevel * 0.2) * baitBonus);
      if(rand <= acc) { caught = f; break; }
    }

    if (!u.inventory) u.inventory = {};
    u.inventory[caught.id] = (u.inventory[caught.id] || 0) + 1;
    await saveUser(u);
    await syncUser();
    socket.emit('notify', { success: true, msg: `🎣 [낚시 성공] ${caught.name} 획득!` });
  });

  socket.on('upgrade:buy', async (type) => {
    if (!currentUser) return;
    const u = await getUserByUsername(currentUser);
    if (!u.upgrades) u.upgrades = { fishingRod: 1, stomach: 1 };

    if (type === 'fishingRod') {
      const curLv = u.upgrades.fishingRod;
      const cost = curLv * 150000;
      if (curLv >= 10) return socket.emit('notify', { success: false, msg: '낚싯대가 이미 최고 레벨입니다.' });
      if (u.money < cost) return socket.emit('notify', { success: false, msg: `비용 부족 (필요: ₩${cost.toLocaleString()})` });
      u.money -= cost;
      u.upgrades.fishingRod++;
      socket.emit('notify', { success: true, msg: `✨ 낚싯대 업그레이드 완료! (Lv.${u.upgrades.fishingRod})` });
    } 
    else if (type === 'stomach') {
      const curLv = u.upgrades.stomach;
      const cost = Math.round(200000 * Math.pow(1.3, curLv - 1));
      if (curLv >= 19) return socket.emit('notify', { success: false, msg: '위장이 이미 최고 레벨입니다!' });
      if (u.money < cost) return socket.emit('notify', { success: false, msg: `비용 부족 (필요: ₩${cost.toLocaleString()})` });
      u.money -= cost;
      u.upgrades.stomach++;
      u.maxhunger = Math.min(1000, 100 + (u.upgrades.stomach - 1) * 50);
      socket.emit('notify', { success: true, msg: `🍖 위장 업그레이드! (최대 포만감: ${u.maxhunger})` });
    }
    await saveUser(u); await syncUser();
  });

  socket.on('vending:buy', async (itemId) => {
    if (!currentUser) return;
    const u = await getUserByUsername(currentUser);
    const item = VENDING_ITEMS.find(v => v.id === itemId);
    if (!item || u.money < item.cost) return socket.emit('notify', { success: false, msg: '잔액 부족' });
    u.money -= item.cost;
    if (!u.inventory) u.inventory = {};
    u.inventory[itemId] = (u.inventory[itemId] || 0) + 1;
    await saveUser(u); await syncUser();
    socket.emit('notify', { success: true, msg: `${item.name} 구매 완료` });
  });

  socket.on('inventory:use', async (itemId) => {
    if (!currentUser) return;
    const u = await getUserByUsername(currentUser);
    const item = VENDING_ITEMS.find(v => v.id === itemId);
    const fish = FISH_ITEMS.find(f => f.id === itemId);
    const maxH = u.maxhunger || 100;

    if (!u.inventory || !u.inventory[itemId] || u.inventory[itemId] <= 0) return;
    u.inventory[itemId]--;
    if(u.inventory[itemId] === 0) delete u.inventory[itemId];

    if (item && item.type !== 'bait') {
      u.hunger = Math.min(maxH, u.hunger + item.restoreHunger);
      socket.emit('notify', { success: true, msg: `${item.name} 섭취 완료` });
    } else if (fish) {
      u.money += fish.value;
      socket.emit('notify', { success: true, msg: `${fish.name} 판매 완료 (+₩${fish.value.toLocaleString()})` });
    }
    await saveUser(u); await syncUser();
  });

  socket.on('disconnect', () => {
    delete onlinePlayers[socket.id];
    currentUser = null;
    socket.broadcast.emit('players:update', onlinePlayers);
  });
});

server.listen(PORT, () => console.log(`[SERVER] 카메라 팔로우 & E키 인터랙션 서버 실행됨 (포트: ${PORT})`));
