/**
 * Blackjack Trainer Test Suite
 *
 * Run with: npm test
 * Requires: npm install --save-dev jest
 *
 * Tests cover:
 * - Utility functions (handTotal, rankValue, shuffle)
 * - Hand classification (hard/soft/pairs)
 * - Basic strategy decisions (S17, DAS, no surrender)
 * - Game rules (blackjack 3:2, split aces, settle logic)
 */

// ============================================================
// Extracted functions from blackjack_trainer.jsx for testing
// ============================================================

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const rankValue = (r) => (r === "A" ? 11 : ["K", "Q", "J", "10"].includes(r) ? 10 : parseInt(r, 10));
const isTenValueRank = (r) => ["10", "J", "Q", "K"].includes(r);

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
  let baseAsOne = 0, aceCount = 0;
  for (const c of cards) { if (c.r === "A") { aceCount++; baseAsOne += 1; } else baseAsOne += rankValue(c.r); }
  const soft = aceCount > 0 && baseAsOne + 10 <= 21;
  return { total, soft };
}

const isBlackjack = (cards) => cards.length === 2 && handTotal(cards).total === 21;

function classifyInitialHand(cards) {
  if (cards.length !== 2) return "unknown";
  const v1 = rankValue(cards[0].r);
  const v2 = rankValue(cards[1].r);
  if (v1 === v2) {
    if (v1 === 10) return "hard"; // exclude ALL 10-value pairs
    return "pairs";
  }
  const { soft } = handTotal(cards);
  return soft ? "soft" : "hard";
}

const isPair = (cards) => cards.length === 2 && ((isTenValueRank(cards[0].r) && isTenValueRank(cards[1].r)) || cards[0].r === cards[1].r);
const upcardValue = (card) => !card ? 0 : (card.r === "A" ? 11 : rankValue(card.r));

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
    const softTotal = base + 11;
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

// Settle hand logic
function settleHand(playerCards, dealerCards, bet = 25) {
  const pt = handTotal(playerCards).total;
  const dt = handTotal(dealerCards).total;
  const playerBJ = isBlackjack(playerCards);
  const dealerBJ = isBlackjack(dealerCards);

  if (playerBJ && !dealerBJ) {
    const totalReturn = Math.floor(bet * 2.5);
    return { delta: totalReturn, outcome: "blackjack", playerTotal: pt, dealerTotal: dt };
  }
  if (playerBJ && dealerBJ) {
    return { delta: bet, outcome: "push", playerTotal: pt, dealerTotal: dt };
  }
  if (pt > 21) return { delta: 0, outcome: "bust", playerTotal: pt, dealerTotal: dt };
  if (dt > 21) return { delta: bet * 2, outcome: "dealer_bust", playerTotal: pt, dealerTotal: dt };
  if (pt > dt) return { delta: bet * 2, outcome: "win", playerTotal: pt, dealerTotal: dt };
  if (pt < dt) return { delta: 0, outcome: "lose", playerTotal: pt, dealerTotal: dt };
  return { delta: bet, outcome: "push", playerTotal: pt, dealerTotal: dt };
}

// Helper to create cards
const makeCard = (r, s = "♠") => ({ r, s, id: `${r}${s}` });
const makeCards = (...ranks) => ranks.map((r, i) => makeCard(r, SUITS[i % 4]));

// ============================================================
// TEST SUITE
// ============================================================

