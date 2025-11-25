# Play Ahead Feature - Implementation Guide

## 🎯 Project Goal

Add a "play ahead" feature to the Showdex Pokemon Showdown battle calculator extension that allows users to:

1. **Select moves** for both the player and opponent
2. **Simulate turn execution** with accurate damage calculations
3. **See the resulting game state** (HP, status, boosts, field conditions)
4. **Chain multiple turns** to "play ahead" and explore future battle states
5. **Make informed decisions** by testing different move combinations

### Key Requirements

- **Inline UI**: Display simulation controls and results directly in the battle view (Option B - not a separate modal)
- **Opponent move selection**: Via dropdown in the opponent's move section
- **Multi-turn chaining**: Users can advance to the next turn and continue simulating
- **Temporary state**: Simulations are discarded on reset (not persisted)
- **Singles only**: Focus on 1v1 battles initially (Doubles support can be added later)
- **Edge case handling**: User selects outcomes for random effects, switch-ins, etc.
- **Minimal code changes**: Reuse existing systems wherever possible

---

## 📁 Project Structure

### Files Created

#### **Type Definitions**
- `src/interfaces/calc/PlayAheadState.ts` (282 lines)
  - `PlayAheadState` - Main simulation state structure
  - `PlayAheadMoveResult` - Individual move execution results
  - `PlayAheadPendingDecision` - Edge case handling structure

#### **Redux State Management**
- `src/redux/store/playAheadSlice.ts` (325 lines)
  - Complete Redux Toolkit slice
  - 8 reducers for simulation control
  - Integrated into main store via `createStore.ts`

#### **Core Simulation Engine**
- `src/utils/playahead/determineMoveOrder.ts` (175 lines)
  - Calculates which Pokemon moves first
  - Handles priority, speed, Trick Room, speed ties

- `src/utils/playahead/applyMoveEffects.ts` (275 lines)
  - Applies move effects to battle state
  - Handles damage, recoil, drain, faints
  - Extensible for stat changes, status, field effects

- `src/utils/playahead/simulateTurn.ts` (243 lines)
  - Orchestrates complete turn execution
  - Uses existing `calcSmogonMatchup` for damage
  - Handles KOs and turn interruption

- `src/utils/playahead/index.ts` (3 lines)
  - Export barrel for utilities

#### **React Integration**
- `src/components/calc/PlayAhead/PlayAheadContext.ts` (25 lines)
  - React Context definition

- `src/components/calc/PlayAhead/PlayAheadProvider.tsx` (44 lines)
  - Provider component connecting Redux to Context

- `src/components/calc/PlayAhead/usePlayAheadContext.ts` (306 lines)
  - Hook with 8 dispatch functions
  - Computed properties for UI state

- `src/components/calc/PlayAhead/index.ts` (3 lines)
  - Export barrel for components

#### **Modified Files**
- `src/interfaces/calc/index.ts` - Added PlayAheadState export
- `src/redux/store/index.ts` - Added playAheadSlice export
- `src/redux/store/createStore.ts` - Integrated playAhead reducer into store

---

## 🏗️ Architecture Overview

### State Management Flow

```
User Action (UI)
    ↓
usePlayAheadContext Hook
    ↓
Redux Action Dispatch (playAheadSlice)
    ↓
Redux State Update
    ↓
PlayAheadProvider (re-renders)
    ↓
UI Components (reflect new state)
```

### Simulation Execution Flow

```
1. User selects player move → setPlayerMove()
2. User selects opponent move → setOpponentMove()
3. User clicks "Execute Turn" → executeSimulation()
    ↓
4. simulateTurn() is called:
    a. determineMoveOrder() → calculates priority & speed
    b. calcSmogonMatchup() → calculates damage for first move
    c. applyMoveEffects() → applies damage, recoil, drain to state
    d. Check if target fainted → if yes, skip second move
    e. calcSmogonMatchup() → calculates damage for second move
    f. applyMoveEffects() → applies second move effects
    ↓
5. Redux state updated with:
    - New simulated battle state (HP, status, boosts)
    - Turn results (damage, KOs, descriptions)
    ↓
6. UI displays results
7. User can "Advance Turn" to continue or "Reset" to discard
```

### Key Design Decisions

#### ✅ **State Cloning**
- All simulations work on **cloned** battle state via `cloneBattleState()`
- Original live battle state is never mutated
- Allows easy reset/discard of simulation

