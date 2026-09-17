const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// [!] 여기에 본인의 Supabase URL과 키를 입력하세요
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

// --- Supabase DB 헬퍼 함수 ---
async function getUserByUsername(username) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();
  if (error || !data) return null;
  return data;
}

async function saveUser(userObj) {
  const { error } = await supabase
    .from('users')
    .upsert([userObj], { onConflict: 'username' });
  if (error) console.error('[Supabase 저장 오류]', error.message);
}

// 게임 설정 데이터
const JOBS = [
  { id: 'job_0', name: '무직/취준생', salary: 0, reqMoney: 0, workEnergyCost: 0 },
  { id: 'job_1', name: '편의점 알바', salary: 15000, reqMoney: 0, workEnergyCost: 5 },
  { id: 'job_2', name: '중소기업 사원', salary: 45000, reqMoney: 150000, workEnergyCost: 10 },
  { id: 'job_3', name: '대기업 팀장', salary: 120000, reqMoney: 800000, workEnergyCost: 15 },
  { id: 'job_4', name: '스타트업 CEO', salary: 350000, reqMoney: 5000000, workEnergyCost: 20 },
  { id: 'job_5', name: '투자사 회장', salary: 1000000, reqMoney: 30000000, workEnergyCost: 25 },
];

const VENDING_ITEMS = [
  { id: 'water', name: '생수', cost: 1000, restoreHunger: 15 },
  { id: 'snack', name: '초코바', cost: 2500, restoreHunger: 30 },
  { id: 'gimbap', name: '삼각김밥', cost: 4000, restoreHunger: 50 },
  { id: 'bento', name: '혜자 도시락', cost: 9000, restoreHunger: 85 },
  { id: 'steak', name: '특상 한우 스테이크', cost: 45000, restoreHunger: 100 },
];

const QUEST_LIST = [
  { id: 'q_grandma', title: '골목길 할머니 짐 들어드리기', desc: '무거운 짐을 옮겨드렸습니다.', rewardMoney: 20000, cooldownSec: 45, hungerCost: 10 },
  { id: 'q_trash', title: '공원 쓰레기 수거하기', desc: '길거리에 버려진 쓰레기를 치웠습니다.', rewardMoney: 35000, cooldownSec: 60, hungerCost: 15 },
  { id: 'q_cat', title: '동네 길고양이 밥 챙겨주기', desc: '배고파하던 고양이에게 밥을 주었습니다.', rewardMoney: 15000, cooldownSec: 30, hungerCost: 5 },
  { id: 'q_flyer', title: '상가 전단지 돌리기', desc: '주변 상가에 전단지를 모두 배포했습니다.', rewardMoney: 50000, cooldownSec: 90, hungerCost: 20 },
  { id: 'q_deliver', title: '심야 긴급 서류 퀵배달', desc: '대표님 서류를 제시간에 전달했습니다.', rewardMoney: 120000, cooldownSec: 150, hungerCost: 30 }
];

let STOCKS = [
  { symbol: 'NVX', name: '엔빅스 테크놀로지', price: 150000, min: 20000, max: 800000 },
  { symbol: 'BIO', name: '그린 바이오팜', price: 42000, min: 5000, max: 250000 },
  { symbol: 'SPX', name: '스페이스 코스모', price: 310000, min: 50000, max: 1500000 },
  { symbol: 'COIN', name: '도지 로켓 코인', price: 1200, min: 50, max: 25000 },
];

setInterval(() => {
  STOCKS.forEach(stock => {
    const rate = (Math.random() * 0.24 - 0.11);
    stock.price = Math.max(stock.min, Math.min(stock.max, Math.round(stock.price * (1 + rate))));
  });
  io.emit('stocks:update', STOCKS);
}, 5000);

// 배고픔 주기적 감소 (Supabase 전체 유저 대상)
setInterval(async () => {
  const { data: users, error } = await supabase.from('users').select('*');
  if (error || !users) return;

  for (let user of users) {
    if (user.hunger > 0) {
      user.hunger = Math.max(0, user.hunger - 2);
      await saveUser(user);
    }
  }
  io.emit('hunger:tick');
}, 12000);

app.use(express.static(path.join(__dirname, 'public')));

const activeCasino = {}; 
function getDeck() {
  const suits = ['♠', '♥', '♦', '♣'], values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  let deck = [];
  for(let s of suits) for(let v of values) deck.push({ suit: s, val: v });
  return deck.sort(() => Math.random() - 0.5);
}
function calcBJ(hand) {
  let sum = 0, aces = 0;
  hand.forEach(c => {
    if(c.val === 'A') { aces++; sum += 11; }
    else if(['J','Q','K'].includes(c.val)) sum += 10;
    else sum += parseInt(c.val);
  });
  while(sum > 21 && aces > 0) { sum -= 10; aces--; }
  return sum;
}