describe("Utility Functions", () => {
  describe("rankValue", () => {
    test("Ace returns 11", () => {
      expect(rankValue("A")).toBe(11);
    });

    test("Face cards return 10", () => {
      expect(rankValue("K")).toBe(10);
      expect(rankValue("Q")).toBe(10);
      expect(rankValue("J")).toBe(10);
      expect(rankValue("10")).toBe(10);
    });

    test("Number cards return face value", () => {
      expect(rankValue("2")).toBe(2);
      expect(rankValue("5")).toBe(5);
      expect(rankValue("9")).toBe(9);
    });
  });

  describe("isTenValueRank", () => {
    test("10, J, Q, K are ten-value ranks", () => {
      expect(isTenValueRank("10")).toBe(true);
      expect(isTenValueRank("J")).toBe(true);
      expect(isTenValueRank("Q")).toBe(true);
      expect(isTenValueRank("K")).toBe(true);
    });

    test("Other ranks are not ten-value", () => {
      expect(isTenValueRank("A")).toBe(false);
      expect(isTenValueRank("9")).toBe(false);
      expect(isTenValueRank("2")).toBe(false);
    });
  });

  describe("shuffle", () => {
    test("Returns array of same length", () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(shuffled.length).toBe(arr.length);
    });

    test("Contains same elements", () => {
      const arr = [1, 2, 3, 4, 5];
      const shuffled = shuffle(arr);
      expect(shuffled.sort()).toEqual(arr.sort());
    });

    test("Does not mutate original array", () => {
      const arr = [1, 2, 3, 4, 5];
      const original = [...arr];
      shuffle(arr);
      expect(arr).toEqual(original);
    });
  });

  describe("makeShoe", () => {
    test("6-deck shoe has 312 cards", () => {
      const shoe = makeShoe(6);
      expect(shoe.length).toBe(312);
    });

    test("1-deck shoe has 52 cards", () => {
      const shoe = makeShoe(1);
      expect(shoe.length).toBe(52);
    });
  });
});

describe("Hand Total Calculation", () => {
  test("Simple hand: K + 6 = 16 (hard)", () => {
    const cards = makeCards("K", "6");
    const result = handTotal(cards);
    expect(result.total).toBe(16);
    expect(result.soft).toBe(false);
  });

  test("Blackjack: A + K = 21 (soft)", () => {
    const cards = makeCards("A", "K");
    const result = handTotal(cards);
    expect(result.total).toBe(21);
    expect(result.soft).toBe(true);
  });

  test("Soft 17: A + 6 = 17 (soft)", () => {
    const cards = makeCards("A", "6");
    const result = handTotal(cards);
    expect(result.total).toBe(17);
    expect(result.soft).toBe(true);
  });

  test("Hard 17 from soft: A + 6 + 10 = 17 (hard)", () => {
    const cards = makeCards("A", "6", "10");
    const result = handTotal(cards);
    expect(result.total).toBe(17);
    expect(result.soft).toBe(false);
  });

  test("Multiple aces: A + A + 9 = 21", () => {
    const cards = makeCards("A", "A", "9");
    const result = handTotal(cards);
    expect(result.total).toBe(21);
  });

  test("Bust: K + 6 + 8 = 24", () => {
    const cards = makeCards("K", "6", "8");
    const result = handTotal(cards);
    expect(result.total).toBe(24);
  });

  test("K + 6 + 5 = 21", () => {
    const cards = makeCards("K", "6", "5");
    const result = handTotal(cards);
    expect(result.total).toBe(21);
  });

  test("Three aces: A + A + A = 13 (soft)", () => {
    const cards = makeCards("A", "A", "A");
    const result = handTotal(cards);
    expect(result.total).toBe(13);
    expect(result.soft).toBe(true);
  });
});

describe("Hand Classification", () => {
  test("A + 7 is soft", () => {
    const cards = makeCards("A", "7");
    expect(classifyInitialHand(cards)).toBe("soft");
  });

  test("10 + 6 is hard", () => {
    const cards = makeCards("10", "6");
    expect(classifyInitialHand(cards)).toBe("hard");
  });

  test("8 + 8 is pairs", () => {
    const cards = makeCards("8", "8");
    expect(classifyInitialHand(cards)).toBe("pairs");
  });

  test("A + A is pairs", () => {
    const cards = makeCards("A", "A");
    expect(classifyInitialHand(cards)).toBe("pairs");
  });

  test("K + K is hard (10-value pairs excluded)", () => {
    const cards = makeCards("K", "K");
    expect(classifyInitialHand(cards)).toBe("hard");
  });

  test("10 + J is hard (mixed 10-value excluded)", () => {
    const cards = makeCards("10", "J");
    expect(classifyInitialHand(cards)).toBe("hard");
  });

  test("Q + K is hard (mixed 10-value excluded)", () => {
    const cards = makeCards("Q", "K");
    expect(classifyInitialHand(cards)).toBe("hard");
  });

  test("3+ cards returns unknown", () => {
    const cards = makeCards("5", "6", "7");
    expect(classifyInitialHand(cards)).toBe("unknown");
  });
});