#### ✅ **Reusing Existing Systems**
- Uses existing `calcSmogonMatchup()` for damage calculation
- Uses existing `calcPokemonFinalStats()` for speed calculation
- Uses existing `cloneBattleState()` and `clonePokemon()` utilities
- Minimal new code, maximum compatibility

#### ✅ **Redux-First Architecture**
- All simulation state stored in Redux (not local component state)
- Enables future features (undo/redo, simulation history, etc.)
- Follows existing Showdex patterns (`calcdexSlice`, `hellodexSlice`, etc.)

#### ✅ **Context for React Integration**
- `PlayAheadProvider` wraps components that need simulation access
- `usePlayAheadContext()` hook provides dispatch functions
- Clean separation between state management (Redux) and UI (React)

---

## 🔧 Implementation Details

### Redux Slice Structure

```typescript
// src/redux/store/playAheadSlice.ts

type PlayAheadSliceState = Record<string, PlayAheadState>;
// Key = battleId, Value = simulation state for that battle

interface PlayAheadState {
  battleId: string;
  active: boolean;                          // Simulation mode on/off
  simulatedTurns: number;                   // How many turns ahead
  playerMove: MoveName | null;              // Selected player move
  opponentMove: MoveName | null;            // Selected opponent move
  simulatedBattleState: CalcdexBattleState; // Cloned & modified state
  turnResults: PlayAheadMoveResult[];       // Latest turn results
  pendingDecisions: PlayAheadPendingDecision[]; // Edge cases needing user input
  turnHistory: Array<{...}>;                // History of all simulated turns
  errors: string[];                         // Any errors
}
```

### Reducers

1. **`initSimulation(battleId, battleState)`**
   - Clones current battle state as simulation starting point
   - Sets `active = true`
   - Resets turn counter to 0

2. **`setPlayerMove(battleId, move)`**
   - Sets `playerMove` for current turn

3. **`setOpponentMove(battleId, move)`**
   - Sets `opponentMove` for current turn

4. **`updateSimulatedState(battleId, simulatedBattleState, turnResults)`**
   - Updates simulated state after turn execution
   - Called by `executeSimulation()`

5. **`addPendingDecision(battleId, decision)`**
   - Adds edge case requiring user input (e.g., "Which Pokemon to switch to?")

6. **`resolvePendingDecision(battleId, decisionIndex, resolution)`**
   - Resolves pending decision and removes from queue

7. **`advanceTurn(battleId)`**
   - Increments turn counter
   - Clears move selections
   - Adds current turn to history

8. **`resetSimulation(battleId)`**
   - Deletes simulation state entirely
   - Returns to live battle state

### Core Utilities

#### **`determineMoveOrder()`**
**Location:** `src/utils/playahead/determineMoveOrder.ts`

**Purpose:** Calculates which Pokemon moves first

**Algorithm:**
1. Get move priorities from dex (`move.priority`, range -7 to +5)
2. If priorities differ → higher priority moves first
3. If priorities equal → compare speeds:
   - Calculate effective speed using `calcPokemonFinalStats()`
   - If Trick Room active → slower Pokemon moves first
   - If speeds equal → random 50/50 (Math.random())
4. Return `MoveOrderInfo` with move order and reasoning

**Returns:**
```typescript
{
  firstPlayerKey: 'p1',
  secondPlayerKey: 'p2',
  firstMove: 'Earthquake',
  secondMove: 'Ice Beam',
  firstPriority: 0,
  secondPriority: 0,
  firstSpeed: 328,
  secondSpeed: 299,
  reason: 'speed' // or 'priority', 'trick-room', 'random'
}
```

#### **`applyMoveEffects()`**
**Location:** `src/utils/playahead/applyMoveEffects.ts`

**Purpose:** Applies a move's effects to the battle state

**Current Implementation:**
- ✅ Damage application (from `matchupResult.damageRange`)
- ✅ HP updates (clamped to 0-maxhp)
- ✅ Faint detection (target & user)
- ✅ Recoil damage (e.g., Brave Bird: 1/3 damage taken)
- ✅ Drain moves (e.g., Giga Drain: 1/2 damage healed)
- ✅ Descriptive output for UI

**TODO (extensible):**
- ⏳ Stat changes (boosts/drops)
- ⏳ Status conditions (burn, paralysis, etc.)
- ⏳ Field effects (weather, terrain, screens, hazards)
- ⏳ Multi-hit moves
- ⏳ Secondary effects (flinch, burn chance, etc.)