io.on('connection', (socket) => {
  let currentUser = null;

  async function syncUser() {
    if (!currentUser) return;
    const user = await getUserByUsername(currentUser);
    if (user) socket.emit('player:sync', user);
  }

  socket.on('auth:register', async ({ username, password }) => {
    if (!username || username.trim().length < 2) return socket.emit('notify', { success: false, msg: '아이디는 2자 이상 입력해주세요.' });
    
    const existing = await getUserByUsername(username);
    if (existing) return socket.emit('notify', { success: false, msg: '이미 존재하는 아이디입니다.' });

    const newUser = {
      username,
      passwordHash: hashPassword(password),
      money: 100000,
      jobIndex: 0,
      hunger: 100,
      isAdmin: false,
      stocks: {},
      quests: {}
    };

    await saveUser(newUser);
    socket.emit('notify', { success: true, msg: '회원가입 완료! 로그인하세요.' });
  });

  socket.on('auth:login', async ({ username, password }) => {
    const user = await getUserByUsername(username);
    if (!user || user.passwordHash !== hashPassword(password)) {
      return socket.emit('notify', { success: false, msg: '아이디/비밀번호 오류' });
    }
    currentUser = username;
    socket.emit('auth:success', { username, userData: user, stocks: STOCKS, jobs: JOBS, vending: VENDING_ITEMS, questList: QUEST_LIST });
  });

  socket.on('action:work', async () => {
    if (!currentUser) return;
    const user = await getUserByUsername(currentUser);
    const job = JOBS[user.jobIndex];
    if (user.hunger < job.workEnergyCost) return socket.emit('notify', { success: false, msg: '배가 고파서 일할 수 없습니다!' });

    user.hunger = Math.max(0, user.hunger - job.workEnergyCost);
    user.money += job.salary;
    await saveUser(user);
    await syncUser();
    socket.emit('notify', { success: true, msg: `업무 완료! 급여 ₩${job.salary.toLocaleString()} 지급됨.` });
  });

  socket.on('action:promote', async () => {
    if (!currentUser) return;
    const user = await getUserByUsername(currentUser);
    const nextJob = JOBS[user.jobIndex + 1];
    if (!nextJob) return socket.emit('notify', { success: false, msg: '이미 최고 직급입니다.' });
    if (user.money < nextJob.reqMoney) return socket.emit('notify', { success: false, msg: '승진 조건(자산) 부족' });

    user.jobIndex++;
    await saveUser(user);
    await syncUser();
    socket.emit('notify', { success: true, msg: `[${nextJob.name}] (으)로 승진했습니다!` });
  });

  socket.on('vending:buy', async (itemId) => {
    if (!currentUser) return;
    const user = await getUserByUsername(currentUser);
    const item = VENDING_ITEMS.find(v => v.id === itemId);
    if (!item || user.money < item.cost) return socket.emit('notify', { success: false, msg: '잔액 부족' });
    if (user.hunger >= 100) return socket.emit('notify', { success: false, msg: '포만감이 가득 찼습니다.' });

    user.money -= item.cost;
    user.hunger = Math.min(100, user.hunger + item.restoreHunger);
    await saveUser(user);
    await syncUser();
    socket.emit('notify', { success: true, msg: `${item.name} 섭취 완료!` });
  });

  socket.on('stock:buy', async ({ symbol, amount }) => {
    if (!currentUser || amount <= 0) return;
    const user = await getUserByUsername(currentUser);
    const stock = STOCKS.find(s => s.symbol === symbol), cost = stock.price * amount;
    if (user.money < cost) return socket.emit('notify', { success: false, msg: '잔액 부족' });

    user.money -= cost;
    if (!user.stocks) user.stocks = {};
    user.stocks[symbol] = (user.stocks[symbol] || 0) + amount;
    await saveUser(user);
    await syncUser();
    socket.emit('notify', { success: true, msg: `${stock.name} ${amount}주 매수 완료` });
  });

  socket.on('stock:sell', async ({ symbol, amount }) => {
    if (!currentUser || amount <= 0) return;
    const user = await getUserByUsername(currentUser);
    const stock = STOCKS.find(s => s.symbol === symbol), owned = (user.stocks && user.stocks[symbol]) || 0;
    if (owned < amount) return socket.emit('notify', { success: false, msg: '보유 주식 부족' });

    user.stocks[symbol] -= amount;
    if (user.stocks[symbol] === 0) delete user.stocks[symbol];
    user.money += stock.price * amount;
    await saveUser(user);
    await syncUser();
    socket.emit('notify', { success: true, msg: `${stock.name} ${amount}주 매도 완료` });
  });

  socket.on('quest:start', async (questId) => {
    if (!currentUser) return;
    const user = await getUserByUsername(currentUser);
    const quest = QUEST_LIST.find(q => q.id === questId), now = Date.now();
    if (!user.quests) user.quests = {};
    const lastDone = user.quests[questId] || 0;
    if (now - lastDone < quest.cooldownSec * 1000) return socket.emit('notify', { success: false, msg: '쿨타임 대기 중' });
    if (user.hunger < quest.hungerCost) return socket.emit('notify', { success: false, msg: '포만감 부족' });

    user.hunger -= quest.hungerCost;
    user.money += quest.rewardMoney;
    user.quests[questId] = now;
    await saveUser(user);
    await syncUser();
    socket.emit('notify', { success: true, msg: `[퀘스트 완료] +₩${quest.rewardMoney.toLocaleString()}` });
  });

  // 카지노 종합 로직
  socket.on('casino:action', async ({ game, action, payload }) => {
    if (!currentUser) return;
    const user = await getUserByUsername(currentUser);
    const betAmount = payload?.bet ? parseInt(payload.bet, 10) : 0;

    if (game === 'dice' && action === 'bet') {
      if (user.money < betAmount || betAmount < 100) return socket.emit('notify', { success: false, msg: '잔액 부족' });
      const target = parseFloat(payload.target);
      user.money -= betAmount;
      const roll = (Math.random() * 100).toFixed(2), isWin = parseFloat(roll) < target;
      let reward = isWin ? Math.floor(betAmount * (99 / target)) : 0;
      user.money += reward;
      await saveUser(user); await syncUser();
      socket.emit('casino:result', { game: 'dice', win: isWin, roll, msg: `다이스 ${roll}! ${isWin ? `+₩${reward.toLocaleString()}` : '패배'}` });
    }
    else if (game === 'baccarat' && action === 'bet') {
      if (user.money < betAmount || betAmount < 100) return;
      user.money -= betAmount;
      const pScore = Math.floor(Math.random() * 10), bScore = Math.floor(Math.random() * 10);
      let result = pScore > bScore ? 'player' : (bScore > pScore ? 'banker' : 'tie');
      let reward = payload.betOn === result ? (payload.betOn === 'tie' ? betAmount * 9 : Math.floor(betAmount * 1.95)) : 0;
      user.money += reward;
      await saveUser(user); await syncUser();
      socket.emit('casino:result', { game: 'baccarat', win: reward > 0, msg: `바카라 P:${pScore} B:${bScore}. ${reward > 0 ? `승리(+₩${reward.toLocaleString()})` : '패배'}` });
    }
    else if (game === 'roulette' && action === 'bet') {
      if (user.money < betAmount || betAmount < 100) return;
      user.money -= betAmount;
      const resultNum = Math.floor(Math.random() * 37), resultColor = resultNum === 0 ? 'green' : (resultNum % 2 === 0 ? 'black' : 'red');
      let reward = payload.betType === resultColor ? (resultColor === 'green' ? betAmount * 14 : betAmount * 2) : 0;
      user.money += reward;
      await saveUser(user); await syncUser();
      socket.emit('casino:result', { game: 'roulette', win: reward > 0, msg: `룰렛 ${resultColor.toUpperCase()} ${resultNum}. ${reward > 0 ? '적중!' : '실패'}` });
    }
    else if (game === 'mines') {
      if (action === 'start') {
        if (activeCasino[currentUser] || user.money < betAmount) return;
        user.money -= betAmount;
        let grid = Array(25).fill('safe');
        for(let i=0; i < (parseInt(payload.minesCount)||3); i++) { let r; do { r = Math.floor(Math.random()*25); } while(grid[r] === 'mine'); grid[r] = 'mine'; }
        activeCasino[currentUser] = { type: 'mines', bet: betAmount, minesCount: parseInt(payload.minesCount)||3, grid, safeClicks: 0, active: true };
        await saveUser(user); await syncUser();
        socket.emit('casino:state', { game: 'mines', state: 'playing' });
      }
      else if (action === 'click' && activeCasino[currentUser]?.active) {
        const session = activeCasino[currentUser], index = parseInt(payload.index);
        if (session.grid[index] === 'mine') {
          session.active = false; delete activeCasino[currentUser];
          socket.emit('casino:result', { game: 'mines', win: false, grid: session.grid, msg: '지뢰 폭발! 배팅금 상실.' });
        } else {
          session.safeClicks++;
          socket.emit('casino:state', { game: 'mines', state: 'playing', clicked: index, multi: (1 + session.safeClicks * session.minesCount * 0.05).toFixed(2) });
        }
      }
      else if (action === 'cashout' && activeCasino[currentUser]?.safeClicks > 0) {
        const session = activeCasino[currentUser], reward = Math.floor(session.bet * (1 + session.safeClicks * session.minesCount * 0.05));
        user.money += reward; delete activeCasino[currentUser];
        await saveUser(user); await syncUser();
        socket.emit('casino:result', { game: 'mines', win: true, grid: session.grid, msg: `캐시아웃! ₩${reward.toLocaleString()} 획득.` });
      }
    }
    else if (game === 'blackjack') {
      if (action === 'start') {
        if (activeCasino[currentUser] || user.money < betAmount) return;
        user.money -= betAmount;
        let deck = getDeck(), pHand = [deck.pop(), deck.pop()], dHand = [deck.pop(), deck.pop()];
        activeCasino[currentUser] = { type: 'blackjack', bet: betAmount, deck, pHand, dHand };
        await saveUser(user); await syncUser();
        if (calcBJ(pHand) === 21) {
          user.money += Math.floor(betAmount * 2.5); delete activeCasino[currentUser];
          await saveUser(user); await syncUser();
          return socket.emit('casino:result', { game: 'blackjack', win: true, pHand, dHand, msg: '블랙잭 당첨!' });
        }
        socket.emit('casino:state', { game: 'blackjack', pHand, dHand: [dHand[0], {suit:'?', val:'?'}] });
      }
      else if (action === 'hit' && activeCasino[currentUser]) {
        const session = activeCasino[currentUser]; session.pHand.push(session.deck.pop());
        if (calcBJ(session.pHand) > 21) {
          delete activeCasino[currentUser];
          socket.emit('casino:result', { game: 'blackjack', win: false, pHand: session.pHand, dHand: session.dHand, msg: 'Bust! 패배.' });
        } else socket.emit('casino:state', { game: 'blackjack', pHand: session.pHand, dHand: [session.dHand[0], {suit:'?', val:'?'}] });
      }
      else if (action === 'stand' && activeCasino[currentUser]) {
        const session = activeCasino[currentUser];
        while (calcBJ(session.dHand) < 17) session.dHand.push(session.deck.pop());
        const pScore = calcBJ(session.pHand), dScore = calcBJ(session.dHand);
        let reward = 0, msg = '';
        if (dScore > 21 || pScore > dScore) { reward = session.bet * 2; msg = '승리!'; }
        else if (pScore === dScore) { reward = session.bet; msg = '무승부'; }
        else msg = '패배';
        user.money += reward; delete activeCasino[currentUser];
        await saveUser(user); await syncUser();
        socket.emit('casino:result', { game: 'blackjack', win: reward > session.bet, pHand: session.pHand, dHand: session.dHand, msg });
      }
    }
  });

  socket.on('admin:action', async ({ targetUser, action, value }) => {
    if (!currentUser) return;
    const adminUser = await getUserByUsername(currentUser);
    if (!adminUser || !adminUser.isAdmin) return;
    const target = await getUserByUsername(targetUser);
    if (!target) return;

    if (action === 'give_money') target.money += (parseInt(value)||0);
    if (action === 'full_hunger') target.hunger = 100;
    await saveUser(target);
    io.emit('player:sync:all');
  });

  socket.on('disconnect', () => { currentUser = null; });
});

readline.createInterface({ input: process.stdin, output: process.stdout }).on('line', async (line) => {
  if (line.trim().startsWith('/admin add ')) {
    const targetId = line.trim().replace('/admin add ', '').trim();
    const target = await getUserByUsername(targetId);
    if (target) {
      target.isAdmin = true;
      await saveUser(target);
      io.emit('player:sync:all');
      console.log(`[ADMIN] ${targetId} 관리자 권한 부여 완료.`);
    } else {
      console.log(`[ADMIN ERROR] ${targetId} 유저를 찾을 수 없습니다.`);
    }
  }
});

server.listen(PORT, () => console.log(`[SERVER] Supabase 연동 타이쿤 서버 실행됨 (포트: ${PORT})`));
