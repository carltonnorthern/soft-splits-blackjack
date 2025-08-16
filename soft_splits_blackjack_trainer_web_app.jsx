import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';

// -------------------- Card and deck utilities --------------------
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const createDeck = () => {
  const deck = [];
  for (let suit of suits) {
    for (let rank of ranks) {
      deck.push({ rank, suit });
    }
  }
  return deck;
};

const getValue = (card) => {
  if (["J", "Q", "K"].includes(card.rank)) return 10;
  if (card.rank === "A") return 11;
  return parseInt(card.rank);
};

const handValue = (hand) => {
  let total = 0;
  let aces = 0;
  for (let card of hand) {
    total += getValue(card);
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
};

const isPair = (hand) => hand.length === 2 && hand[0].rank === hand[1].rank;
const isSoft = (hand) => hand.some(c => c.rank === 'A') && handValue(hand) <= 21;

// -------------------- Basic strategy (soft & splits only, simplified) --------------------
const basicStrategy = (hand, dealerCard) => {
  if (isPair(hand)) {
    const rank = hand[0].rank;
    if (rank === 'A' || rank === '8') return 'Split';
    if (rank === '9') return dealerCard >= 2 && dealerCard <= 9 && dealerCard !== 7 ? 'Split' : 'Stand';
    if (rank === '7') return dealerCard <= 7 ? 'Split' : 'Hit';
    if (rank === '6') return dealerCard <= 6 ? 'Split' : 'Hit';
    if (rank === '4') return dealerCard === 5 || dealerCard === 6 ? 'Split' : 'Hit';
    if (rank === '3' || rank === '2') return dealerCard <= 7 ? 'Split' : 'Hit';
    return 'Hit';
  }
  if (isSoft(hand)) {
    const value = handValue(hand);
    if (value <= 17) return 'Hit';
    if (value === 18) return dealerCard >= 9 ? 'Hit' : 'Stand';
    return 'Stand';
  }
  return 'Hit';
};

// -------------------- Simple Sound FX (Web Audio API) --------------------
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
  // short noise burst for card slide
  const ctx = createAudioCtx(ctxRef);
  if (!ctx) return;
  const bufferSize = 4096;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);
  node.onaudioprocess = (e) => {
    const out = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // filtered noise that quickly decays
      out[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.15;
    }
  };
  node.connect(ctx.destination);
  setTimeout(() => node.disconnect(), 60);
}

const SFX = {
  deal: (ctx) => playClick(ctx),
  hit: (ctx) => playClick(ctx),
  stand: (ctx) => playBeep(ctx, { freq: 320, duration: 0.09, type: 'triangle' }),
  split: (ctx) => { playBeep(ctx, { freq: 660, duration: 0.06 }); playBeep(ctx, { freq: 660, duration: 0.06 }); },
  double: (ctx) => playBeep(ctx, { freq: 220, duration: 0.12, type: 'square', glideTo: 330 }),
  flip: (ctx) => playBeep(ctx, { freq: 520, duration: 0.08, type: 'sine' }),
  bet: (ctx) => playBeep(ctx, { freq: 420, duration: 0.08, type: 'sine' }),
  win: (ctx) => { playBeep(ctx, { freq: 520, duration: 0.1 }); setTimeout(() => playBeep(ctx, { freq: 660, duration: 0.12 }), 90); },
  lose: (ctx) => playBeep(ctx, { freq: 180, duration: 0.18, type: 'sawtooth', volume: 0.05 }),
  push: (ctx) => playBeep(ctx, { freq: 400, duration: 0.08, type: 'triangle' }),
};

// -------------------- UI bits --------------------
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

const CardBack = () => (
  <motion.div className="w-12 h-16 rounded-lg border-2 bg-gradient-to-br from-sky-600 to-indigo-700 shadow-md" />
);

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