**Returns:**
```typescript
{
  battleState: CalcdexBattleState,  // Updated state
  targetFainted: boolean,
  userFainted: boolean,
  description: string,              // e.g., "Charizard used Flare Blitz! It dealt 87 damage."
  errors: string[]
}
```

#### **`simulateTurn()`**
**Location:** `src/utils/playahead/simulateTurn.ts`

**Purpose:** Orchestrates a complete turn with both players' moves

**Algorithm:**
1. Clone battle state (avoid mutation)
2. Get active Pokemon for both players
3. Call `determineMoveOrder()` to find who moves first
4. Execute first move:
   - Call `calcSmogonMatchup()` for damage calculation
   - Call `applyMoveEffects()` to apply damage, recoil, drain
   - If target fainted → skip second move
5. Execute second move (if first didn't cause KO):
   - Call `calcSmogonMatchup()` for damage calculation
   - Call `applyMoveEffects()` to apply effects
6. Return updated battle state and move results

**Returns:**
```typescript
{
  battleState: CalcdexBattleState,    // Final state after both moves
  moveResults: PlayAheadMoveResult[], // Details for each move (usually 2, or 1 if KO)
  errors: string[]
}
```

---

## 🎨 UI Components (To Be Implemented)

### Component Hierarchy

```
<Calcdex>                          {/* Main calculator component */}
  <PlayAheadProvider battleId={battleId}>  {/* Provides simulation state */}
    <CalcdexProvider>              {/* Existing context */}
      <FieldCalc />                {/* Weather, terrain, side conditions */}

      {/* Player 1 */}
      <PlayerCalc playerKey="p1">
        <PokeInfo />               {/* Name, HP bar (needs simulated HP overlay) */}
        <PokeMoves />              {/* Move selection (already exists) */}
        <PokeStats />              {/* Stats display */}
      </PlayerCalc>

      {/* Player 2 (Opponent) */}
      <PlayerCalc playerKey="p2">
        <PokeInfo />               {/* Name, HP bar (needs simulated HP overlay) */}
        <PokeMoves />              {/* NEEDS: Opponent move selection dropdown */}
        <PokeStats />              {/* Stats display */}
      </PlayerCalc>

      {/* NEW: Simulation Controls */}
      <PlayAheadControls />        {/* Enable, Execute, Advance, Reset buttons */}

      {/* NEW: Simulation Results Display */}
      <SimulationResult />         {/* Shows turn outcomes, move order, damage */}
    </CalcdexProvider>
  </PlayAheadProvider>
</Calcdex>
```

### Components to Create

#### 1. **`PlayAheadControls.tsx`**
**Purpose:** Main control panel for simulation

**UI Elements:**
- **Toggle Button:** "Enable Simulation Mode" / "Disable Simulation Mode"
  - When off: hides all simulation UI
  - When on: shows move selection and execute button

- **Execute Button:** "Simulate Turn"
  - Disabled until both moves selected
  - Calls `executeSimulation()`

- **Advance Button:** "Next Turn >"
  - Visible after simulation executed
  - Calls `advanceTurn()`

- **Reset Button:** "Cancel Simulation"
  - Discards all simulated changes
  - Returns to live state

- **Turn Counter:** "Turn +2" (shows how many turns ahead)

**Location:** Below field conditions, above Pokemon displays

#### 2. **`SimulationResult.tsx`**
**Purpose:** Display turn execution results

**UI Elements:**
- **Move Order:**
  - "Garchomp moves first (faster)"
  - "Landorus-Therian moves second"

- **Damage Display:**
  - "Garchomp's Earthquake: 82-97 (guaranteed 2HKO)"
  - "Landorus-Therian's Ice Beam: 287-338 (OHKO)"

- **HP Changes:**
  - Visual HP bars showing before/after
  - Percentage changes

- **Status/Field Updates:**
  - "Stealth Rock was set on Garchomp's side"
  - "Landorus-Therian was burned"

**Location:** Between the two PlayerCalc components

#### 3. **Modify `PokeMoves.tsx`**
**Purpose:** Add opponent move selection dropdown

**Changes Needed:**
- Check if simulation mode is active via `usePlayAheadContext()`
- If active AND this is opponent's Pokemon:
  - Show dropdown with opponent's 4 moves
  - Highlight selected move
  - Call `setOpponentMove()` on selection change

**Implementation Approach:**
```tsx
const { isActive, state, setOpponentMove } = usePlayAheadContext();
const isOpponent = pokemon.playerKey === opponentKey;

// In render:
{isActive && isOpponent && (
  <div className="opponent-move-selector">
    <label>Select opponent's move:</label>
    <select
      value={state?.opponentMove || ''}
      onChange={(e) => setOpponentMove(e.target.value)}
    >
      <option value="">-- Choose move --</option>
      {pokemon.moves.map(move => (
        <option key={move} value={move}>{move}</option>
      ))}
    </select>
  </div>
)}
```

#### 4. **Modify `PokeInfo.tsx`**
**Purpose:** Show simulated HP alongside current HP

**Changes Needed:**
- Check if simulation mode is active
- If active, get simulated Pokemon from `state.simulatedBattleState`
- Display simulated HP with different styling:
  - Semi-transparent overlay on HP bar
  - Different color (e.g., blue tint for simulated)
  - Tooltip: "Simulated HP (after 2 turns)"

**Implementation Approach:**
```tsx
const { isActive, state } = usePlayAheadContext();

const currentHp = pokemon.hp;
const simulatedHp = isActive
  ? state?.simulatedBattleState?.[playerKey]?.pokemon?.[pokemonIndex]?.hp
  : null;

// In render:
<div className="hp-bar-container">
  <HPBar current={currentHp} max={maxhp} />
  {simulatedHp != null && (
    <HPBar
      current={simulatedHp}
      max={maxhp}
      className="simulated-hp-overlay"
      title={`Simulated HP: ${simulatedHp}/${maxhp}`}
    />
  )}
</div>
```

#### 5. **Visual Indicators**
**Purpose:** Clear distinction between live and simulated state

**Style Guidelines:**
- **Simulated HP bars:** Blue/purple tint, semi-transparent
- **Simulated stats:** Lighter background, italicized
- **Simulation mode banner:** Top of Calcdex, "⚠️ Simulation Mode Active"
- **Active state border:** Subtle glow/border around simulated sections

---

## ✅ What's Complete

### Core Infrastructure (100%)
- ✅ Type definitions (`PlayAheadState`, `PlayAheadMoveResult`, `PlayAheadPendingDecision`)
- ✅ Redux slice with 8 reducers
- ✅ Redux integration into main store
- ✅ React Context (`PlayAheadContext`, `PlayAheadProvider`)
- ✅ Context hook (`usePlayAheadContext`) with dispatch functions
- ✅ State cloning utilities (reusing existing `cloneBattleState()`)

### Simulation Engine (75%)
- ✅ Move order determination (priority, speed, Trick Room, speed ties)
- ✅ Damage calculation (reusing `calcSmogonMatchup()`)
- ✅ Basic effect application (damage, recoil, drain)
- ✅ Faint detection and turn interruption
- ✅ Turn orchestration (`simulateTurn()`)
- ⏳ Advanced effects (stat changes, status, field effects) - TODO
- ⏳ Edge case handling (U-turn, random effects, Focus Sash) - TODO

---

## 📋 What Still Needs to Be Done

### Phase 1: UI Components (High Priority)

#### **A. PlayAheadControls Component**
**File:** `src/components/calc/PlayAhead/PlayAheadControls.tsx`

**Tasks:**
1. Create component with 4 buttons:
   - Enable/Disable Simulation toggle
   - Execute Turn button (disabled until both moves selected)
   - Advance Turn button (visible after execution)
   - Reset Simulation button
2. Display turn counter ("Turn +N")
3. Hook up to `usePlayAheadContext()` dispatch functions
4. Style to match existing Showdex UI
5. Add to Calcdex layout (above or below field conditions)

**Estimated Complexity:** Medium (150-200 lines)

#### **B. SimulationResult Component**
**File:** `src/components/calc/PlayAhead/SimulationResult.tsx`

**Tasks:**
1. Display move order with reasoning
2. Show damage dealt for each move
3. Display HP changes (before → after)
4. Highlight KOs
5. Show any status/field changes
6. Make collapsible/expandable for space efficiency
7. Style to match existing Showdex UI

**Estimated Complexity:** Medium (200-250 lines)

#### **C. Modify PokeMoves Component**
**File:** `src/components/calc/PokeMoves/PokeMoves.tsx`

**Tasks:**
1. Import `usePlayAheadContext()`
2. Detect if this is opponent's Pokemon
3. If simulation active + opponent → show move selector dropdown
4. Highlight selected opponent move
5. Update styling to accommodate new dropdown
6. Ensure doesn't interfere with existing functionality

**Estimated Complexity:** Small (20-30 lines added)

#### **D. Modify PokeInfo Component**
**File:** `src/components/calc/PokeInfo/PokeInfo.tsx`

**Tasks:**
1. Import `usePlayAheadContext()`
2. Get simulated Pokemon HP from `state.simulatedBattleState`
3. Render simulated HP bar overlay (if simulation active)
4. Style simulated HP differently (color, opacity)
5. Add tooltip showing simulated vs current HP
6. Optionally show simulated status/boosts

**Estimated Complexity:** Small-Medium (30-50 lines added)

#### **E. Visual Styling**
**File:** `src/components/calc/PlayAhead/PlayAhead.scss` (new file)

**Tasks:**
1. Create styles for simulation mode banner
2. Style simulated HP bars (semi-transparent, blue tint)
3. Style PlayAheadControls buttons
4. Style SimulationResult display
5. Add transitions/animations for smooth UX
6. Ensure responsive design

**Estimated Complexity:** Medium (100-150 lines of SCSS)

---

### Phase 2: Integration (Medium Priority)

#### **F. Integrate PlayAheadProvider**
**File:** `src/pages/Calcdex/CalcdexProvider.tsx` or similar

**Tasks:**
1. Wrap Calcdex components with `<PlayAheadProvider battleId={battleId}>`
2. Ensure provider is above components that need simulation access
3. Pass `battleId` correctly
4. Test provider re-renders on state changes

**Estimated Complexity:** Small (5-10 lines)

#### **G. Add PlayAheadControls to Layout**
**File:** `src/pages/Calcdex/Calcdex.tsx` or main layout file

**Tasks:**
1. Import `PlayAheadControls`
2. Add to Calcdex JSX (decide placement)
3. Test layout doesn't break
4. Ensure controls are visible and accessible

**Estimated Complexity:** Small (5-10 lines)

#### **H. Pause Battle Sync During Simulation**
**File:** `src/redux/actions/syncBattle.ts` or bootstrap file

**Tasks:**
1. Check if simulation is active before syncing
2. If simulation active → skip sync (or queue it)
3. When simulation ends → resume sync
4. Ensure no state conflicts between live and simulated

**Estimated Complexity:** Medium (20-30 lines)

---

### Phase 3: Advanced Move Effects (Medium Priority)

#### **I. Stat Boost/Drop Moves**
**File:** `src/utils/playahead/applyMoveEffects.ts`

**Tasks:**
1. Get move data from dex (`dex.moves.get(move)`)
2. Check for `move.boosts` property (e.g., Swords Dance: `{atk: 2}`)
3. Apply boosts to Pokemon's `boosts` property
4. Clamp boosts to -6 to +6
5. Update descriptions ("Garchomp's Attack rose by 2 stages!")

**Examples:**
- Swords Dance: `{atk: 2}`
- Dragon Dance: `{atk: 1, spe: 1}`
- Intimidate: `{atk: -1}` (on switch-in, not implemented yet)

**Estimated Complexity:** Small (30-40 lines)

#### **J. Status Condition Moves**
**File:** `src/utils/playahead/applyMoveEffects.ts`

**Tasks:**
1. Check for `move.status` property (e.g., Thunder Wave: `'par'`)
2. Apply status to target Pokemon's `status` property
3. Handle immunities (e.g., Electric types can't be paralyzed)
4. Handle already-statused Pokemon (can't be statused again)
5. Update descriptions ("Landorus was paralyzed!")

**Examples:**
- Thunder Wave: `status: 'par'`
- Will-O-Wisp: `status: 'brn'`
- Toxic: `status: 'tox'` (badly poisoned)

**Estimated Complexity:** Medium (40-60 lines)

#### **K. Field Effect Moves**
**File:** `src/utils/playahead/applyMoveEffects.ts`

**Tasks:**
1. Check for `move.weather`, `move.terrain`, etc.
2. Update `battleState.field` accordingly
3. Handle screens (Reflect, Light Screen) → update `playerSide.screens`
4. Handle hazards (Stealth Rock, Spikes) → update `playerSide.hazards`
5. Update descriptions ("Rain began to fall!")

**Examples:**
- Rain Dance: `weather: 'Rain'`
- Electric Terrain: `terrain: 'Electric'`
- Stealth Rock: `hazards: {stealthrock: true}`
- Reflect: `screens: {reflect: 5}` (5 turns remaining)

**Estimated Complexity:** Medium (50-70 lines)

---

### Phase 4: Edge Case Handlers (Lower Priority)

#### **L. U-turn / Volt Switch (Switch-Out Moves)**
**File:** `src/utils/playahead/applyMoveEffects.ts`

**Tasks:**
1. Detect if move has `move.selfSwitch` property
2. After damage, create `PlayAheadPendingDecision`:
   - Type: `'switch-in'`
   - Metadata: `availablePokemonIndices` (non-fainted Pokemon)
   - Description: "Which Pokemon does the opponent switch to?"
3. Pause simulation until decision resolved
4. When resolved: update `activeIndices` to switched Pokemon
5. Apply switch-in damage from hazards (Stealth Rock, Spikes)

**Estimated Complexity:** Medium-High (60-80 lines)

#### **M. Random Secondary Effects**
**File:** `src/utils/playahead/applyMoveEffects.ts`

**Tasks:**
1. Check for `move.secondary` property (e.g., Scald: `{chance: 30, status: 'brn'}`)
2. Create `PlayAheadPendingDecision`:
   - Type: `'random-effect'`
   - Metadata: `{probability: 0.3, effectName: 'burn'}`
   - Description: "Does Scald burn the opponent? (30% chance)"
3. Pause simulation for user input
4. When resolved: apply effect if user says yes

**Examples:**
- Scald: 30% burn chance
- Iron Head: 30% flinch chance
- Thunder: 30% paralysis chance

**Estimated Complexity:** Medium (50-60 lines)

#### **N. Focus Sash / Sturdy**
**File:** `src/utils/playahead/applyMoveEffects.ts`

**Tasks:**
1. After calculating damage, check if Pokemon would faint
2. Check if Pokemon has Focus Sash or Sturdy ability
3. If at full HP and would faint from full → create decision:
   - Type: `'focus-sash'`
   - Description: "Does Focus Sash activate? (Pokemon survives at 1 HP)"
4. When resolved: set HP to 1 if user says yes

**Estimated Complexity:** Small-Medium (30-40 lines)

#### **O. Multi-Hit Moves**
**File:** `src/utils/playahead/applyMoveEffects.ts`

**Tasks:**
1. Check for `move.multihit` property (e.g., Bullet Seed: `[2, 5]`)
2. Create decision:
   - Type: `'multi-hit'`
   - Metadata: `{hitRange: [2, 5]}`
   - Description: "How many times does Bullet Seed hit? (2-5)"
3. When resolved: multiply damage by hit count

**Examples:**
- Bullet Seed: 2-5 hits
- Double Kick: Always 2 hits
- Population Bomb: 1-10 hits

**Estimated Complexity:** Small (20-30 lines)

---

### Phase 5: Testing & Polish (Lower Priority)

#### **P. Testing Suite**
**Tasks:**
1. Test move order calculation:
   - Priority moves
   - Speed ties
   - Trick Room
2. Test damage application accuracy:
   - Compare simulated damage to actual battle results
   - Test with various Pokemon, moves, items, abilities
3. Test edge cases:
   - Both Pokemon faint (double KO)
   - Recoil KO
   - Protect/Detect
4. Test UI:
   - Simulation mode toggle
   - Move selection
   - Reset functionality
   - Multi-turn chains

**Estimated Complexity:** High (ongoing)

#### **Q. Performance Optimization**
**Tasks:**
1. Profile Redux state updates (are re-renders efficient?)
2. Memoize expensive calculations (speed, damage)
3. Debounce rapid move changes
4. Lazy-load simulation components (code-splitting)

**Estimated Complexity:** Medium (20-30 lines)

#### **R. Error Handling**
**Tasks:**
1. Add error boundaries for simulation components
2. Handle invalid moves gracefully
3. Display user-friendly error messages
4. Add fallback UI if simulation fails

**Estimated Complexity:** Small-Medium (30-40 lines)

---

## 🚀 Recommended Implementation Order

### Sprint 1: Minimal Viable Product (MVP)
**Goal:** Get basic simulation working end-to-end

1. ✅ **DONE:** Core infrastructure (Redux, Context, utilities)
2. **Create PlayAheadControls component** (buttons for enable/execute/reset)
3. **Modify PokeMoves** (add opponent move dropdown)
4. **Create basic SimulationResult** (show damage and turn order)
5. **Integrate PlayAheadProvider** (wrap Calcdex)
6. **Test basic simulation** (select moves → execute → see results)

**Result:** Users can simulate one turn and see damage outcomes.

---

### Sprint 2: Visual Polish
**Goal:** Make simulation visually clear and intuitive

7. **Modify PokeInfo** (show simulated HP overlay)
8. **Add visual styling** (simulated HP bars, mode banner)
9. **Add SimulationResult details** (HP changes, move descriptions)
10. **Test UX** (is it clear what's simulated vs live?)

**Result:** Clear visual distinction between live and simulated state.

---

### Sprint 3: Multi-Turn Support
**Goal:** Enable chaining multiple turns

11. **Implement "Advance Turn" functionality**
12. **Show turn history** (optionally, display past turns)
13. **Test turn chaining** (simulate 3-4 turns ahead)

**Result:** Users can play multiple turns ahead.

---

### Sprint 4: Advanced Effects
**Goal:** Handle stat changes, status, field effects

14. **Stat boost/drop moves** (Swords Dance, Intimidate, etc.)
15. **Status condition moves** (Thunder Wave, Will-O-Wisp, etc.)
16. **Field effect moves** (Stealth Rock, Reflect, Rain Dance, etc.)
17. **Test with complex scenarios** (setup sweepers, weather teams)

**Result:** Simulation handles most common move effects.

---

### Sprint 5: Edge Cases
**Goal:** Handle switching, random effects, items

18. **U-turn / Volt Switch** (switch-out moves)
19. **Random secondary effects** (Scald burn, flinch, etc.)
20. **Focus Sash / Sturdy**
21. **Multi-hit moves**
22. **Test edge cases thoroughly**

**Result:** Feature handles almost all battle scenarios.

---

### Sprint 6: Polish & Release
**Goal:** Optimize, fix bugs, prepare for users

23. **Performance optimization**
24. **Error handling & fallbacks**
25. **User testing & feedback**
26. **Documentation (user-facing)**
27. **Final bug fixes**

**Result:** Feature ready for production release.

---

## 🛠️ Development Tips for Future Contributors

### Working with Redux State

**Accessing simulation state:**
```tsx
import { usePlayAheadContext } from '@showdex/components/calc/PlayAhead';

const MyComponent = () => {
  const { state, isActive, canExecute } = usePlayAheadContext();

  if (!isActive) return null; // Not in simulation mode

  const simulatedHp = state?.simulatedBattleState?.p1?.pokemon?.[0]?.hp;
  // ...
};
```

**Dispatching actions:**
```tsx
const { initSimulation, setPlayerMove, executeSimulation } = usePlayAheadContext();

// Start simulation
const handleEnableSimulation = () => {
  initSimulation(currentBattleState, 'MyComponent');
};

// Select move
const handleMoveSelect = (move: MoveName) => {
  setPlayerMove(move, 'MyComponent');
};

// Execute turn
const handleExecute = () => {
  executeSimulation(currentBattleState, playerKey, opponentKey, 'MyComponent');
};
```

### Accessing Current Battle State

The simulated state is based on the **current** `CalcdexBattleState`. To get it:

```tsx
import { useCalcdexContext } from '@showdex/components/calc/CalcdexContext';

const MyComponent = () => {
  const { state: currentBattleState } = useCalcdexContext();
  const { initSimulation } = usePlayAheadContext();

  const handleStart = () => {
    initSimulation(currentBattleState); // Pass current state to clone
  };
};
```

### Testing Simulations in Dev

**Quick test scenario:**
1. Start a battle on Pokemon Showdown
2. Open Showdex calculator
3. Enable simulation mode
4. Select moves for both players
5. Click "Execute Turn"
6. Check Redux DevTools (if enabled) to see state changes
7. Verify HP changes match expected damage

**Debug logging:**
- All utilities use `@showdex/utils/debug/logger`
- Check browser console for logs prefixed with `[@showdex/utils/playahead/...]`

### Common Pitfalls

❌ **Don't mutate battle state directly**
```tsx
// BAD
battleState.p1.pokemon[0].hp = 50;

// GOOD
const newBattleState = cloneBattleState(battleState);
newBattleState.p1.pokemon[0].hp = 50;
```

❌ **Don't forget to clone nested objects**
```tsx
// BAD
const newPokemon = {...pokemon};
newPokemon.boosts.atk = 2; // Mutates original!

// GOOD
const newPokemon = clonePokemon(pokemon); // Deep clone
newPokemon.boosts.atk = 2;
```

❌ **Don't assume both moves will execute**
- First move might KO the target → second move is skipped
- Always check `targetFainted` and `userFainted` in `applyMoveEffects()`

✅ **Do use existing utilities**
- Reuse `calcSmogonMatchup()` for damage
- Reuse `calcPokemonFinalStats()` for speed
- Reuse `cloneBattleState()`, `clonePokemon()`, etc.

✅ **Do add scope strings for debugging**
```tsx
setPlayerMove(move, 'PokeMoves:handleMoveClick()');
```

---

## 📚 Key Files to Reference

### Existing Code to Study

- **`src/utils/calc/calcSmogonMatchup.ts`** - How damage is calculated
- **`src/utils/calc/calcPokemonFinalStats.ts`** - How stats (including speed) are calculated
- **`src/utils/battle/cloneBattleState.ts`** - How to safely clone battle state
- **`src/components/calc/CalcdexContext/useCalcdexContext.ts`** - Pattern for context hooks
- **`src/redux/store/calcdexSlice.ts`** - Pattern for Redux slices
- **`src/components/calc/PokeMoves/PokeMoves.tsx`** - Existing move display UI

### Dex Lookups (for move data)

```tsx
import { getDexForFormat } from '@showdex/utils/dex';

const dex = getDexForFormat(format);
const move = dex.moves.get('Earthquake');

// Available properties:
move.name         // 'Earthquake'
move.type         // 'Ground'
move.category     // 'Physical'
move.basePower    // 100
move.priority     // 0
move.accuracy     // 100
move.pp           // 10
move.recoil       // [1, 3] for 1/3 recoil
move.drain        // [1, 2] for 1/2 drain
move.boosts       // {atk: 1, def: -1, ...}
move.status       // 'par', 'brn', etc.
move.weather      // 'Rain', 'Sun', etc.
move.terrain      // 'Electric', 'Grassy', etc.
move.selfSwitch   // true for U-turn, etc.
move.secondary    // {chance: 30, status: 'brn'}
move.multihit     // [2, 5] for multi-hit
```

---

## 🎯 Success Criteria

The feature is **complete** when:

✅ Users can enable simulation mode from the Calcdex UI
✅ Users can select moves for both player and opponent
✅ Users can execute a turn and see accurate damage results
✅ Simulated HP/status is visually distinct from live state
✅ Users can chain multiple turns (advance to next turn)
✅ Users can reset simulation and return to live state
✅ Simulation handles common move effects (damage, recoil, drain, stat changes, status, field effects)
✅ Simulation handles edge cases (U-turn, random effects, Focus Sash, multi-hit)
✅ Feature works in Singles battles without breaking existing functionality
✅ Code is maintainable and follows Showdex patterns

---

## 📞 Questions for User

If you encounter ambiguity during implementation, here are questions to ask:

1. **UI Placement:** Where exactly should PlayAheadControls be placed? (Above field? Below field? Sidebar?)
2. **Opponent Move Default:** Should opponent move default to their last used move, or require explicit selection?
3. **Simulation Persistence:** Should simulation state persist if user switches tabs? Or auto-reset?
4. **Turn Limit:** Is there a maximum number of turns ahead users can simulate? (e.g., 5 turns max)
5. **Edge Case Defaults:** For random effects (30% burn), what should the default choice be? (Always apply? Never apply? Ask every time?)
6. **Doubles Support:** Should the architecture support Doubles battles eventually? (Currently Singles-only)

---

## 🏁 Current Status

**As of commit `1a40bf0` (2025-11-25):**

- ✅ **Phase 0: Foundation** - COMPLETE (100%)
  - Type definitions, Redux slice, simulation engine, React context

- 🔄 **Phase 1: UI Components** - NOT STARTED (0%)
  - PlayAheadControls, SimulationResult, PokeMoves modification, PokeInfo modification

- 🔄 **Phase 2: Integration** - NOT STARTED (0%)
  - Provider integration, layout changes, battle sync pausing

- 🔄 **Phase 3: Advanced Effects** - PARTIALLY COMPLETE (25%)
  - Damage, recoil, drain: ✅ DONE
  - Stat changes, status, field effects: ⏳ TODO

- 🔄 **Phase 4: Edge Cases** - NOT STARTED (0%)
  - U-turn, random effects, Focus Sash, multi-hit

- 🔄 **Phase 5: Testing & Polish** - NOT STARTED (0%)

**Next Immediate Steps:**
1. Create `PlayAheadControls.tsx` component
2. Modify `PokeMoves.tsx` to add opponent move selection
3. Create basic `SimulationResult.tsx` display
4. Integrate `PlayAheadProvider` into Calcdex
5. Test MVP (one turn simulation)

---

**Good luck, and may your simulations be accurate! 🎮⚔️**