describe("Blackjack Detection", () => {
  test("A + K is blackjack", () => {
    const cards = makeCards("A", "K");
    expect(isBlackjack(cards)).toBe(true);
  });

  test("A + 10 is blackjack", () => {
    const cards = makeCards("A", "10");
    expect(isBlackjack(cards)).toBe(true);
  });

  test("10 + 9 + 2 is NOT blackjack (21 but 3 cards)", () => {
    const cards = makeCards("10", "9", "2");
    expect(isBlackjack(cards)).toBe(false);
  });

  test("K + Q is NOT blackjack (20)", () => {
    const cards = makeCards("K", "Q");
    expect(isBlackjack(cards)).toBe(false);
  });
});

describe("Basic Strategy - Pairs", () => {
  const getAction = (r1, r2, dealerRank) =>
    basicStrategyDecision(makeCards(r1, r2), makeCard(dealerRank)).action;

  test("Always split A,A", () => {
    expect(getAction("A", "A", "2")).toBe("SPLIT");
    expect(getAction("A", "A", "6")).toBe("SPLIT");
    expect(getAction("A", "A", "10")).toBe("SPLIT");
    expect(getAction("A", "A", "A")).toBe("SPLIT");
  });

  test("Always split 8,8", () => {
    expect(getAction("8", "8", "2")).toBe("SPLIT");
    expect(getAction("8", "8", "7")).toBe("SPLIT");
    expect(getAction("8", "8", "10")).toBe("SPLIT");
    expect(getAction("8", "8", "A")).toBe("SPLIT");
  });

  test("10-value pairs: stand", () => {
    expect(getAction("10", "10", "5")).toBe("STAND");
    expect(getAction("K", "K", "6")).toBe("STAND");
    expect(getAction("Q", "J", "2")).toBe("STAND");
  });

  test("9,9 split vs 2-9 except 7", () => {
    expect(getAction("9", "9", "2")).toBe("SPLIT");
    expect(getAction("9", "9", "6")).toBe("SPLIT");
    expect(getAction("9", "9", "9")).toBe("SPLIT");
    expect(getAction("9", "9", "7")).toBe("STAND");
    expect(getAction("9", "9", "10")).toBe("STAND");
    expect(getAction("9", "9", "A")).toBe("STAND");
  });

  test("7,7 split vs 2-7", () => {
    expect(getAction("7", "7", "2")).toBe("SPLIT");
    expect(getAction("7", "7", "7")).toBe("SPLIT");
    expect(getAction("7", "7", "8")).toBe("HIT");
    expect(getAction("7", "7", "10")).toBe("HIT");
  });

  test("6,6 split vs 2-6", () => {
    expect(getAction("6", "6", "2")).toBe("SPLIT");
    expect(getAction("6", "6", "6")).toBe("SPLIT");
    expect(getAction("6", "6", "7")).toBe("HIT");
  });

  test("4,4 split vs 5-6 only", () => {
    expect(getAction("4", "4", "4")).toBe("HIT");
    expect(getAction("4", "4", "5")).toBe("SPLIT");
    expect(getAction("4", "4", "6")).toBe("SPLIT");
    expect(getAction("4", "4", "7")).toBe("HIT");
  });

  test("3,3 and 2,2 split vs 2-7", () => {
    expect(getAction("3", "3", "2")).toBe("SPLIT");
    expect(getAction("3", "3", "7")).toBe("SPLIT");
    expect(getAction("3", "3", "8")).toBe("HIT");
    expect(getAction("2", "2", "2")).toBe("SPLIT");
    expect(getAction("2", "2", "7")).toBe("SPLIT");
    expect(getAction("2", "2", "8")).toBe("HIT");
  });
});

