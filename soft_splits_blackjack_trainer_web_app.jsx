import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

/* ==================== Card & Deck Utilities ==================== */
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const createDeck = () => {
  const deck = [];
  for (let suit of suits) for (let rank of ranks) deck.push({ rank, suit });
  return deck;
};

const getValue = (card) => {
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  if (card.rank === 'A') return 11; // soft handled in handValue
  return parseInt(card.rank, 10);
};

const handValue = (hand) => {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    total += getValue(c);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10; // downgrade an Ace 11->1
    aces--;
  }
  return total;
};

const isPair = (hand) => hand.length === 2 && hand[0].rank === hand[1].rank;
const isSoft = (hand) => hand.some((c) => c.rank === 'A') && handValue(hand) <= 21;
const isTenValue = (card) => ['10', 'J', 'Q', 'K'].includes(card.rank);
const isBlackjack = (hand) =>
  hand.length === 2 &&
  hand.some((c) => c.rank === 'A') &&
  hand.some((c) => isTenValue(c)) &&
  handValue(hand) === 21;

/* ==================== Basic Strategy (soft & pair-only, S17, DAS allowed) ==================== */
// Returns: 'Hit' | 'Stand' | 'Split' | 'Double'
const basicStrategy = (hand, dealerCardVal) => {
  // Pair rules
  if (isPair(hand)) {
    const r = hand[0].rank;

    // Never split any ten-value pair (10/J/Q/K) — always Stand
    if (isTenValue(hand[0]) && isTenValue(hand[1])) return 'Stand';

    if (r === 'A' || r === '8') return 'Split';
    if (r === '9') return dealerCardVal >= 2 && dealerCardVal <= 9 && dealerCardVal !== 7 ? 'Split' : 'Stand';
    if (r === '7') return dealerCardVal <= 7 ? 'Split' : 'Hit';
    if (r === '6') return dealerCardVal <= 6 ? 'Split' : 'Hit';
    if (r === '4') return dealerCardVal === 5 || dealerCardVal === 6 ? 'Split' : 'Hit';
    if (r === '3' || r === '2') return dealerCardVal <= 7 ? 'Split' : 'Hit';
    return 'Hit';
  }

  // Soft totals
  if (isSoft(hand)) {
    const v = handValue(hand); // 13..21
    if (v === 13 || v === 14) return dealerCardVal >= 5 && dealerCardVal <= 6 ? 'Double' : 'Hit';
    if (v === 15 || v === 16) return dealerCardVal >= 4 && dealerCardVal <= 6 ? 'Double' : 'Hit';
    if (v === 17) return dealerCardVal >= 3 && dealerCardVal <= 6 ? 'Double' : 'Hit';
    if (v === 18) {
      if (dealerCardVal >= 3 && dealerCardVal <= 6) return 'Double';
      if (dealerCardVal >= 9 || dealerCardVal === 11 /* Ace */) return 'Hit';
      return 'Stand'; // vs 2,7,8
    }
    if (v >= 19) return 'Stand';
    return 'Hit';
  }

  // Fallback (hard totals not in trainer scope)
  return 'Hit';
};

/* ==================== Simple Sound FX (Web Audio) ==================== */
function createAudioCtx(ctxRef) {
  if (!ctxRef.current) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) ctxRef.current = new Ctx();
  }
  return ctxRef.current;
}

function playBeep(ctxRef, { freq = 440, duration = 0.08, type = 'sine', volume = 0.07, glideTo = null, glideTime = 0.06 }) {
  const ctx = createAudioCtx(ctxRef);
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + glideTime);
  osc.start(now);
  osc.stop(now + duration);
}

function playClick(ctxRef) {
  const ctx = createAudioCtx(ctxRef);
  if (!ctx) return;
  const bufferSize = 4096;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);
  node.onaudioprocess = (e) => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) out[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.15;
  };
  node.connect(ctx.destination);
  setTimeout(() => node.disconnect(), 60);
}