// -------------------- Main Component --------------------
const BlackjackTrainer = () => {
  const [deck, setDeck] = useState(createDeck());
  const [playerHands, setPlayerHands] = useState([]);
  const [handBets, setHandBets] = useState([]); // bet per hand (handles splits & doubles)
  const [activeHand, setActiveHand] = useState(0);
  const [dealerHand, setDealerHand] = useState([]);
  const [bankroll, setBankroll] = useState(1000);
  const [bet, setBet] = useState(50);
  const [inRound, setInRound] = useState(false);
  const [autoDeal, setAutoDeal] = useState(false);
  const [revealHole, setRevealHole] = useState(false);
  const [bankrollDelta, setBankrollDelta] = useState(0);
  const [handOutcomes, setHandOutcomes] = useState([]); // 'Win' | 'Lose' | 'Push'
  const [animBetPing, setAnimBetPing] = useState(false);
  const audioCtxRef = useRef(null);

  const dealCard = (d) => {
    const idx = Math.floor(Math.random() * d.length);
    const card = d[idx];
    const newDeck = [...d];
    newDeck.splice(idx, 1);
    setDeck(newDeck);
    return card;
  };

  const startRound = () => {
    let d = createDeck();
    let player = [dealCard(d), dealCard(d)];
    let dealer = [dealCard(d), dealCard(d)];
    if (!isSoft(player) && !isPair(player)) {
      return startRound();
    }
    setDeck(d);
    setPlayerHands([[...player]]);
    setHandBets([bet]);
    setActiveHand(0);
    setDealerHand(dealer);
    setInRound(true);
    setRevealHole(false);
    setBankrollDelta(0);
    setHandOutcomes([]);
    // chip tween & sound at round start
    setAnimBetPing(true);
    setTimeout(() => setAnimBetPing(false), 500);
    SFX.deal(audioCtxRef);
  };

  const hit = () => {
    const newHands = [...playerHands];
    newHands[activeHand].push(dealCard(deck));
    setPlayerHands(newHands);
    SFX.hit(audioCtxRef);
    if (handValue(newHands[activeHand]) > 21) {
      SFX.lose(audioCtxRef);
      nextHand();
    }
  };

  const stand = () => {
    SFX.stand(audioCtxRef);
    nextHand();
  };

  const split = () => {
    const newHands = [...playerHands];
    const hand = newHands[activeHand];
    if (isPair(hand)) {
      const card1 = hand[0];
      const card2 = hand[1];
      newHands.splice(activeHand, 1, [card1, dealCard(deck)], [card2, dealCard(deck)]);
      setPlayerHands(newHands);
      const newBets = [...handBets];
      const thisBet = newBets[activeHand];
      newBets.splice(activeHand, 1, thisBet, thisBet);
      setHandBets(newBets);
      SFX.split(audioCtxRef);
    }
  };

  const doubleDown = () => {
    if (!inRound) return;
    const newHands = [...playerHands];
    if (newHands[activeHand].length !== 2) return;
    newHands[activeHand] = [...newHands[activeHand], dealCard(deck)];
    setPlayerHands(newHands);
    const newBets = [...handBets];
    newBets[activeHand] = newBets[activeHand] * 2;
    setHandBets(newBets);
    SFX.double(audioCtxRef);
    nextHand();
  };

  const nextHand = () => {
    if (activeHand < playerHands.length - 1) {
      setActiveHand(activeHand + 1);
    } else {
      dealerPlay();
    }
  };

  const dealerPlay = () => {
    setRevealHole(true);
    SFX.flip(audioCtxRef);
    let dHand = [...dealerHand];
    while (handValue(dHand) < 17) {
      dHand.push(dealCard(deck));
      SFX.deal(audioCtxRef);
    }
    setDealerHand(dHand);
    resolveHands(dHand);
  };

  const resolveHands = (dHand) => {
    const dVal = handValue(dHand);
    let results = [];
    let bankrollChange = 0;
    playerHands.forEach((hand, i) => {
      const pVal = handValue(hand);
      let outcome = '';
      if (pVal > 21) outcome = 'Lose';
      else if (dVal > 21 || pVal > dVal) outcome = 'Win';
      else if (pVal < dVal) outcome = 'Lose';
      else outcome = 'Push';
      results.push(outcome);
      const wager = handBets[i] ?? bet;
      if (outcome === 'Win') bankrollChange += wager;
      if (outcome === 'Lose') bankrollChange -= wager;
    });

    setHandOutcomes(results);
    setBankroll((bk) => bk + bankrollChange);
    setBankrollDelta(bankrollChange);

    // play outcome sound (prioritize worst -> best if mixed)
    if (results.every(r => r === 'Push')) {
      SFX.push(audioCtxRef);
    } else if (results.some(r => r === 'Lose') && !results.some(r => r === 'Win')) {
      SFX.lose(audioCtxRef);
    } else if (results.some(r => r === 'Win') && !results.some(r => r === 'Lose')) {
      SFX.win(audioCtxRef);
    } else {
      // mixed results
      SFX.push(audioCtxRef);
    }

    setInRound(false);
    if (autoDeal) {
      setTimeout(() => {
        startRound();
      }, 2500);
    }
  };

  const canDouble = inRound && playerHands[activeHand] && playerHands[activeHand].length === 2;

  // Wrap chip click so we can play a sound too
  const handleChip = (value) => {
    setBet(value);
    SFX.bet(audioCtxRef);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto rounded-lg shadow-lg select-none" style={{ background: 'radial-gradient(circle, #006400, #013220)' }}>
      <h1 className="text-3xl font-bold mb-4 text-center text-yellow-300 drop-shadow">Soft & Split Blackjack Trainer</h1>

      <div className="mb-4 text-white text-lg flex items-center gap-3">
        <span>Bankroll: ${bankroll}</span>
        <motion.span
          key={bankrollDelta}
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={`px-2 py-0.5 rounded-full text-sm ${bankrollDelta > 0 ? 'bg-green-500/30 text-green-200' : bankrollDelta < 0 ? 'bg-red-500/30 text-red-200' : 'bg-slate-500/30 text-slate-200'}`}
        >
          {bankrollDelta === 0 ? '±$0' : `${bankrollDelta > 0 ? '+' : '-'}$${Math.abs(bankrollDelta)}`}
        </motion.span>
      </div>

      <div className="mb-4 text-white">
        <div className="flex items-center gap-3 mt-2">
          <div className="relative">
            <motion.div
              initial={false}
              animate={animBetPing ? { y: -8, scale: 1.06, opacity: 0.95 } : { y: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14 }}
              className="flex gap-2"
            >
              {[25, 50, 100, 500].map((value) => (
                <Chip key={value} value={value} onClick={handleChip} />
              ))}
            </motion.div>
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs opacity-70">Bet: ${bet}</div>
          </div>
        </div>
      </div>

      <div className="mb-2 text-white">
        <label>
          <input type="checkbox" checked={autoDeal} onChange={e => setAutoDeal(e.target.checked)} className="mr-2" /> Auto Deal
        </label>
        {!inRound && (
          <button onClick={startRound} className="ml-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-6 py-2 rounded-full shadow">
            Deal
          </button>
        )}
      </div>

      <div className="mt-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white mb-2">Dealer</h2>
          <div className="flex space-x-2 items-center">
            {/* Upcard + facedown with flip on reveal */}
            {!revealHole ? (
              <>
                {dealerHand[0] && <PlayingCard card={dealerHand[0]} />}
                <FlipCard showFront={false} front={<PlayingCard card={dealerHand[1] || { rank: 'A', suit: '♠' }} />} back={<CardBack />} />
              </>
            ) : (
              <>
                {dealerHand[0] && <PlayingCard card={dealerHand[0]} />}
                <FlipCard showFront={true} front={<PlayingCard card={dealerHand[1]} />} back={<CardBack />} />
                {dealerHand.slice(2).map((c, i) => <PlayingCard key={i} card={c} />)}
              </>
            )}
          </div>
          <div className="text-white mt-1">
            Value: {!dealerHand.length ? '—' : (!revealHole ? handValue([dealerHand[0]]) : handValue(dealerHand))}
          </div>
        </div>

        {playerHands.map((hand, idx) => (
          <div
            key={idx}
            className={`mb-4 p-2 rounded-lg bg-green-900 transition-shadow ${idx === activeHand ? 'shadow-[0_0_0_2px_rgba(255,255,255,0.35),0_0_18px_rgba(255,255,255,0.25)]' : 'shadow-none'}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-white">Player Hand {idx + 1}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-200/80">Wager: ${handBets[idx] ?? bet}</span>
                {handOutcomes[idx] && (
                  <motion.span
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${handOutcomes[idx] === 'Win' ? 'bg-green-500/30 text-green-200' : handOutcomes[idx] === 'Lose' ? 'bg-red-500/30 text-red-200' : 'bg-slate-500/30 text-slate-200'}`}
                  >
                    {handOutcomes[idx]}
                  </motion.span>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              {hand.map((c, i) => <PlayingCard key={i} card={c} />)}
            </div>
            <div className="text-white">Value: {handValue(hand)}</div>
          </div>
        ))}

        {inRound && (
          <div className="flex flex-wrap gap-3">
            <button onClick={hit} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded shadow">Hit</button>
            <button onClick={stand} className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded shadow">Stand</button>
            {isPair(playerHands[activeHand]) && (
              <button onClick={split} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow">Split</button>
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