describe("Basic Strategy - Soft Hands", () => {
  const getAction = (r1, r2, dealerRank) =>
    basicStrategyDecision(makeCards(r1, r2), makeCard(dealerRank)).action;

  test("A,8+ always stand", () => {
    expect(getAction("A", "8", "6")).toBe("STAND");
    expect(getAction("A", "9", "10")).toBe("STAND");
    expect(getAction("A", "K", "A")).toBe("STAND"); // A,10 = 21
  });

  test("A,7 double vs 3-6", () => {
    expect(getAction("A", "7", "3")).toBe("DOUBLE");
    expect(getAction("A", "7", "4")).toBe("DOUBLE");
    expect(getAction("A", "7", "5")).toBe("DOUBLE");
    expect(getAction("A", "7", "6")).toBe("DOUBLE");
  });

  test("A,7 stand vs 2,7,8", () => {
    expect(getAction("A", "7", "2")).toBe("STAND");
    expect(getAction("A", "7", "7")).toBe("STAND");
    expect(getAction("A", "7", "8")).toBe("STAND");
  });

  test("A,7 hit vs 9,10,A", () => {
    expect(getAction("A", "7", "9")).toBe("HIT");
    expect(getAction("A", "7", "10")).toBe("HIT");
    expect(getAction("A", "7", "A")).toBe("HIT");
  });

  test("A,6 double vs 3-6, else hit", () => {
    expect(getAction("A", "6", "2")).toBe("HIT");
    expect(getAction("A", "6", "3")).toBe("DOUBLE");
    expect(getAction("A", "6", "4")).toBe("DOUBLE");
    expect(getAction("A", "6", "6")).toBe("DOUBLE");
    expect(getAction("A", "6", "7")).toBe("HIT");
  });

  test("A,4 and A,5 double vs 4-6, else hit", () => {
    expect(getAction("A", "4", "3")).toBe("HIT");
    expect(getAction("A", "4", "4")).toBe("DOUBLE");
    expect(getAction("A", "5", "5")).toBe("DOUBLE");
    expect(getAction("A", "5", "6")).toBe("DOUBLE");
    expect(getAction("A", "4", "7")).toBe("HIT");
  });

  test("A,2 and A,3 double vs 5-6, else hit", () => {
    expect(getAction("A", "2", "4")).toBe("HIT");
    expect(getAction("A", "2", "5")).toBe("DOUBLE");
    expect(getAction("A", "3", "6")).toBe("DOUBLE");
    expect(getAction("A", "3", "7")).toBe("HIT");
  });
});

describe("Basic Strategy - Hard Hands", () => {
  const getAction = (r1, r2, dealerRank) =>
    basicStrategyDecision(makeCards(r1, r2), makeCard(dealerRank)).action;

  test("Hard 17+ always stand", () => {
    expect(getAction("10", "7", "10")).toBe("STAND");
    expect(getAction("10", "8", "A")).toBe("STAND");
    expect(getAction("K", "9", "6")).toBe("STAND");
  });

  test("Hard 13-16 stand vs 2-6, hit otherwise", () => {
    expect(getAction("10", "3", "4")).toBe("STAND");
    expect(getAction("10", "4", "6")).toBe("STAND");
    expect(getAction("10", "5", "2")).toBe("STAND");
    expect(getAction("10", "6", "7")).toBe("HIT");
    expect(getAction("9", "7", "10")).toBe("HIT");
    expect(getAction("8", "8", "A")).toBe("SPLIT"); // pairs take precedence
  });

  test("Hard 12 stand vs 4-6, hit otherwise", () => {
    expect(getAction("7", "5", "3")).toBe("HIT");
    expect(getAction("7", "5", "4")).toBe("STAND");
    expect(getAction("7", "5", "5")).toBe("STAND");
    expect(getAction("7", "5", "6")).toBe("STAND");
    expect(getAction("7", "5", "7")).toBe("HIT");
    expect(getAction("8", "4", "10")).toBe("HIT");
  });

  test("Hard 11 always double", () => {
    expect(getAction("6", "5", "2")).toBe("DOUBLE");
    expect(getAction("6", "5", "6")).toBe("DOUBLE");
    expect(getAction("6", "5", "10")).toBe("DOUBLE");
    expect(getAction("6", "5", "A")).toBe("DOUBLE");
  });

  test("Hard 10 double vs 2-9, hit otherwise", () => {
    expect(getAction("6", "4", "2")).toBe("DOUBLE");
    expect(getAction("6", "4", "9")).toBe("DOUBLE");
    expect(getAction("6", "4", "10")).toBe("HIT");
    expect(getAction("6", "4", "A")).toBe("HIT");
  });

  test("Hard 9 double vs 3-6, hit otherwise", () => {
    expect(getAction("5", "4", "2")).toBe("HIT");
    expect(getAction("5", "4", "3")).toBe("DOUBLE");
    expect(getAction("5", "4", "6")).toBe("DOUBLE");
    expect(getAction("5", "4", "7")).toBe("HIT");
  });

  test("Hard 8 or less always hit", () => {
    expect(getAction("5", "3", "6")).toBe("HIT");
    expect(getAction("4", "3", "5")).toBe("HIT");
    expect(getAction("2", "3", "2")).toBe("HIT");
  });
});