const SFX = {
  deal: (ctx) => playClick(ctx),
  hit: (ctx) => playClick(ctx),
  stand: (ctx) => playBeep(ctx, { freq: 320, duration: 0.09, type: 'triangle' }),
  split: (ctx) => {
    playBeep(ctx, { freq: 660, duration: 0.06 });
    setTimeout(() => playBeep(ctx, { freq: 660, duration: 0.06 }), 70);
  },
  double: (ctx) => playBeep(ctx, { freq: 220, duration: 0.12, type: 'square', glideTo: 330 }),
  flip: (ctx) => playBeep(ctx, { freq: 520, duration: 0.08, type: 'sine' }),
  bet: (ctx) => playBeep(ctx, { freq: 420, duration: 0.08, type: 'sine' }),
  win: (ctx) => { playBeep(ctx, { freq: 520, duration: 0.1 }); setTimeout(() => playBeep(ctx, { freq: 660, duration: 0.12 }), 90); },
  lose: (ctx) => playBeep(ctx, { freq: 180, duration: 0.18, type: 'sawtooth', volume: 0.05 }),
  push: (ctx) => playBeep(ctx, { freq: 400, duration: 0.08, type: 'triangle' }),
};

/* ==================== Confetti (Blackjack celebration) ==================== */
const Confetti = () => (
  <motion.div
    className="absolute inset-0 pointer-events-none flex justify-center items-start"
    initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} transition={{ duration: 2 }}
  >
    <div className="text-6xl">🎉</div>
  </motion.div>
);

/* ==================== UI Bits ==================== */
const PlayingCard = ({ card }) => {
  const isRed = card.suit === '♥' || card.suit === '♦';
  return (
    <motion.div
      className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center bg-white shadow-md text-lg font-bold ${isRed ? 'text-red-600' : 'text-black'}`}
      whileHover={{ scale: 1.05 }}
    >
      {card.rank}{card.suit}
    </motion.div>
  );
};

const CardBack = () => (<motion.div className="w-12 h-16 rounded-lg border-2 bg-gradient-to-br from-sky-600 to-indigo-700 shadow-md" />);

const FlipCard = ({ showFront, front, back }) => (
  <div className="relative w-12 h-16 [perspective:700px]">
    <motion.div
      className="absolute inset-0 [transform-style:preserve-3d]"
      initial={false}
      animate={{ rotateY: showFront ? 0 : 180 }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
    >
      <div className="absolute inset-0 [backface-visibility:hidden]">{front}</div>
      <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">{back}</div>
    </motion.div>
  </div>
);

const Chip = ({ value, onClick }) => {
  const colors = { 25: 'bg-green-500', 50: 'bg-red-500', 100: 'bg-blue-500', 500: 'bg-black text-white' };
  return (
    <motion.div
      onClick={() => onClick(value)}
      className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer border-2 border-white shadow-md ${colors[value] || 'bg-gray-400'}`}
      title={`Bet $${value}`}
      whileTap={{ scale: 0.9 }}
    >
      ${value}
    </motion.div>
  );
};

