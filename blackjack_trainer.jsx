import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RefreshCw, Volume2, VolumeX, Coins, CheckCircle2, XCircle, Shuffle, Settings, Lightbulb, History } from "lucide-react";

// =============================================================
// Blackjack Trainer - S17 • DAS • 3:2 (Full App, syntax fixed)
// Dealer hole card stays FACE-DOWN until reveal with a flip.
// Split Aces: one card only. No surrender. Auto-deal supported.
// =============================================================

// --------------------------- Utilities ---------------------------
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const rankValue = (r) => (r === "A" ? 11 : ["K", "Q", "J", "10"].includes(r) ? 10 : parseInt(r, 10));
const isTenValueRank = (r) => ["10", "J", "Q", "K"].includes(r);

const clone = (x) => JSON.parse(JSON.stringify(x));

function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeShoe(decks = 6) {
  const cards = [];
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        cards.push({ r, s, id: `${r}${s}-${d}-${Math.random().toString(36).slice(2, 6)}` });
      }
    }
  }
  return shuffle(cards);
}

function handTotal(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.r === "A") { aces++; total += 11; }
    else total += rankValue(c.r);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  // soft if at least one ace can be 11 after adjustment
  let baseAsOne = 0, aceCount = 0;
  for (const c of cards) { if (c.r === "A") { aceCount++; baseAsOne += 1; } else baseAsOne += rankValue(c.r); }
  const soft = aceCount > 0 && baseAsOne + 10 <= 21;
  return { total, soft };
}

const isBlackjack = (cards) => cards.length === 2 && handTotal(cards).total === 21;
// Classify initial two-card player hand for training filters
function classifyInitialHand(cards) {
  if (cards.length !== 2) return "unknown";
  // For splits training: only treat exact equal-value pairs as "pairs",
  // but EXCLUDE all value-10 combos (10/J/Q/K in any combination).
  const v1 = rankValue(cards[0].r);
  const v2 = rankValue(cards[1].r);
  if (v1 === v2) {
    if (v1 === 10) return "hard"; // exclude ALL 10-value pairs (10/J/Q/K, mixed or same)
    return "pairs";
  }
  const { soft } = handTotal(cards);
  return soft ? "soft" : "hard";
}

const isPair = (cards) => cards.length === 2 && ((isTenValueRank(cards[0].r) && isTenValueRank(cards[1].r)) || cards[0].r === cards[1].r);
const upcardValue = (card) => !card ? 0 : (card.r === "A" ? 11 : rankValue(card.r));