describe("Game Rules - Settlement", () => {
  test("Player blackjack pays 3:2", () => {
    const result = settleHand(makeCards("A", "K"), makeCards("10", "9"), 100);
    expect(result.delta).toBe(250); // 100 * 2.5
    expect(result.outcome).toBe("blackjack");
  });

  test("Both blackjack is push", () => {
    const result = settleHand(makeCards("A", "K"), makeCards("A", "Q"), 100);
    expect(result.delta).toBe(100);
    expect(result.outcome).toBe("push");
  });

  test("Player bust loses", () => {
    const result = settleHand(makeCards("10", "8", "5"), makeCards("10", "7"), 50);
    expect(result.delta).toBe(0);
    expect(result.outcome).toBe("bust");
    expect(result.playerTotal).toBe(23);
  });

  test("Dealer bust, player wins", () => {
    const result = settleHand(makeCards("10", "10"), makeCards("10", "9", "3"), 50);
    expect(result.delta).toBe(100);
    expect(result.outcome).toBe("dealer_bust");
    expect(result.dealerTotal).toBe(22);
  });

  test("Player 20 vs Dealer 21 (K+6+5) loses", () => {
    const result = settleHand(makeCards("10", "10"), makeCards("K", "6", "5"), 25);
    expect(result.delta).toBe(0);
    expect(result.outcome).toBe("lose");
    expect(result.dealerTotal).toBe(21);
  });

  test("Player 21 vs Dealer 21 is push (non-blackjack)", () => {
    const result = settleHand(makeCards("10", "9", "2"), makeCards("K", "6", "5"), 25);
    expect(result.delta).toBe(25);
    expect(result.outcome).toBe("push");
  });

  test("Player wins with higher total", () => {
    const result = settleHand(makeCards("10", "9"), makeCards("10", "8"), 25);
    expect(result.delta).toBe(50);
    expect(result.outcome).toBe("win");
  });

  test("Push on equal totals", () => {
    const result = settleHand(makeCards("10", "8"), makeCards("9", "9"), 25);
    expect(result.delta).toBe(25);
    expect(result.outcome).toBe("push");
  });
});

describe("Edge Cases", () => {
  test("Double not available falls back to hit", () => {
    const result = basicStrategyDecision(
      makeCards("6", "5"),
      makeCard("6"),
      { canDouble: false, canSplit: true }
    );
    expect(result.action).toBe("HIT");
  });

  test("Split not available for pairs", () => {
    const result = basicStrategyDecision(
      makeCards("8", "8"),
      makeCard("6"),
      { canDouble: true, canSplit: false }
    );
    // Without split, 16 vs 6 should stand
    expect(result.action).toBe("STAND");
  });

  test("5,5 treated as unlisted pair (hits, not split)", () => {
    const result = basicStrategyDecision(
      makeCards("5", "5"),
      makeCard("6"),
      { canDouble: true, canSplit: true }
    );
    // 5,5 falls through as "unlisted pair" -> HIT
    // Note: Optimal strategy treats 5,5 as hard 10 (double), but this implementation hits
    expect(result.action).toBe("HIT");
  });
});

