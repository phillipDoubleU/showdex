# Testing Guide: Play Ahead Feature

## 📋 Prerequisites

### 1. Build the Extension

```bash
# Switch to Node v18 (required)
nvm use 18

# Build for Chrome (development mode with hot reload)
yarn dev:chrome

# OR build for production
yarn build:chrome
```

**Build output location:** `build/chrome/` (dev) or `dist/chrome/` (production)

---

## 🚀 Step 1: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `build/chrome` directory (or `dist/chrome` for production build)
5. Verify "Showdex" appears in your extensions list

---

## 🎮 Step 2: Start a Battle

1. Navigate to [Pokemon Showdown](https://play.pokemonshowdown.com)
2. Start a **Singles battle** (Random Battle, OU, etc.)
   - **Note:** Play Ahead currently only supports Singles format
3. Verify that the Calcdex (damage calculator) appears on the right side
4. Wait for both Pokemon to be visible in the calculator

---

## ✅ Step 3: Basic Functionality Tests

### Test 3.1: Enable Simulation Mode

**Action:**
- Look for the **"Play Ahead"** section between the Field conditions and the bottom Pokemon
- Click the **"Enable Simulation"** button

**Expected Result:**
- ✅ Button changes to "Disable Simulation"
- ✅ Button and surrounding area gets a blue tint/glow
- ✅ **Opponent's move section** now shows a dropdown: "Select Opponent Move"

**Screenshot locations:**
- Controls should appear between FieldCalc and bottom PlayerCalc
- Opponent move selector appears above opponent's 4 move buttons

---

### Test 3.2: Select Moves

**Action:**
1. Click on one of **your Pokemon's moves** (top or bottom, whichever is yours)
   - This uses the existing move selection (no changes here)
2. In the **opponent's Pokemon section**, use the **new dropdown** to select their move
   - Dropdown labeled "Select Opponent Move"
   - Should show only the 4 moves that the opponent's Pokemon has

**Expected Result:**
- ✅ Your move is highlighted (existing behavior)
- ✅ Opponent's move appears in the dropdown
- ✅ **"Simulate Turn"** button becomes enabled (no longer greyed out)

**Common Issues:**
- ❌ If opponent dropdown doesn't appear: Check that simulation mode is enabled
- ❌ If opponent dropdown is empty: Opponent Pokemon may not have moves loaded yet

---

### Test 3.3: Execute Simulation

**Action:**
- Click **"Simulate Turn"** button

**Expected Result:**
- ✅ **SimulationResult** component appears between PlayAheadControls and bottom PlayerCalc
- ✅ Shows turn results with:
  - Which player moved first (e.g., "P1" or "P2")
  - Move names
  - Damage descriptions (e.g., "Garchomp used Earthquake! It dealt 87 damage.")
  - KO notifications if applicable (red highlight)
- ✅ **"Next Turn ›"** button appears
- ✅ **"Reset"** button appears (red)

**Example Result:**
```
┌─────────────────────────────────────┐
│ Turn Results                        │
├─────────────────────────────────────┤
│ P1 • Earthquake                     │
│ Garchomp used Earthquake!           │
│ It dealt 87 damage.                 │
├─────────────────────────────────────┤
│ P2 • Ice Beam                       │
│ Landorus-T used Ice Beam!           │
│ It dealt 312 damage.                │
│ ⚠️ Target fainted!                  │
└─────────────────────────────────────┘
```

---

### Test 3.4: Advance Turn

**Action:**
- Click **"Next Turn ›"** button

**Expected Result:**
- ✅ Turn counter updates (e.g., "Turn +1" → "Turn +2")
- ✅ Move selections are cleared
- ✅ SimulationResult disappears (waiting for next execution)
- ✅ You can select new moves and simulate again

---

### Test 3.5: Reset Simulation

**Action:**
- Click **"Reset"** button (red button)

**Expected Result:**
- ✅ Simulation mode is disabled
- ✅ All simulation UI disappears (controls, results, opponent dropdown)
- ✅ Calculator returns to normal state
- ✅ Button changes back to "Enable Simulation"

---

## 🔍 Step 4: Advanced Functionality Tests

### Test 4.1: Move Order (Priority)

**Setup:**
- Use Pokemon with priority moves (e.g., Extreme Speed, Quick Attack, Aqua Jet)

**Action:**
1. Select a priority move for your Pokemon
2. Select a normal move for opponent
3. Execute simulation

**Expected Result:**
- ✅ SimulationResult shows your Pokemon moved first
- ✅ Reason displayed (e.g., "due to priority")

---

### Test 4.2: Move Order (Speed)

**Setup:**
- Use Pokemon with different speeds

**Action:**
1. Select normal priority moves for both
2. Execute simulation

**Expected Result:**
- ✅ Faster Pokemon moves first
- ✅ If speeds are equal, order is random (50/50)

---

### Test 4.3: KO Detection

**Action:**
1. Select a move that will KO the opponent
2. Execute simulation

**Expected Result:**
- ✅ First move result shows damage
- ✅ Shows "Target fainted!" in red
- ✅ **Second move does NOT execute** (target already fainted)
- ✅ Only one move result displayed

---

### Test 4.4: Recoil Damage

**Setup:**
- Use moves with recoil (Brave Bird, Flare Blitz, Double-Edge)

**Action:**
1. Select a recoil move for your Pokemon
2. Execute simulation

**Expected Result:**
- ✅ Move result shows main damage
- ✅ Shows recoil damage to user (e.g., "User took 29 recoil damage")
- ✅ User's HP is reduced in simulated state

---

### Test 4.5: Drain Moves

**Setup:**
- Use drain moves (Giga Drain, Drain Punch, Leech Life)

**Action:**
1. Select a drain move
2. Execute simulation

**Expected Result:**
- ✅ Move result shows damage dealt
- ✅ Shows healing to user (e.g., "User healed 43 HP")
- ✅ User's HP increases in simulated state

---

### Test 4.6: Multi-Turn Simulation

**Action:**
1. Enable simulation
2. Select moves and execute
3. Click "Next Turn ›"
4. Select new moves and execute again
5. Repeat 2-3 more times

**Expected Result:**
- ✅ Turn counter increments each time (Turn +1, +2, +3, etc.)
- ✅ Each execution uses the **simulated state** from previous turn
- ✅ HP continues to decrease across turns
- ✅ Can simulate 3+ turns ahead

---

## 🐛 Step 5: Edge Cases & Error Handling

### Test 5.1: Execute Without Opponent Move

**Action:**
1. Enable simulation
2. Select only YOUR move (don't select opponent's)
3. Try to click "Simulate Turn"

**Expected Result:**
- ✅ Button is **disabled** (greyed out)
- ✅ Cannot execute without both moves selected

---

### Test 5.2: Execute Without Player Move

**Action:**
1. Enable simulation
2. Select only OPPONENT's move
3. Try to click "Simulate Turn"

**Expected Result:**
- ✅ Button is **disabled**
- ✅ Cannot execute without both moves selected

---

### Test 5.3: Disable During Simulation

**Action:**
1. Enable simulation
2. Execute a turn (view results)
3. Click "Disable Simulation" button

**Expected Result:**
- ✅ All simulation state is discarded
- ✅ Calculator returns to live battle state
- ✅ All simulation UI disappears

---

### Test 5.4: Switch Pokemon During Simulation

**Action:**
1. Enable simulation and execute a turn
2. In the actual battle (not calculator), switch to a different Pokemon
3. Observe calculator behavior

**Expected Result:**
- ⚠️ Simulation state may become stale
- 💡 Recommended: Reset simulation when battle state changes
- 🔜 Future improvement: Auto-reset on battle state change

---

## 🎨 Step 6: Visual/UI Tests

### Test 6.1: Light Mode

**Action:**
- Ensure you're in light color scheme
- Enable simulation

**Expected Result:**
- ✅ Controls have light blue background (#E3F2FD)
- ✅ Opponent move selector has light blue tint
- ✅ Results have white/light gray background
- ✅ Text is dark and readable

---

### Test 6.2: Dark Mode

**Action:**
- Switch to dark color scheme
- Enable simulation

**Expected Result:**
- ✅ Controls have dark blue background (#0D47A1)
- ✅ Opponent move selector has dark blue tint
- ✅ Results have dark background
- ✅ Text is light and readable

---

### Test 6.3: Mobile/Responsive

**Action:**
- Resize browser window to mobile size
- Or use Chrome DevTools mobile emulation

**Expected Result:**
- ✅ Controls stack vertically if needed
- ✅ Buttons remain accessible
- ✅ Text remains readable
- ✅ No horizontal overflow

---

## 📊 Step 7: Performance Tests

### Test 7.1: Rapid Toggling

**Action:**
- Quickly enable/disable simulation 5-10 times

**Expected Result:**
- ✅ No lag or freezing
- ✅ UI updates smoothly
- ✅ No console errors

---

### Test 7.2: Multiple Executions

**Action:**
- Execute simulation 10+ times in a row

**Expected Result:**
- ✅ Each execution completes quickly (< 100ms)
- ✅ No memory leaks
- ✅ Browser remains responsive

---

## 🔧 Troubleshooting

### Issue: Opponent dropdown doesn't show

**Possible causes:**
1. Simulation mode not enabled
2. Viewing your own Pokemon (dropdown only appears for opponent)
3. Opponent Pokemon has no moves loaded

**Solution:**
- Verify simulation mode is active (blue tint)
- Check that you're looking at the OPPONENT's Pokemon section
- Wait for battle to fully load

---

### Issue: "Simulate Turn" button stays disabled

**Possible causes:**
1. Only one move selected
2. JavaScript error in console

**Solution:**
- Ensure BOTH moves are selected (yours + opponent's)
- Check browser console (F12) for errors
- Try resetting simulation and re-selecting

---

### Issue: No results appear after execution

**Possible causes:**
1. Simulation engine error
2. Missing Pokemon data

**Solution:**
- Check browser console for errors
- Verify both Pokemon have valid stats/moves
- Try with different Pokemon/moves

---

### Issue: Results show "IMMUNE" or no damage

**Expected behavior:**
- Type immunities work correctly (e.g., Ground vs. Flying)
- Move may not be effective

**Verify:**
- Check type matchup is correct
- Try different move combination

---

## ✅ Success Criteria

You should be able to:

- [x] Enable/disable simulation mode
- [x] Select moves for both players
- [x] Execute turn simulation
- [x] See detailed damage results
- [x] Advance to next turn
- [x] Simulate 3+ turns ahead
- [x] Reset simulation at any time
- [x] All UI elements appear correctly
- [x] No console errors during normal use
- [x] Smooth performance (no lag)

---

## 📝 Feedback & Bug Reporting

When reporting issues, please include:

1. **Steps to reproduce**
2. **Expected behavior**
3. **Actual behavior**
4. **Browser console errors** (F12 → Console tab)
5. **Pokemon involved** (species, moves, stats)
6. **Screenshot** (if visual issue)
7. **Browser version**

---

## 🎯 Known Limitations (Sprint 1)

These are expected and will be addressed in future sprints:

- ⏳ No simulated HP overlay on Pokemon (Sprint 2)
- ⏳ No stat changes applied (Swords Dance, etc.) (Sprint 4)
- ⏳ No status conditions (Thunder Wave, etc.) (Sprint 4)
- ⏳ No field effects (Stealth Rock, weather, etc.) (Sprint 4)
- ⏳ No U-turn/Volt Switch handling (Sprint 5)
- ⏳ No random effect handling (30% burn, etc.) (Sprint 5)
- ⏳ No Focus Sash/Sturdy (Sprint 5)
- ⏳ No multi-hit move support (Bullet Seed, etc.) (Sprint 5)
- ⏳ Battle sync not paused during simulation (Sprint 2)

---

## 🚀 Next Steps After Testing

Once basic testing is complete:

1. Document any bugs found
2. Test edge cases more thoroughly
3. Gather UX feedback (is it intuitive?)
4. Decide on Sprint 2 priorities
5. Plan visual polish improvements

---

**Happy Testing! 🎮✨**