// ---------------------- Basic Strategy (S17, DAS) ----------------------
function basicStrategyDecision(playerCards, dealerUp, opts = { canDouble: true, canSplit: true }) {
  const d = upcardValue(dealerUp);
  const { total, soft } = handTotal(playerCards);
  const pair = isPair(playerCards);
  const [r1, r2] = playerCards.map((c) => c.r);

  // Pairs
  if (pair && opts.canSplit) {
    const tenPair = isTenValueRank(r1) && isTenValueRank(r2);
    if (r1 === "A" && r2 === "A") return { action: "SPLIT", reason: "Split A,A always." };
    if ((r1 === "8" && r2 === "8") || (rankValue(r1) === 8 && rankValue(r2) === 8)) return { action: "SPLIT", reason: "Split 8,8 always." };
    if (tenPair) return { action: "STAND", reason: "10-value pair: stand." };
    if ((r1 === "9" && r2 === "9") || (rankValue(r1) === 9 && rankValue(r2) === 9)) {
      if (d >= 2 && d <= 9 && d !== 7) return { action: "SPLIT", reason: "9,9 split vs 2–9 except 7." };
      return { action: "STAND", reason: "9,9 stand vs 7,10,A." };
    }
    if ((r1 === "7" && r2 === "7") || (rankValue(r1) === 7 && rankValue(r2) === 7)) {
      if (d >= 2 && d <= 7) return { action: "SPLIT", reason: "7,7 split vs 2–7." };
      return { action: "HIT", reason: "7,7 otherwise hit." };
    }
    if ((r1 === "6" && r2 === "6") || (rankValue(r1) === 6 && rankValue(r2) === 6)) {
      if (d >= 2 && d <= 6) return { action: "SPLIT", reason: "6,6 split vs 2–6." };
      return { action: "HIT", reason: "6,6 otherwise hit." };
    }
    if ((r1 === "4" && r2 === "4") || (rankValue(r1) === 4 && rankValue(r2) === 4)) {
      if (d >= 5 && d <= 6) return { action: "SPLIT", reason: "4,4 split vs 5–6." };
      return { action: "HIT", reason: "4,4 otherwise hit." };
    }
    if ((r1 === "3" && r2 === "3") || (rankValue(r1) === 3 && rankValue(r2) === 3) || (r1 === "2" && r2 === "2") || (rankValue(r1) === 2 && rankValue(r2) === 2)) {
      if (d >= 2 && d <= 7) return { action: "SPLIT", reason: "3,3 & 2,2 split vs 2–7." };
      return { action: "HIT", reason: "Otherwise hit." };
    }
    return { action: "HIT", reason: "Unlisted pair: hit." };
  }

  // Soft totals
  if (soft) {
    let base = 0; for (const c of playerCards) if (c.r !== "A") base += rankValue(c.r);
    const softTotal = base + 11; // one ace as 11
    if (softTotal >= 19) return { action: "STAND", reason: "A8+ stand." };
    if (softTotal === 18) {
      if (d >= 3 && d <= 6 && opts.canDouble) return { action: "DOUBLE", reason: "A7 double vs 3–6." };
      if ([2, 7, 8].includes(d)) return { action: "STAND", reason: "A7 stand vs 2,7,8." };
      return { action: "HIT", reason: "A7 hit vs 9,10,A." };
    }
    if ([13, 14].includes(softTotal)) {
      if ((d === 5 || d === 6) && opts.canDouble) return { action: "DOUBLE", reason: "A2–A3 double vs 5–6." };
      return { action: "HIT", reason: "Otherwise hit." };
    }
    if ([15, 16].includes(softTotal)) {
      if (d >= 4 && d <= 6 && opts.canDouble) return { action: "DOUBLE", reason: "A4–A5 double vs 4–6." };
      return { action: "HIT", reason: "Otherwise hit." };
    }
    if (softTotal === 17) {
      if (d >= 3 && d <= 6 && opts.canDouble) return { action: "DOUBLE", reason: "A6 double vs 3–6." };
      return { action: "HIT", reason: "Otherwise hit." };
    }
  }

  // Hard totals
  if (total >= 17) return { action: "STAND", reason: "Hard 17+ stand." };
  if (total >= 13 && total <= 16) return d >= 2 && d <= 6 ? { action: "STAND", reason: "Hard 13–16 stand vs 2–6." } : { action: "HIT", reason: "Otherwise hit." };
  if (total === 12) return d >= 4 && d <= 6 ? { action: "STAND", reason: "Hard 12 stand vs 4–6." } : { action: "HIT", reason: "Otherwise hit." };
  if (total === 11) return { action: opts.canDouble ? "DOUBLE" : "HIT", reason: opts.canDouble ? "Hard 11 double vs any." : "Double not available: hit." };
  if (total === 10) return { action: d >= 2 && d <= 9 && opts.canDouble ? "DOUBLE" : "HIT", reason: d >= 2 && d <= 9 ? "Hard 10 double vs 2–9." : "Otherwise hit." };
  if (total === 9)  return { action: d >= 3 && d <= 6 && opts.canDouble ? "DOUBLE" : "HIT", reason: d >= 3 && d <= 6 ? "Hard 9 double vs 3–6." : "Otherwise hit." };
  return { action: "HIT", reason: "Hard 8 or less: hit." };
}

// ----------------------- Sound Effects (WebAudio) -----------------------
function useSFX(enabled = true) {
  const ctxRef = useRef(null);
  useEffect(() => { if (!enabled) return; if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)(); }, [enabled]);
  const play = (type = "deal") => {
    if (!enabled) return; const ctx = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)(); ctxRef.current = ctx;
    const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); const now = ctx.currentTime;
    switch (type) {
      case "deal": o.frequency.setValueAtTime(660, now); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.2, now + 0.01); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12); break;
      case "flip": o.frequency.setValueAtTime(400, now); o.frequency.exponentialRampToValueAtTime(800, now + 0.08); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.25, now + 0.02); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15); break;
      case "win": o.frequency.setValueAtTime(523, now); o.frequency.exponentialRampToValueAtTime(880, now + 0.2); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.3, now + 0.02); g.gain.exponentialRampToValueAtTime(0.001, now + 0.35); break;
      case "lose": o.frequency.setValueAtTime(200, now); o.frequency.exponentialRampToValueAtTime(120, now + 0.15); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.25, now + 0.02); g.gain.exponentialRampToValueAtTime(0.001, now + 0.2); break;
      case "push": o.frequency.setValueAtTime(500, now); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.2, now + 0.02); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12); break;
    }
    o.start(); o.stop(ctx.currentTime + 0.4);
  }; return play;
}

// ----------------------- Card & Chip Components -----------------------
const SuitSVG = ({ suit, className = "" }) => {
  const color = suit === "♥" || suit === "♦" ? "text-red-600" : "text-gray-900";
  return <span className={`inline-block ${color} ${className}`} aria-label={suit}>{suit}</span>;
};