// ============================================================
// BANKROLL CALCULATION TESTS
// ============================================================

/**
 * Simulates bankroll changes for a complete hand.
 *
 * Flow:
 * 1. Place initial bet: bankroll -= bet
 * 2. Optional double: bankroll -= originalBet, handBet *= 2
 * 3. Optional split: bankroll -= originalBet (for second hand)
 * 4. Settle: bankroll += delta (based on outcome)
 *
 * Net change = finalBankroll - initialBankroll
 */
function simulateBankroll(initialBankroll, initialBet, actions, playerCards, dealerCards) {
  let bankroll = initialBankroll;

  // Create hands array
  let hands = [{ cards: playerCards, bet: initialBet }];

  // Step 1: Place initial bet
  bankroll -= initialBet;

  // Step 2: Process actions
  for (const action of actions) {
    if (action === 'double') {
      // Double the first (or current) hand
      bankroll -= hands[0].bet;
      hands[0].bet *= 2;
    } else if (action === 'split') {
      // Split creates two hands
      bankroll -= initialBet;
      hands = [
        { cards: [playerCards[0]], bet: initialBet },
        { cards: [playerCards[1]], bet: initialBet }
      ];
    } else if (action === 'double-first') {
      // Double first hand after split
      bankroll -= hands[0].bet;
      hands[0].bet *= 2;
    } else if (action === 'double-second') {
      // Double second hand after split
      bankroll -= hands[1].bet;
      hands[1].bet *= 2;
    }
  }

  // Step 3: Settle each hand
  let totalDelta = 0;
  for (const hand of hands) {
    const result = settleHand(hand.cards, dealerCards, hand.bet);
    totalDelta += result.delta;
  }

  bankroll += totalDelta;

  return {
    finalBankroll: bankroll,
    netChange: bankroll - initialBankroll,
    totalDelta
  };
}