/* ==================== Main Component ==================== */
const BlackjackTrainer = () => {
  const [deck, setDeck] = useState(createDeck());
  const [playerHands, setPlayerHands] = useState([]);
  const [handBets, setHandBets] = useState([]);            // per-hand wager (splits & doubles)
  const [lockedHands, setLockedHands] = useState([]);      // split Aces -> one card only (locked)
  const [activeHand, setActiveHand] = useState(0);
  const [dealerHand, setDealerHand] = useState([]);
  const [bankroll, setBankroll] = useState(1000);
  const [bet, setBet] = useState(50);
  const [inRound, setInRound] = useState(false);
  const [autoDeal, setAutoDeal] = useState(false);
  const [revealHole, setRevealHole] = useState(false);
  const [bankrollDelta, setBankrollDelta] = useState(0);
  const [handOutcomes, setHandOutcomes] = useState([]);    // 'Win' | 'Lose' | 'Push' | 'Blackjack'
  const [animBetPing, setAnimBetPing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [dealerPending, setDealerPending] = useState(false);
  const DEALER_PAUSE_MS = 1000;

  // coaching/notification toast
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachTip, setCoachTip] = useState('');
  const [coachGood, setCoachGood] = useState(null); // true | false | null
  const coachTimerRef = useRef(null);

  const audioCtxRef = useRef(null);

  const notifyCoach = (msg, ok) => {
    setCoachTip(msg); setCoachGood(ok); setCoachOpen(true);
    if (coachTimerRef.current) clearTimeout(coachTimerRef.current);
    coachTimerRef.current = setTimeout(() => setCoachOpen(false), 1600);
  };

  const advise = (actionLabel) => {
    try {
      const hand = playerHands[activeHand] || [];
      const upVal = dealerHand[0] ? getValue(dealerHand[0]) : 0;
      const rec = basicStrategy(hand, upVal);
      const ok = rec === actionLabel;
      notifyCoach(`Basic Strategy: ${rec}. You chose: ${actionLabel}${ok ? ' ✅' : ' ✖️'}`, ok);
      if (ok) SFX.win(audioCtxRef); else SFX.lose(audioCtxRef);
    } catch {}
  };

  // Draw a card from a working copy deck and update state deck
  const dealCard = (d) => {
    const idx = Math.floor(Math.random() * d.length);
    const card = d[idx];
    const newDeck = [...d];
    newDeck.splice(idx, 1);
    setDeck(newDeck);
    return card;
  };

  // Start a round ensuring initial hand is soft, pair, or blackjack
  const startRound = () => {
    let d = createDeck();
    let player, dealer;
    // Re-deal until starting hand is soft/pair/blackjack (trainer scope)
    do {
      d = createDeck();
      const a = dealCard(d), b = dealCard(d), up = dealCard(d), hole = dealCard(d);
      player = [a, b]; dealer = [up, hole];
    } while (!isSoft(player) && !isPair(player) && !isBlackjack(player));

    setDeck(d);
    setPlayerHands([[...player]]);
    setHandBets([bet]);
    setLockedHands([false]);
    setActiveHand(0);
    setDealerHand(dealer);
    setRevealHole(false);
    setBankrollDelta(0);
    setHandOutcomes([]);
    setShowConfetti(false);

    // Chip tween & sound
    setAnimBetPing(true); setTimeout(() => setAnimBetPing(false), 500); SFX.deal(audioCtxRef);

    // Natural blackjack: auto-settle 3:2 (1.5x), skip dealer play
    if (isBlackjack(player)) {
      const bjPay = bet * 1.5;
      setInRound(false);
      setHandOutcomes(['Blackjack']);
      setBankroll((bk) => bk + bjPay);
      setBankrollDelta(bjPay);
      setShowConfetti(true); SFX.win(audioCtxRef);
      setTimeout(() => setShowConfetti(false), 2000);
      if (autoDeal) setTimeout(() => startRound(), 2500);
      return;
    }

    setInRound(true);
  };

  const advanceToNextPlayableHand = (nextIndex) => {
    let idx = nextIndex;
    while (idx < playerHands.length && lockedHands[idx]) idx++;
    if (idx < playerHands.length) setActiveHand(idx);
    else {
      // little pause before dealer turn
      setDealerPending(true);
      setTimeout(() => {
        setDealerPending(false);
        dealerPlay();
      }, DEALER_PAUSE_MS);
    }
  };

  const hit = () => {
    if (lockedHands[activeHand]) return; // cannot act on split Aces
    advise('Hit');
    const newHands = [...playerHands];
    newHands[activeHand].push(dealCard(deck));
    setPlayerHands(newHands);
    SFX.hit(audioCtxRef);
    if (handValue(newHands[activeHand]) > 21) {
      SFX.lose(audioCtxRef);
      nextHand();
    }
  };

  const stand = () => { advise('Stand'); SFX.stand(audioCtxRef); nextHand(); };

  const split = () => {
    if (lockedHands[activeHand]) return;
    advise('Split');

    const newHands = [...playerHands];
    const hand = newHands[activeHand];
    if (!isPair(hand)) return;

    const isAces = hand[0].rank === 'A' && hand[1].rank === 'A';

    // prevent splitting ten-value pairs by hiding button (UI), but if called, let strategy deem it 'Stand'
    if (isTenValue(hand[0]) && isTenValue(hand[1])) return; // safety: do nothing

    const c1 = hand[0], c2 = hand[1];
    const h1 = [c1, dealCard(deck)];
    const h2 = [c2, dealCard(deck)];
    newHands.splice(activeHand, 1, h1, h2);
    setPlayerHands(newHands);

    // Duplicate bet (DAS allowed overall)
    const newBets = [...handBets];
    const thisBet = newBets[activeHand] ?? bet;
    newBets.splice(activeHand, 1, thisBet, thisBet);
    setHandBets(newBets);

    // Lock hands if Aces: one card only per Ace
    const newLocks = [...lockedHands];
    if (isAces) newLocks.splice(activeHand, 1, true, true);
    else newLocks.splice(activeHand, 1, false, false);
    setLockedHands(newLocks);

    SFX.split(audioCtxRef);

    // If both are locked (A,A), auto-advance off them
    if (isAces) advanceToNextPlayableHand(activeHand);
  };

  const doubleDown = () => {
    if (!inRound) return;
    if (lockedHands[activeHand]) return; // cannot double a split Ace
    advise('Double');

    const newHands = [...playerHands];
    if (newHands[activeHand].length !== 2) return; // two-card only
    newHands[activeHand] = [...newHands[activeHand], dealCard(deck)];
    setPlayerHands(newHands);

    const newBets = [...handBets];
    newBets[activeHand] = (newBets[activeHand] ?? bet) * 2;
    setHandBets(newBets);

    SFX.double(audioCtxRef);
    nextHand();
  };

  const nextHand = () => {
    const nextIdx = activeHand + 1;
    advanceToNextPlayableHand(nextIdx);
  };

  const dealerPlay = () => {
    setRevealHole(true); SFX.flip(audioCtxRef);
    let dHand = [...dealerHand];
    while (handValue(dHand) < 17) { dHand.push(dealCard(deck)); SFX.deal(audioCtxRef); }
    setDealerHand(dHand);
    resolveHands(dHand);
  };

  const resolveHands = (dHand) => {
    const dVal = handValue(dHand);
    const results = [];
    let bankrollChange = 0;

    playerHands.forEach((hand, i) => {
      const pVal = handValue(hand);
      let outcome = 'Push';
      if (pVal > 21) outcome = 'Lose';
      else if (dVal > 21 || pVal > dVal) outcome = 'Win';
      else if (pVal < dVal) outcome = 'Lose';
      results.push(outcome);

      const wager = handBets[i] ?? bet;
      if (outcome === 'Win') bankrollChange += wager;
      if (outcome === 'Lose') bankrollChange -= wager;
    });

    setHandOutcomes(results);
    setBankroll((bk) => bk + bankrollChange);
    setBankrollDelta(bankrollChange);

    if (results.every((r) => r === 'Push')) SFX.push(audioCtxRef);
    else if (results.some((r) => r === 'Lose') && !results.some((r) => r === 'Win')) SFX.lose(audioCtxRef);
    else if (results.some((r) => r === 'Win') && !results.some((r) => r === 'Lose')) SFX.win(audioCtxRef);
    else SFX.push(audioCtxRef);

    setInRound(false);
    if (autoDeal) setTimeout(() => startRound(), 2500);
  };

  const canDouble =
    inRound && playerHands[activeHand] && playerHands[activeHand].length === 2 && !lockedHands[activeHand];

  const handleChip = (value) => { setBet(value); SFX.bet(audioCtxRef); };

  /* ==================== Inline Dev Tests (console-only) ==================== */
  try {
    // Blackjack detection
    const testBJ = [{ rank: 'A', suit: '♠' }, { rank: 'K', suit: '♥' }];
    console.assert(isBlackjack(testBJ) === true, 'Test: isBlackjack true for A+K');

    // Soft total & ace downgrade
    const testSoft = [{ rank: 'A', suit: '♠' }, { rank: '6', suit: '♦' }];
    console.assert(isSoft(testSoft) === true && handValue(testSoft) === 17, 'Test: A+6 soft 17');
    const testDowngrade = [{ rank: 'A', suit: '♠' }, { rank: '9', suit: '♦' }, { rank: '9', suit: '♣' }];
    console.assert(handValue(testDowngrade) === 19, 'Test: A+9+9 => 29 -> 19');

    // Pair detection
    const testPair = [{ rank: '8', suit: '♠' }, { rank: '8', suit: '♦' }];
    console.assert(isPair(testPair) === true, 'Test: pair of 8s');

    // Basic strategy spot checks (soft)
    console.assert(basicStrategy([{ rank: 'A', suit: '♠' }, { rank: '2', suit: '♦' }], 6) === 'Double', 'Soft 13 vs 6 -> Double');
    console.assert(basicStrategy([{ rank: 'A', suit: '♠' }, { rank: '7', suit: '♦' }], 3) === 'Double', 'Soft 18 vs 3 -> Double');

    // Ten-value pairs should always Stand
    const up6 = 6, up2 = 2, up10 = 10, upA = 11;
    console.assert(basicStrategy([{rank:'10',suit:'♠'},{rank:'10',suit:'♦'}], up6) === 'Stand', '10,10 vs 6 -> Stand');
    console.assert(basicStrategy([{rank:'J',suit:'♠'},{rank:'J',suit:'♦'}], up2) === 'Stand', 'J,J vs 2 -> Stand');
    console.assert(basicStrategy([{rank:'Q',suit:'♠'},{rank:'Q',suit:'♦'}], up10) === 'Stand', 'Q,Q vs 10 -> Stand');
    console.assert(basicStrategy([{rank:'K',suit:'♠'},{rank:'K',suit:'♦'}], upA) === 'Stand', 'K,K vs A -> Stand');
  } catch (_) {}

  /* ==================== Render ==================== */
  const active = playerHands[activeHand] || [];
  const isTenValuePair = active.length === 2 && isTenValue(active[0]) && isTenValue(active[1]);
  const canSplitThisHand =
    isPair(active) && !isTenValuePair && !lockedHands[activeHand];

  return (
    <div
      className="relative p-6 max-w-2xl mx-auto rounded-lg shadow-lg select-none"
      style={{ background: 'radial-gradient(circle, #006400, #013220)' }}
    >
      {showConfetti && <Confetti />}
      <h1 className="text-3xl font-bold mb-4 text-center text-yellow-300 drop-shadow">Soft & Split Blackjack Trainer</h1>

      {/* Strategy notification toast */}
      {coachOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`absolute top-3 right-3 px-3 py-2 rounded-lg shadow-lg text-sm ${
            coachGood ? 'bg-emerald-600/90 text-white' : 'bg-rose-600/90 text-white'
          }`}
          style={{ backdropFilter: 'blur(2px)' }}
        >
          {coachTip}
        </motion.div>
      )}

      <div className="mb-4 text-white text-lg flex items-center gap-3">
        <span>Bankroll: ${bankroll}</span>
        <motion.span
          key={bankrollDelta}
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={`px-2 py-0.5 rounded-full text-sm ${
            bankrollDelta > 0 ? 'bg-green-500/30 text-green-200'
              : bankrollDelta < 0 ? 'bg-red-500/30 text-red-200'
              : 'bg-slate-500/30 text-slate-200'
          }`}
        >
          {bankrollDelta === 0 ? '±$0' : `${bankrollDelta > 0 ? '+' : '-'}$${Math.abs(bankrollDelta)}`}
        </motion.span>
      </div>

      {/* Chips / Bet */}
      <div className="mb-4 text-white">
        <div className="flex items-center gap-3 mt-2">
          <div className="relative">
            <motion.div
              initial={false}
              animate={animBetPing ? { y: -8, scale: 1.06, opacity: 0.95 } : { y: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14 }}
              className="flex gap-2"
            >
              {[25, 50, 100, 500].map((value) => (<Chip key={value} value={value} onClick={handleChip} />))}
            </motion.div>
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs opacity-70">Bet: ${bet}</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-2 text-white">
        <label>
          <input type="checkbox" checked={autoDeal} onChange={(e) => setAutoDeal(e.target.checked)} className="mr-2" />
          Auto Deal
        </label>
        {!inRound && (
          <button onClick={startRound} className="ml-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-6 py-2 rounded-full shadow">
            Deal
          </button>
        )}
      </div>

      <div className="mt-6">
        {/* Dealer */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white mb-2">Dealer</h2>
          <div className="flex space-x-2 items-center">
            {!revealHole ? (
              <>
                {dealerHand[0] && <PlayingCard card={dealerHand[0]} />}
                <FlipCard showFront={false} front={<PlayingCard card={dealerHand[1] || { rank: 'A', suit: '♠' }} />} back={<CardBack />} />
              </>
            ) : (
              <>
                {dealerHand[0] && <PlayingCard card={dealerHand[0]} />}
                <FlipCard showFront={true} front={<PlayingCard card={dealerHand[1]} />} back={<CardBack />} />
                {dealerHand.slice(2).map((c, i) => (<PlayingCard key={i} card={c} />))}
              </>
            )}
          </div>
          {dealerPending && !revealHole && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="text-white/80 text-sm mt-1"
            >
              Dealer’s turn…
            </motion.div>
          )}
          <div className="text-white mt-1">
            Value: {!dealerHand.length ? '—' : !revealHole ? handValue([dealerHand[0]]) : handValue(dealerHand)}
          </div>
        </div>

        {/* Player Hands */}
        {playerHands.map((hand, idx) => (
          <div
            key={idx}
            className={`mb-4 p-2 rounded-lg bg-green-900 transition-shadow ${
              idx === activeHand
                ? (coachOpen && coachGood === false
                    ? 'shadow-[0_0_0_2px_rgba(255,0,0,0.55),0_0_18px_rgba(255,0,0,0.35)]'
                    : 'shadow-[0_0_0_2px_rgba(255,255,255,0.35),0_0_18px_rgba(255,255,255,0.25)]')
                : 'shadow-none'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-white">Player Hand {idx + 1}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-200/80">Wager: ${handBets[idx] ?? bet}</span>
                {lockedHands[idx] && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-200 border border-yellow-400/40">
                    One card only
                  </span>
                )}
                {handOutcomes[idx] && (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      handOutcomes[idx] === 'Win' ? 'bg-green-500/30 text-green-200'
                        : handOutcomes[idx] === 'Lose' ? 'bg-red-500/30 text-red-200'
                        : handOutcomes[idx] === 'Blackjack' ? 'bg-yellow-400/30 text-yellow-200'
                        : 'bg-slate-500/30 text-slate-200'
                    }`}
                  >
                    {handOutcomes[idx] === 'Blackjack' ? 'Blackjack +3:2' : handOutcomes[idx]}
                  </motion.span>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              {hand.map((c, i) => (<PlayingCard key={i} card={c} />))}
            </div>
            <div className="text-white">Value: {handValue(hand)}</div>
          </div>
        ))}

        {/* Action Bar */}
        {inRound && !dealerPending && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={hit}
              disabled={lockedHands[activeHand]}
              className={`px-4 py-2 rounded shadow ${lockedHands[activeHand]
                ? 'bg-green-500/40 text-white/60 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'}`}
            >
              Hit
            </button>
            <button className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded shadow" onClick={stand}>
              Stand
            </button>
            {canSplitThisHand && (
              <button
                onClick={split}
                disabled={lockedHands[activeHand]}
                className={`px-4 py-2 rounded shadow ${lockedHands[activeHand]
                  ? 'bg-purple-600/40 text-white/60 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
              >
                Split
              </button>
            )}
            <button
              onClick={doubleDown}
              disabled={!canDouble}
              className={`px-4 py-2 rounded shadow ${canDouble ? 'bg-black text-white' : 'bg-black/40 text-white/50 cursor-not-allowed'}`}
              title="Double Down (draw one card, then stand)"
            >
              Double
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlackjackTrainer;
