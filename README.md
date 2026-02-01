# Blackjack Trainer

A React-based blackjack training app focused on teaching basic strategy for soft hands, hard hands, and pair splits.

## Features

- **Practice Modes**: Toggle which hand types to practice (hard/soft/pairs) via the settings panel
- **Betting System**: Bankroll tracking with visual feedback
- **Auto-Deal**: Option for continuous practice sessions
- **Strategy Feedback**: Instant feedback showing correct/incorrect moves
- **Sound Effects**: Audio cues for dealing, flipping, and winning
- **Animations**: Smooth card dealing and flipping with Framer Motion
- **Hint System**: Get strategy hints when you're unsure

## Game Rules

This trainer uses standard casino rules:

- **S17**: Dealer stands on soft 17
- **DAS**: Double After Split allowed
- **Blackjack pays 3:2**
- **6-deck shoe**
- **Split Aces**: Receive one card only
- **No Surrender**

## Basic Strategy Reference

### Pairs
- Always split A,A and 8,8
- Never split 10-value pairs (10, J, Q, K)
- 9,9: Split vs 2-9 except 7
- 7,7: Split vs 2-7
- 6,6: Split vs 2-6
- 4,4: Split vs 5-6
- 3,3 & 2,2: Split vs 2-7

### Soft Hands
- A,2-A,3: Double vs 5-6, else hit
- A,4-A,5: Double vs 4-6, else hit
- A,6: Double vs 3-6, else hit
- A,7: Double vs 3-6; stand vs 2,7,8; hit vs 9,10,A
- A,8+: Stand

### Hard Hands
- 17+: Stand
- 13-16: Stand vs 2-6, else hit
- 12: Stand vs 4-6, else hit
- 11: Always double
- 10: Double vs 2-9, else hit
- 9: Double vs 3-6, else hit
- 8 or less: Hit

## Tech Stack

- React (hooks-based)
- Tailwind CSS
- Framer Motion
- lucide-react

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Import and use the `BlackjackTrainer` component in your React app

## Testing

```bash
npm test
```

Test coverage includes utility functions, hand classification, blackjack detection, basic strategy decisions, and settlement logic.

## License

MIT