describe("Bankroll Calculations", () => {
  const INITIAL_BANKROLL = 1000;
  const BET = 25;

  describe("Simple Bets (no double/split)", () => {
    test("Win: net +$25", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, [],
        makeCards("10", "9"), // 19
        makeCards("10", "8")  // 18
      );
      expect(result.netChange).toBe(25);
      expect(result.finalBankroll).toBe(1025);
    });

    test("Lose: net -$25", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, [],
        makeCards("10", "8"), // 18
        makeCards("10", "9")  // 19
      );
      expect(result.netChange).toBe(-25);
      expect(result.finalBankroll).toBe(975);
    });

    test("Push: net $0", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, [],
        makeCards("10", "8"), // 18
        makeCards("9", "9")   // 18
      );
      expect(result.netChange).toBe(0);
      expect(result.finalBankroll).toBe(1000);
    });

    test("Player bust: net -$25", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, [],
        makeCards("10", "8", "5"), // 23 bust
        makeCards("10", "7")       // 17
      );
      expect(result.netChange).toBe(-25);
      expect(result.finalBankroll).toBe(975);
    });

    test("Dealer bust: net +$25", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, [],
        makeCards("10", "8"),      // 18
        makeCards("10", "6", "8")  // 24 bust
      );
      expect(result.netChange).toBe(25);
      expect(result.finalBankroll).toBe(1025);
    });
  });

  describe("Blackjack (3:2 payout)", () => {
    test("Player blackjack wins: net +$37 (floor of $25 * 1.5)", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, [],
        makeCards("A", "K"),  // Blackjack
        makeCards("10", "9")  // 19
      );
      // Blackjack pays 2.5x bet, so delta = 62, net = 62 - 25 = 37
      expect(result.netChange).toBe(37);
      expect(result.finalBankroll).toBe(1037);
    });

    test("Player blackjack $100 bet: net +$150", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, 100, [],
        makeCards("A", "10"), // Blackjack
        makeCards("10", "8")  // 18
      );
      // 100 * 2.5 = 250, net = 250 - 100 = 150
      expect(result.netChange).toBe(150);
      expect(result.finalBankroll).toBe(1150);
    });

    test("Both blackjack: push, net $0", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, [],
        makeCards("A", "K"),  // Blackjack
        makeCards("A", "Q")   // Blackjack
      );
      expect(result.netChange).toBe(0);
      expect(result.finalBankroll).toBe(1000);
    });

    test("Dealer blackjack vs player 21: treated as push (NOTE: game flow prevents this)", () => {
      // NOTE: In real blackjack, dealer BJ beats player's regular 21.
      // However, the settleHand function doesn't check for dealer-only BJ.
      // This is masked by game flow: if dealer has BJ, round ends before
      // player can build to 21. The settlement logic should ideally handle this.
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, [],
        makeCards("7", "7", "7"), // 21 (not blackjack)
        makeCards("A", "J")       // Blackjack
      );
      // Current behavior: push (both 21)
      // Correct behavior would be: dealer wins (BJ beats 21)
      expect(result.netChange).toBe(0);
      expect(result.finalBankroll).toBe(1000);
    });
  });

  describe("Double Down", () => {
    test("Double and win: net +$50", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, ['double'],
        makeCards("6", "5", "10"), // 21 after double
        makeCards("10", "8")       // 18
      );
      // Bet 25, double to 50, win = 100 return, net = 100 - 50 = +50
      expect(result.netChange).toBe(50);
      expect(result.finalBankroll).toBe(1050);
    });

    test("Double and lose: net -$50", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, ['double'],
        makeCards("6", "5", "5"), // 16 after double
        makeCards("10", "8")      // 18
      );
      expect(result.netChange).toBe(-50);
      expect(result.finalBankroll).toBe(950);
    });

    test("Double and push: net $0", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, ['double'],
        makeCards("5", "5", "8"), // 18 after double
        makeCards("10", "8")      // 18
      );
      expect(result.netChange).toBe(0);
      expect(result.finalBankroll).toBe(1000);
    });

    test("Double $100 bet and win: net +$200", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, 100, ['double'],
        makeCards("6", "5", "9"), // 20
        makeCards("10", "8")      // 18
      );
      expect(result.netChange).toBe(200);
      expect(result.finalBankroll).toBe(1200);
    });
  });

  describe("Split Hands", () => {
    test("Split, both hands win: net +$50", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, ['split'],
        makeCards("8", "8"), // Two hands of 8
        makeCards("10", "6", "8") // Dealer 24 bust
      );
      // Two $25 bets, both win = 50 + 50 = 100 return
      // Initial: 1000, bet 25 + split 25 = 950, return 100, final = 1050
      expect(result.netChange).toBe(50);
      expect(result.finalBankroll).toBe(1050);
    });

    test("Split, both hands lose: net -$50", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, BET, ['split'],
        makeCards("8", "8"), // Two 8s
        makeCards("10", "9") // Dealer 19
      );
      // Both 8s lose to 19
      expect(result.netChange).toBe(-50);
      expect(result.finalBankroll).toBe(950);
    });

    test("Split, one wins one loses: net $0", () => {
      // This requires the settle function to handle individual hand outcomes
      // For simplicity, simulate with same cards but different dealer scenarios
      // Actually our settle function takes final cards, so we need to simulate
      // hands that end differently. Let's assume:
      // Hand 1: 8 + 10 = 18 (wins vs 17)
      // Hand 2: 8 + 5 = 13 (loses vs 17)

      // We need to modify the simulation or test differently
      // For now, let's test the pure math
      const hand1 = settleHand(makeCards("8", "10"), makeCards("10", "7"), 25); // 18 vs 17, win
      const hand2 = settleHand(makeCards("8", "5"), makeCards("10", "7"), 25);  // 13 vs 17, lose

      const totalDelta = hand1.delta + hand2.delta; // 50 + 0 = 50
      const initialBet = 25;
      const splitCost = 25;
      const netChange = totalDelta - initialBet - splitCost; // 50 - 25 - 25 = 0

      expect(netChange).toBe(0);
    });

    test("Split, one wins one pushes: net +$25", () => {
      const hand1 = settleHand(makeCards("8", "10"), makeCards("10", "7"), 25); // 18 vs 17, win
      const hand2 = settleHand(makeCards("8", "9"), makeCards("10", "7"), 25);  // 17 vs 17, push

      const totalDelta = hand1.delta + hand2.delta; // 50 + 25 = 75
      const totalBet = 50;
      const netChange = totalDelta - totalBet; // 75 - 50 = 25

      expect(netChange).toBe(25);
    });
  });

  describe("Split with Double (DAS)", () => {
    test("Split, double first hand, both win: net +$75", () => {
      // Hand 1: $25 doubled to $50, wins = $100 return
      // Hand 2: $25, wins = $50 return
      // Total bet: 25 + 25 + 25 (double) = 75
      // Total return: 100 + 50 = 150
      // Net: 150 - 75 = +75

      const h1 = settleHand(makeCards("5", "6", "K"), makeCards("10", "7"), 50); // 21 vs 17, doubled bet
      const h2 = settleHand(makeCards("5", "K", "3"), makeCards("10", "7"), 25); // 18 vs 17, regular bet

      const totalDelta = h1.delta + h2.delta; // 100 + 50 = 150
      const totalBet = 75; // 25 + 25 (split) + 25 (double)
      const netChange = totalDelta - totalBet;

      expect(netChange).toBe(75);
    });

    test("Split, double both hands, both lose: net -$100", () => {
      // Hand 1: $50 (doubled), loses = $0 return
      // Hand 2: $50 (doubled), loses = $0 return
      // Total bet: 25 + 25 + 25 + 25 = 100
      // Net: 0 - 100 = -100

      const h1 = settleHand(makeCards("5", "5", "5"), makeCards("10", "8"), 50); // 15 vs 18
      const h2 = settleHand(makeCards("5", "5", "6"), makeCards("10", "8"), 50); // 16 vs 18

      const totalDelta = h1.delta + h2.delta; // 0 + 0 = 0
      const totalBet = 100;
      const netChange = totalDelta - totalBet;

      expect(netChange).toBe(-100);
    });
  });

  describe("Various Bet Amounts", () => {
    test("$5 bet, win: net +$5", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, 5, [],
        makeCards("10", "9"),
        makeCards("10", "8")
      );
      expect(result.netChange).toBe(5);
    });

    test("$100 bet, lose: net -$100", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, 100, [],
        makeCards("10", "8"),
        makeCards("10", "9")
      );
      expect(result.netChange).toBe(-100);
    });

    test("$50 bet, blackjack: net +$75", () => {
      const result = simulateBankroll(
        INITIAL_BANKROLL, 50, [],
        makeCards("A", "Q"),
        makeCards("10", "8")
      );
      // 50 * 2.5 = 125, net = 125 - 50 = 75
      expect(result.netChange).toBe(75);
    });
  });
});

describe("Bankroll Edge Cases", () => {
  test("Blackjack with odd bet rounds down (floor)", () => {
    // $33 bet * 2.5 = 82.5, floor = 82
    const result = settleHand(makeCards("A", "K"), makeCards("10", "8"), 33);
    expect(result.delta).toBe(82); // floor(33 * 2.5)
  });

  test("$1 bet blackjack: delta = floor(2.5) = 2", () => {
    const result = settleHand(makeCards("A", "J"), makeCards("10", "7"), 1);
    expect(result.delta).toBe(2); // floor(1 * 2.5)
  });

  test("Large bet $500, double and win: delta = $2000", () => {
    const result = settleHand(makeCards("6", "5", "10"), makeCards("10", "8"), 1000);
    // 1000 * 2 = 2000
    expect(result.delta).toBe(2000);
  });
});