const Card = ({ card, faceDown = false, onFlip = null, index = 0 }) => {
  return (
    <motion.div
      initial={{ y: -15, opacity: 0, rotate: -2 }}
      animate={{ y: 0, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay: index * 0.05 }}
      className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-xl shadow-md bg-white border border-zinc-200 overflow-hidden"
      style={{ perspective: 1000 }}
    >
      <motion.div
        initial={{ rotateY: faceDown ? 180 : 0 }}
        animate={{ rotateY: faceDown ? 180 : 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d" }}
        onAnimationComplete={() => onFlip && onFlip()}
      >
        {/* Front */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }} className="p-1 flex flex-col justify-between">
          <div className="flex items-center justify-between px-1">
            <span className={`text-xs sm:text-sm font-bold ${["♥", "♦"].includes(card?.s) ? "text-red-600" : "text-zinc-900"}`}>{card?.r}</span>
            <SuitSVG suit={card?.s} className="text-sm sm:text-base" />
          </div>
          <div className="flex items-center justify-center text-2xl sm:text-3xl"><SuitSVG suit={card?.s} /></div>
          <div className="flex items-center justify-between px-1 rotate-180">
            <span className={`text-xs sm:text-sm font-bold ${["♥", "♦"].includes(card?.s) ? "text-red-600" : "text-zinc-900"}`}>{card?.r}</span>
            <SuitSVG suit={card?.s} className="text-sm sm:text-base" />
          </div>
        </div>
        {/* Back */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <div className="w-12 h-12 rounded-lg border-2 border-white/80" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Chip = ({ value = 25, onClick }) => {
  const color = value >= 100 ? "bg-yellow-400" : value >= 25 ? "bg-green-500" : value >= 10 ? "bg-blue-500" : "bg-red-500";
  return (
    <button onClick={onClick} className="relative focus:outline-none" title={`Add $${value}`}>
      <motion.div whileTap={{ scale: 0.9 }} className={`w-12 h-12 rounded-full ${color} shadow-md border-4 border-white flex items-center justify-center text-white font-bold`}>{value}</motion.div>
    </button>
  );
};

// ----------------------- Main Component -----------------------
export default function BlackjackTrainer() { // main component
  const [shoe, setShoe] = useState(() => makeShoe(6));
  const [bankroll, setBankroll] = useState(1000);
  const [bankrollDelta, setBankrollDelta] = useState(0);
  const [muted, setMuted] = useState(false);
  const playSfx = useSFX(!muted);

  const [bet, setBet] = useState(25);
  const [autoDeal, setAutoDeal] = useState(true);
  const [phase, setPhase] = useState("betting"); // betting | dealing | player | dealer | settle
  const [dealer, setDealer] = useState({ cards: [], hideHole: true });
  const [playerHands, setPlayerHands] = useState([]); // [{cards, bet, done, doubled, splitAces}]
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState("");
  const [correctness, setCorrectness] = useState(null); // {ok, text}
  const [hint, setHint] = useState(null); // {action, reason}
  const [testOutput, setTestOutput] = useState(null);
  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [allowedTypes, setAllowedTypes] = useState({ hard: true, soft: true, pairs: true });

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]); // [{id, playerHands, dealerCards, results, totalBet, totalReturn, net, timestamp}]

  // Hand identity to prevent stale timeouts from mutating a new hand
  const handIdRef = useRef(0);
  const nextHandId = () => ++handIdRef.current;

  const shoeRef = useRef(shoe);
  useEffect(() => { shoeRef.current = shoe; }, [shoe]);

  // Keep ref in sync with playerHands to avoid stale closures in timeouts
  const playerHandsRef = useRef(playerHands);
  useEffect(() => { playerHandsRef.current = playerHands; }, [playerHands]);

  // Draw from shoe; keep ref + state in sync so multiple draws in one tick see latest state
  const draw = () => {
    let s = shoeRef.current;
    if (!s || s.length < 52) s = makeShoe(6);
    const c = s.pop();
    shoeRef.current = s; // mutate ref first
    setShoe(s.slice()); // clone for React state
    return c;
  };

  const resetTable = () => {
    setDealer({ cards: [], hideHole: true });
    setPlayerHands([]);
    setActive(0);
    setCorrectness(null);
    setHint(null);
    setMessage("");
  };

  // Show hint for current hand
  const showHint = () => {
    const hand = playerHands[active];
    if (!hand) return;
    const dealerUp = dealer.cards[0];
    const firstMove = hand.cards.length === 2 && !hand.doubled && !hand.done;
    const strat = basicStrategyDecision(hand.cards, dealerUp, { canDouble: canDouble(hand, firstMove), canSplit: canSplit(hand) });
    setHint({ action: strat.action, reason: strat.reason });
  };

  const startHand = () => {
    if (bet <= 0 || bet > bankroll) return;
    if (!allowedTypes.hard && !allowedTypes.soft && !allowedTypes.pairs) { setMessage("Select at least one hand type in Settings."); return; }
    const id = nextHandId();
    resetTable();
    setPhase("dealing");

    // Deal until the player's initial two-card hand matches one of the allowed types
    let p1 = null;
    for (let tries = 0; tries < 600; tries++) {
      const a = draw();
      const b = draw();
      const candidate = [a, b];
      const t = classifyInitialHand(candidate);
      if (allowedTypes[t]) { p1 = candidate; break; }
      // else burn these and continue
    }
    if (!p1) p1 = [draw(), draw()];

    const d = [draw(), draw()];
    playSfx("deal");

    const initialHand = { cards: p1, bet, done: false, doubled: false, splitAces: isPair(p1) && p1[0].r === "A" && p1[1].r === "A" };
    setPlayerHands([initialHand]);
    setDealer({ cards: d, hideHole: true });

    // Lock bet amount immediately
    setBankroll((b) => b - bet);
    setBankrollDelta(-bet);

    setTimeout(() => {
      if (handIdRef.current !== id) return; // stale timeout
      setPhase("player");
      const playerBJ = isBlackjack(p1); const dealerBJ = isBlackjack(d);
      if (playerBJ || dealerBJ) { revealDealer(() => resolveRound(id, d), id); }
    }, 350);
  };

  const revealDealer = (cb, expectedId) => {
    if (expectedId && handIdRef.current !== expectedId) return;
    setDealer((prev) => ({ ...prev, hideHole: false }));
    playSfx("flip");
    const id = handIdRef.current;
    setTimeout(() => { if (!expectedId || handIdRef.current === id) cb && cb(); }, 600);
  };

  const canHit = (hand) => {
    const { total } = handTotal(hand.cards);
    if (hand.done) return false;
    if (hand.splitAces) return false; // split Aces receive one card only
    return total < 21;
  };

  const canDouble = (hand, isFirst) => {
    if (hand.splitAces) return false;
    if (!isFirst) return false;
    if (bankroll < hand.bet) return false;
    return true; // DAS allowed
  };

  const canSplit = (hand) => isPair(hand.cards) && bankroll >= hand.bet;

  const activeHand = playerHands[active];

  // Strategy correctness feedback
  const assessAction = (hand, action) => {
    const dealerUp = dealer.cards[0];
    const firstMove = hand.cards.length === 2 && !hand.doubled && !hand.done;
    const strat = basicStrategyDecision(hand.cards, dealerUp, { canDouble: canDouble(hand, firstMove), canSplit: canSplit(hand) });
    const ok = strat.action === action;
    setCorrectness({ ok, text: `${ok ? "Correct" : "Incorrect"} – ${strat.reason}` });
  };

  // Player actions
  const doHit = () => {
    const hands = clone(playerHands); const h = hands[active];
    assessAction(h, "HIT");
    setHint(null);
    h.cards.push(draw()); playSfx("deal");
    const { total } = handTotal(h.cards);
    if (total >= 21) { h.done = true; advanceHand(hands); }
    else setPlayerHands(hands);
  };

  const doStand = () => {
    const hands = clone(playerHands); const h = hands[active];
    assessAction(h, "STAND");
    setHint(null);
    h.done = true; advanceHand(hands);
  };

  const doDouble = () => {
    const hands = clone(playerHands); const h = hands[active];
    const first = h.cards.length === 2 && !h.doubled && !h.done;
    if (!canDouble(h, first)) return;
    assessAction(h, "DOUBLE");
    setHint(null);
    setBankroll((b) => b - h.bet); setBankrollDelta(-h.bet);
    h.bet *= 2; h.doubled = true; h.cards.push(draw()); playSfx("deal"); h.done = true; advanceHand(hands);
  };

  const doSplit = () => {
    const hands = clone(playerHands); const h = hands[active];
    if (!canSplit(h)) return;
    const isTenPair = isTenValueRank(h.cards[0].r) && isTenValueRank(h.cards[1].r); if (isTenPair) return; // UI hides, logic guards
    assessAction(h, "SPLIT");
    setHint(null);
    setBankroll((b) => b - h.bet); setBankrollDelta(-h.bet);
    const [c1, c2] = h.cards;
    const h1 = { cards: [c1, draw()], bet: h.bet, done: false, doubled: false, splitAces: c1.r === "A" };
    const h2 = { cards: [c2, draw()], bet: h.bet, done: false, doubled: false, splitAces: c2.r === "A" };
    if (h1.splitAces) h1.done = true; if (h2.splitAces) h2.done = true;
    hands.splice(active, 1, h1, h2); setPlayerHands(hands);
    if (h1.done) advanceHand(hands);
  };

  const advanceHand = (handsAfterChange) => {
    const hands = handsAfterChange ? clone(handsAfterChange) : clone(playerHands);
    let idx = active; while (idx < hands.length && hands[idx].done) idx++;
    if (idx < hands.length) { setPlayerHands(hands); setActive(idx); return; }
    // All hands done -> dealer turn
    setPlayerHands(hands); setPhase("dealer"); const id = handIdRef.current; revealDealer(() => dealerPlayAndSettle(id), id);
  };

  const dealerPlayAndSettle = (expectedId) => {
    setTimeout(() => {
      if (expectedId && handIdRef.current !== expectedId) return;

      let finalDealerCards = null;
      setDealer((prev) => {
        if (expectedId && handIdRef.current !== expectedId) return prev;
        let cards = prev.cards.slice();
        let { total } = handTotal(cards);
        while (total < 17) { cards.push(draw()); ({ total } = handTotal(cards)); }
        finalDealerCards = cards;
        return { cards, hideHole: false };
      });

      setTimeout(() => {
        if (!expectedId || handIdRef.current === expectedId) {
          resolveRound(expectedId, finalDealerCards);
        }
      }, 400);
    }, 450); // short pause before dealer plays
  };

  const settleHand = (hand, dealerCards) => {
    const pt = handTotal(hand.cards).total; const dt = handTotal(dealerCards).total;
    const playerBJ = isBlackjack(hand.cards); const dealerBJ = isBlackjack(dealerCards);

    // Blackjack resolution
    if (playerBJ && !dealerBJ) {
      const totalReturn = Math.floor(hand.bet * 2.5);
      return { delta: totalReturn, text: `Blackjack! (You: ${pt}, Dealer: ${dt}) +$${totalReturn - hand.bet}` };
    }
    if (playerBJ && dealerBJ) {
      return { delta: hand.bet, text: `Push on Blackjack. (You: ${pt}, Dealer: ${dt})` };
    }

    // Busts
    if (pt > 21) return { delta: 0, text: `Busted. (You: ${pt}, Dealer: ${dt}) -$${hand.bet}` };
    if (dt > 21) return { delta: hand.bet * 2, text: `Dealer busts! (You: ${pt}, Dealer: ${dt}) +$${hand.bet}` };

    // Compare
    if (pt > dt) return { delta: hand.bet * 2, text: `You win! (You: ${pt}, Dealer: ${dt}) +$${hand.bet}` };
    if (pt < dt) return { delta: 0, text: `You lose. (You: ${pt}, Dealer: ${dt}) -$${hand.bet}` };
    return { delta: hand.bet, text: `Push. (You: ${pt}, Dealer: ${dt})` };
  };

  const resolveRound = (expectedId, dealerCardsOverride = null) => {
    if (expectedId && handIdRef.current !== expectedId) return;
    const dCards = dealerCardsOverride || dealer.cards; let totalDelta = 0; const messages = []; const results = [];
    const hands = playerHandsRef.current; // use ref to avoid stale closure
    for (const h of hands) { const res = settleHand(h, dCards); totalDelta += res.delta; messages.push(res.text); results.push(res); }
    const totalBet = hands.reduce((a, h) => a + h.bet, 0);
    const net = totalDelta - totalBet;

    // Record hand in history
    const historyEntry = {
      id: Date.now(),
      playerHands: clone(hands),
      dealerCards: clone(dCards),
      results,
      totalBet,
      totalReturn: totalDelta,
      net,
      timestamp: new Date().toLocaleTimeString(),
    };
    setHistory((prev) => [historyEntry, ...prev]);

    setMessage(messages.join("\n"));
    if (net > 0) playSfx("win"); else if (net < 0) playSfx("lose"); else playSfx("push");
    setBankroll((b) => b + totalDelta); setBankrollDelta(net);
    setPhase("settle");
    if (autoDeal) { const id = handIdRef.current; setTimeout(() => { if (handIdRef.current === id) startHand(); }, 1200); }
  };

  const showSplitButton = useMemo(() => {
    const ah = playerHands[active]; if (!ah) return false; if (!isPair(ah.cards)) return false;
    const isTenPair = isTenValueRank(ah.cards[0].r) && isTenValueRank(ah.cards[1].r); if (isTenPair) return false;
    return canSplit(ah);
  }, [playerHands, active, bankroll]);

  const isFirstAction = activeHand && activeHand.cards.length === 2 && !activeHand.doubled && !activeHand.done;

  // ------------------ Strategy Tests ------------------
  const runStrategyTests = () => {
    const mk = (r1, r2, du) => basicStrategyDecision([{ r: r1, s: "♠" }, { r: r2, s: "♥" }], { r: du, s: "♣" }, { canDouble: true, canSplit: true }).action;
    const T = []; const pushT = (name, got, exp) => T.push({ name, got, exp, ok: got === exp });

    // --- Strategy (unchanged) ---
    pushT("AA vs 6", mk("A", "A", "6"), "SPLIT");
    pushT("88 vs 10", mk("8", "8", "10"), "SPLIT");
    pushT("TT vs 2 (stand)", mk("10", "K", "2"), "STAND");
    pushT("99 vs 7 (stand)", mk("9", "9", "7"), "STAND");
    pushT("99 vs 6 (split)", mk("9", "9", "6"), "SPLIT");
    pushT("77 vs 8 (hit)", mk("7", "7", "8"), "HIT");
    pushT("66 vs 2 (split)", mk("6", "6", "2"), "SPLIT");
    pushT("44 vs 6 (split)", mk("4", "4", "6"), "SPLIT");
    pushT("22 vs 7 (split)", mk("2", "2", "7"), "SPLIT");
    // Soft totals
    pushT("A7 vs 2 (stand)", mk("A", "7", "2"), "STAND");
    pushT("A7 vs 3 (double)", mk("A", "7", "3"), "DOUBLE");
    pushT("A7 vs 9 (hit)", mk("A", "7", "9"), "HIT");
    pushT("A6 vs 4 (double)", mk("A", "6", "4"), "DOUBLE");
    pushT("A5 vs 4 (double)", mk("A", "5", "4"), "DOUBLE");
    pushT("A3 vs 5 (double)", mk("A", "3", "5"), "DOUBLE");
    // Hard totals
    pushT("12 vs 4 (stand)", mk("7", "5", "4"), "STAND");
    pushT("16 vs 10 (hit)", mk("9", "7", "10"), "HIT");
    pushT("11 vs A (double)", mk("6", "5", "A"), "DOUBLE");
    pushT("10 vs 9 (double)", mk("6", "4", "9"), "DOUBLE");
    pushT("9 vs 3 (double)", mk("5", "4", "3"), "DOUBLE");
    pushT("8 vs 6 (hit)", mk("5", "3", "6"), "HIT");

    // --- Numeric handTotal sanity checks ---
    const asCards = (vals) => vals.map((v, i) => ({ r: v, s: i % 2 ? "♥" : "♠", id: v + i }));
    const total = (vals) => handTotal(asCards(vals)).total;
    const softFlag = (vals) => handTotal(asCards(vals)).soft;
    pushT("handTotal K,6,5 = 21", total(["K","6","5"]), 21);
    pushT("handTotal A,6 soft= true & total=17", `${softFlag(["A","6"])},${total(["A","6"])}`, `${true},${17}`);
    pushT("handTotal A,6,10 soft=false & total=17", `${softFlag(["A","6","10"])},${total(["A","6","10"])}`, `${false},${17}`);

    // --- Settle logic using explicit card arrays ---
    const settleBy = (pc, dc, bet = 25) => {
      const hand = { cards: asCards(pc), bet };
      const dhand = asCards(dc);
      const pt = handTotal(hand.cards).total; const dt = handTotal(dhand).total;
      const playerBJ = isBlackjack(hand.cards); const dealerBJ = isBlackjack(dhand);
      if (playerBJ && !dealerBJ) return Math.floor(bet * 2.5);
      if (playerBJ && dealerBJ) return bet;
      if (pt > 21) return 0;
      if (dt > 21) return bet * 2;
      if (pt > dt) return bet * 2;
      if (pt < dt) return 0;
      return bet;
    };
    const pushS = (name, got, exp) => T.push({ name, got, exp, ok: got === exp });
    pushS("Player 20 vs Dealer K,6,5 = lose", settleBy(["10","10"], ["K","6","5"]), 0);
    pushS("Player 21 (10,9,2) vs Dealer K,6,5 = push", settleBy(["10","9","2"], ["K","6","5"]), 25);
    pushS("Player BJ (A,K) vs Dealer 19", settleBy(["A","K"], ["10","9"]), Math.floor(25 * 2.5));
    pushS("Player 21 vs Dealer 19 = win", settleBy(["10","9","2"], ["10","9"]), 50);
    pushS("Player 20 vs Dealer 22 (10,9,3) = win", settleBy(["10","10"], ["10","9","3"]), 50);

    const ok = T.every((t) => t.ok);
    setTestOutput({ cases: T, ok });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between gap-2 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold">Blackjack Trainer — S17 • DAS • 3:2 BJ</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory((v) => !v)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center gap-2"><History size={18} /> <span className="hidden sm:inline">History</span>{history.length > 0 && <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{history.length}</span>}</button>
            <button onClick={() => setShowSettings((v) => !v)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center gap-2"><Settings size={18} /> <span className="hidden sm:inline">Settings</span></button>
            <button onClick={() => setMuted((m) => !m)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center gap-2">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />} <span className="hidden sm:inline">Sound</span></button>
            <button onClick={() => { const ns = makeShoe(6); shoeRef.current = ns; setShoe(ns); }} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center gap-2" title="Shuffle shoe"><Shuffle size={18} /> <span className="hidden sm:inline">Shuffle</span></button>
            <button onClick={runStrategyTests} className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 flex items-center gap-2"><CheckCircle2 size={18} /> <span className="hidden sm:inline">Run Strategy Tests</span></button>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="font-semibold mb-2 flex items-center gap-2"><Settings size={16} /> Training Filters</div>
            <div className="text-sm text-white/80 mb-3">Only deal initial hands that match the selected types.</div>
            <div className="flex flex-wrap gap-4">
              {(["hard","soft","pairs"]).map((k) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="accent-emerald-400"
                    checked={allowedTypes[k]}
                    onChange={(e) => setAllowedTypes((prev) => ({ ...prev, [k]: e.target.checked }))}
                  />
                  <span className="capitalize">{k}</span>
                </label>
              ))}
            </div>
            {!allowedTypes.hard && !allowedTypes.soft && !allowedTypes.pairs && (
              <div className="mt-3 text-xs text-rose-300">Select at least one type to enable dealing.</div>
            )}
          </div>
        )}

        {/* History Panel */}
        {showHistory && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold flex items-center gap-2"><History size={16} /> Hand History</div>
              {history.length > 0 && (
                <button onClick={() => setHistory([])} className="text-xs px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 text-rose-300">Clear History</button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="text-sm text-white/60">No hands played yet.</div>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div key={entry.id} className={`p-3 rounded-xl border ${entry.net > 0 ? "bg-emerald-500/10 border-emerald-400/20" : entry.net < 0 ? "bg-rose-500/10 border-rose-400/20" : "bg-white/5 border-white/10"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-white/60">{entry.timestamp}</div>
                      <div className={`text-sm font-semibold ${entry.net > 0 ? "text-emerald-400" : entry.net < 0 ? "text-rose-400" : "text-white/70"}`}>
                        {entry.net > 0 ? `+$${entry.net}` : entry.net < 0 ? `-$${Math.abs(entry.net)}` : "Push"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <div className="text-xs text-white/60 mb-1">Dealer</div>
                        <div className="flex items-center gap-1">
                          {entry.dealerCards.map((c, i) => (
                            <span key={i} className={`px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono ${["♥", "♦"].includes(c.s) ? "text-red-400" : "text-white"}`}>{c.r}{c.s}</span>
                          ))}
                          <span className="ml-1 text-white/70">({handTotal(entry.dealerCards).total})</span>
                        </div>
                      </div>
                      {entry.playerHands.map((h, idx) => (
                        <div key={idx}>
                          <div className="text-xs text-white/60 mb-1">Hand {entry.playerHands.length > 1 ? `#${idx + 1}` : ""} (Bet: ${h.bet})</div>
                          <div className="flex items-center gap-1">
                            {h.cards.map((c, i) => (
                              <span key={i} className={`px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono ${["♥", "♦"].includes(c.s) ? "text-red-400" : "text-white"}`}>{c.r}{c.s}</span>
                            ))}
                            <span className="ml-1 text-white/70">({handTotal(h.cards).total})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-white/70">
                      {entry.results.map((r, i) => (
                        <div key={i}>{r.text}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {history.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-sm">
                <div>
                  <span className="text-white/60">Hands played:</span> <span className="font-semibold">{history.length}</span>
                </div>
                <div>
                  <span className="text-white/60">Net:</span>{" "}
                  <span className={`font-semibold ${history.reduce((a, e) => a + e.net, 0) > 0 ? "text-emerald-400" : history.reduce((a, e) => a + e.net, 0) < 0 ? "text-rose-400" : "text-white/70"}`}>
                    {history.reduce((a, e) => a + e.net, 0) >= 0 ? "+$" : "-$"}{Math.abs(history.reduce((a, e) => a + e.net, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bankroll */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <Coins className="text-yellow-300" />
            <div className="text-lg font-semibold">Bankroll: ${bankroll}</div>
            <AnimatePresence>
              {bankrollDelta !== 0 && (
                <motion.div key={bankrollDelta + ":delta"} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} className={`text-sm font-bold ${bankrollDelta > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {bankrollDelta > 0 ? "+$" : "-$"}{Math.abs(bankrollDelta)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="accent-emerald-400" checked={autoDeal} onChange={(e) => setAutoDeal(e.target.checked)} />
            <span className="text-sm">Auto-deal next hand</span>
          </label>
        </div>

        {/* Table area */}
        <div className="rounded-2xl border border-white/10 bg-emerald-900/20 p-4 sm:p-6 shadow-inner">
          {/* Dealer row */}
          <div className="mb-6">
            <div className="text-sm uppercase tracking-wide text-white/70 mb-2">Dealer</div>
            <div className="flex items-center gap-2">
              {dealer.cards.map((c, i) => (<Card key={c.id} card={c} faceDown={i === 1 && dealer.hideHole} index={i} />))}
              <div className="ml-3 text-white/80 font-medium">Total: {(!dealer.cards.length || dealer.hideHole) ? "?" : handTotal(dealer.cards).total}</div>
            </div>
          </div>

          {/* Player hands */}
          <div className="space-y-4">
            {playerHands.map((h, idx) => {
              const { total } = handTotal(h.cards);
              const isActive = idx === active && phase === "player";
              const isTenPair = h.cards.length === 2 && isTenValueRank(h.cards[0].r) && isTenValueRank(h.cards[1].r);
              return (
                <div key={idx} className={`rounded-xl p-3 border ${isActive ? "border-emerald-400/60 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm uppercase tracking-wide text-white/70">Your Hand {playerHands.length > 1 ? `#${idx + 1}` : ""}</div>
                    <div className="text-sm">Bet: ${h.bet}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.cards.map((c, i) => (<Card key={c.id} card={c} index={i} />))}
                    <div className="ml-3 text-white/90 font-medium">Total: {total}</div>
                    {h.splitAces && <div className="ml-2 text-xs text-white/70">Split Aces (one card only)</div>}
                  </div>
                  {isActive && (
                    <div className="mt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={doHit} disabled={!canHit(h)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50">Hit</button>
                        <button onClick={doStand} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10">Stand</button>
                        <button onClick={doDouble} disabled={!canDouble(h, isFirstAction)} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50">Double</button>
                        {showSplitButton && idx === active && (<button onClick={doSplit} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10">Split</button>)}
                        <button onClick={showHint} className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 flex items-center gap-1"><Lightbulb size={16} /> Hint</button>
                        {isTenPair && idx === active && (<div className="text-xs text-white/70 ml-2">10-value pair: Split disabled (strategy = Stand)</div>)}
                      </div>
                      {hint && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 p-2 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-200"
                        >
                          <div className="flex items-center gap-2">
                            <Lightbulb size={16} className="text-amber-400" />
                            <span className="font-semibold">Optimal: {hint.action}</span>
                          </div>
                          <div className="text-sm text-amber-200/80 mt-1">{hint.reason}</div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer controls */}
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-wide text-white/70 mb-2">Place Bet</div>
              <div className="flex items-center gap-3">
                {[5, 25, 100].map((v) => (<Chip key={v} value={v} onClick={() => setBet((b) => Math.min(1000, b + v))} />))}
                <button onClick={() => setBet((b) => Math.max(0, b - 5))} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10">- $5</button>
                <button onClick={() => setBet((b) => Math.min(bankroll, b + 5))} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10">+ $5</button>
                <div className="ml-3">Current Bet: <span className="font-semibold">${bet}</span></div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPhase("betting") || resetTable()} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 flex items-center gap-2"><RefreshCw size={18} /> Clear</button>
              <button onClick={startHand} disabled={phase === "dealing" || bet <= 0 || bet > bankroll} className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 border border-emerald-400 text-slate-900 font-semibold flex items-center gap-2 disabled:opacity-50"><Play size={18} /> Deal</button>
            </div>
          </div>

          {/* Messages */}
          <div className="mt-4 min-h-[40px]">
            <AnimatePresence>
              {correctness && (
                <motion.div key={correctness.text} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className={`text-sm flex items-center gap-2 ${correctness.ok ? "text-emerald-300" : "text-rose-300"}`}>
                  {correctness.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {correctness.text}
                </motion.div>
              )}
            </AnimatePresence>
            {message && (<div className="mt-2 text-white/90 whitespace-pre-wrap">{message}</div>)}
          </div>
        </div>

        {/* Strategy Test Output */}
        <AnimatePresence>
          {testOutput && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">Strategy Tests</div>
                <div className="flex items-center gap-3">
                  <div className={`text-sm ${testOutput.ok ? "text-emerald-300" : "text-rose-300"}`}>{testOutput.ok ? "All tests passed" : "Some tests failed"}</div>
                  <button onClick={() => setTestOutput(null)} className="text-white/60 hover:text-white/90 text-xl leading-none">&times;</button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {testOutput.cases.map((c, i) => (
                  <div key={i} className={`text-sm p-2 rounded-lg ${c.ok ? "bg-emerald-500/10 border border-emerald-400/20" : "bg-rose-500/10 border border-rose-400/20"}`}>
                    <div className="font-medium">{c.name}</div>
                    <div>Expected: <span className="font-mono">{c.exp}</span> • Got: <span className="font-mono">{c.got}</span></div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mt-6 text-xs text-white/60">Dealer stands on soft 17. No surrender. DAS allowed. Split Aces one card each. Blackjack pays 3:2. Split button hidden for ten-value pairs.</p>
      </div>
    </div>
  );
}
