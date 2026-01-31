# CLAUDE.md

## Project Overview

Blackjack training app focused on teaching basic strategy for soft hands, hard hands, and pair splits. Built as standalone React components.

## Key Files

- `blackjack_trainer.jsx` - Full-featured trainer with betting, animations, and sound effects
- `soft_splits_blackjack_trainer_web_app.jsx` - Alternative trainer implementation

## Tech Stack

- React (hooks-based)
- Tailwind CSS for styling
- Framer Motion for animations
- lucide-react for icons

## Game Rules (S17, DAS, No Surrender)

- Dealer stands on soft 17 (S17)
- Double After Split allowed (DAS)
- Blackjack pays 3:2
- Split Aces receive one card only
- 6-deck shoe

## Basic Strategy Rules

**Pairs:**
- Always split A,A and 8,8
- Never split 10-value pairs
- 9,9: split vs 2-9 except 7
- 7,7: split vs 2-7
- 6,6: split vs 2-6
- 4,4: split vs 5-6
- 3,3 & 2,2: split vs 2-7

**Soft Hands:**
- A,2-A,3: double vs 5-6, else hit
- A,4-A,5: double vs 4-6, else hit
- A,6: double vs 3-6, else hit
- A,7: double vs 3-6; stand vs 2,7,8; hit vs 9,10,A
- A,8+: stand

**Hard Hands:**
- 17+: stand
- 13-16: stand vs 2-6, else hit
- 12: stand vs 4-6, else hit
- 11: always double
- 10: double vs 2-9, else hit
- 9: double vs 3-6, else hit
- 8 or less: hit

## Running the App

These are standalone JSX components. To use:

1. Create a React app with required dependencies:
   ```bash
   npm install react framer-motion lucide-react
   ```

2. Import and use the `BlackjackTrainer` component

## Code Patterns

- Uses 6-deck shoe with Fisher-Yates shuffle
- Hand classification: hard/soft/pairs
- Card values: A=11 (or 1), J/Q/K/10=10, others=face value
- Hole card hidden until dealer's turn with flip animation