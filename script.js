const gridSize = 12;
const maxCycles = 12;

const state = {
  cycle: 1,
  health: 100,
  energy: 100,
  score: 0,
  combo: 0,
  comboTimer: 0,
  freezeTurns: 0,
  paused: false,
  cooldowns: {
    pulse: 0,
    burst: 0,
    warp: 0,
  },
  player: { x: 1, y: 1 },
  grid: [],
  log: [],
  upgrades: {
    pulse: { level: 0, max: 3, cost: 50, label: "Time Pulse+" },
    burst: { level: 0, max: 3, cost: 60, label: "Energy Burst+" },
    warp: { level: 0, max: 2, cost: 80, label: "Warp Stability" },
    core: { level: 0, max: 3, cost: 45, label: "Core Magnet" },
  },
};

const gridEl = document.getElementById("grid");
const overlayEl = document.getElementById("overlay");
const startBtn = document.getElementById("start-btn");
const statusHealth = document.getElementById("status-health");
const statusEnergy = document.getElementById("status-energy");
const statusScore = document.getElementById("status-score");
const statusCombo = document.getElementById("status-combo");
const statusPaused = document.getElementById("status-paused");
const statusTime = document.getElementById("status-time");
const upgradesEl = document.getElementById("upgrades");
const logEl = document.getElementById("log");
const abilityPulse = document.getElementById("ability-pulse");
const abilityBurst = document.getElementById("ability-burst");
const abilityWarp = document.getElementById("ability-warp");
const cooldownPulse = document.getElementById("cooldown-pulse");
const cooldownBurst = document.getElementById("cooldown-burst");
const cooldownWarp = document.getElementById("cooldown-warp");
const objectiveEl = document.getElementById("objective");
const touchButtons = document.querySelectorAll(".touch-btn");

const tileTypes = {
  empty: "empty",
  wall: "wall",
  core: "core",
  anomaly: "anomaly",
  stabilizer: "stabilizer",
  portal: "portal",
};

function init() {
  gridEl.innerHTML = "";
  for (let i = 0; i < gridSize * gridSize; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    gridEl.appendChild(cell);
  }
  startBtn.addEventListener("click", startGame);
  abilityPulse.addEventListener("click", timePulse);
  abilityBurst.addEventListener("click", energyBurst);
  abilityWarp.addEventListener("click", warp);
  touchButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const dir = button.dataset.move;
      if (dir === "up") move(0, -1);
      if (dir === "down") move(0, 1);
      if (dir === "left") move(-1, 0);
      if (dir === "right") move(1, 0);
    });
  });
  renderUpgrades();
  log("System primed. Tap Start to begin.");
  render();
}

function buildGrid() {
  const grid = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => tileTypes.empty)
  );

  const wallCount = 26 + state.cycle * 2;
  const coreCount = 8 + state.cycle;
  const anomalyCount = 6 + state.cycle;
  const stabilizerCount = 4;

  placeTiles(grid, tileTypes.wall, wallCount);
  placeTiles(grid, tileTypes.core, coreCount);
  placeTiles(grid, tileTypes.anomaly, anomalyCount);
  placeTiles(grid, tileTypes.stabilizer, stabilizerCount);

  grid[gridSize - 2][gridSize - 2] = tileTypes.portal;

  state.player = { x: 1, y: 1 };
  grid[state.player.y][state.player.x] = tileTypes.empty;
  state.grid = grid;
}

function placeTiles(grid, type, count) {
  let placed = 0;
  while (placed < count) {
    const x = rand(gridSize);
    const y = rand(gridSize);
    if (
      (x === 1 && y === 1) ||
      (x === gridSize - 2 && y === gridSize - 2)
    ) {
      continue;
    }
    if (grid[y][x] === tileTypes.empty) {
      grid[y][x] = type;
      placed += 1;
    }
  }
}

function startGame() {
  overlayEl.classList.add("hidden");
  resetState();
  buildGrid();
  log("Cycle 1 begins. Stay sharp, runner.");
  render();
}

function resetState() {
  state.cycle = 1;
  state.health = 100;
  state.energy = 100;
  state.score = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.freezeTurns = 0;
  state.paused = false;
  state.cooldowns = {
    pulse: 0,
    burst: 0,
    warp: 0,
  };
}

function render() {
  const cells = gridEl.querySelectorAll(".cell");
  state.grid.forEach((row, y) => {
    row.forEach((tile, x) => {
      const index = y * gridSize + x;
      const cell = cells[index];
      cell.className = "cell";
      if (tile !== tileTypes.empty) {
        cell.classList.add(tile);
      }
      if (state.player.x === x && state.player.y === y) {
        cell.classList.add("player");
      }
    });
  });

  statusHealth.textContent = `Health: ${state.health}`;
  statusEnergy.textContent = `Energy: ${state.energy}`;
  statusScore.textContent = `Score: ${state.score}`;
  statusCombo.textContent = `Combo: x${state.combo}`;
  statusTime.textContent = `Cycle: ${state.cycle}`;
  statusPaused.textContent = state.paused ? "Paused" : "Running";

  statusHealth.classList.toggle("alert", state.health <= 30);
  statusEnergy.classList.toggle("alert", state.energy <= 20);
  statusCombo.classList.toggle("combo-active", state.combo > 0);

  objectiveEl.textContent = `Objective: Reach the portal in cycle ${state.cycle} (of ${maxCycles}).`;
  renderAbilities();
  renderLog();
}

function move(dx, dy) {
  if (overlayEl.classList.contains("hidden") === false || state.paused) {
    return;
  }
  const target = {
    x: clamp(state.player.x + dx),
    y: clamp(state.player.y + dy),
  };

  const tile = state.grid[target.y][target.x];
  if (tile === tileTypes.wall) {
    log("Bumped into a chrono wall.");
    drainEnergy(2);
    return;
  }

  state.player = target;
  handleTile(tile, target);
  advanceCycle();
  render();
}

function handleTile(tile, pos) {
  switch (tile) {
    case tileTypes.core:
      collectCore(pos);
      break;
    case tileTypes.anomaly:
      hitAnomaly(pos);
      break;
    case tileTypes.stabilizer:
      collectStabilizer(pos);
      break;
    case tileTypes.portal:
      if (state.cycle >= maxCycles) {
        finishGame(true);
      } else {
        state.cycle += 1;
        state.energy = clampValue(state.energy + 15, 120);
        log(`Warped into cycle ${state.cycle}.`);
        buildGrid();
      }
      break;
    default:
      break;
  }
  state.grid[pos.y][pos.x] = tileTypes.empty;
}

function collectCore(pos) {
  const magnetBonus = state.upgrades.core.level * 2;
  const gain = 12 + magnetBonus + state.combo * 2;
  state.score += gain;
  state.energy = clampValue(state.energy + 6 + magnetBonus, 120);
  state.combo += 1;
  state.comboTimer = 3;
  log(`Chrono core collected +${gain} score. Combo x${state.combo}!`);
  spreadMagnet(pos, magnetBonus);
}

function spreadMagnet(pos, magnetBonus) {
  if (magnetBonus === 0) return;
  const radius = 1 + Math.floor(magnetBonus / 2);
  for (let y = pos.y - radius; y <= pos.y + radius; y += 1) {
    for (let x = pos.x - radius; x <= pos.x + radius; x += 1) {
      if (!isInside(x, y)) continue;
      if (state.grid[y][x] === tileTypes.core) {
        state.grid[y][x] = tileTypes.empty;
        state.score += 6;
        state.energy = clampValue(state.energy + 3, 120);
        log("Magnet pulled in a core +6 score.");
      }
    }
  }
}

function hitAnomaly(pos) {
  if (state.freezeTurns > 0) {
    log("Frozen anomaly bypassed.");
    return;
  }
  state.health = clampValue(state.health - 18, 120);
  state.energy = clampValue(state.energy - 10, 120);
  state.combo = 0;
  log("Anomaly collision! Systems destabilized.");
  if (state.health <= 0) {
    finishGame(false);
  }
  state.grid[pos.y][pos.x] = tileTypes.empty;
}

function collectStabilizer(pos) {
  state.health = clampValue(state.health + 20, 120);
  state.energy = clampValue(state.energy + 18, 120);
  state.score += 10;
  log("Stabilizer secured. Systems rebalanced.");
}

function advanceCycle() {
  if (state.comboTimer > 0) {
    state.comboTimer -= 1;
    if (state.comboTimer === 0) {
      state.combo = 0;
      log("Combo window closed.");
    }
  }

  if (state.freezeTurns > 0) {
    state.freezeTurns -= 1;
  }

  updateCooldowns();
  drainEnergy(1);
  moveAnomalies();

  if (state.energy <= 0) {
    state.health = clampValue(state.health - 5, 120);
    log("Energy depleted! Health draining.");
  }

  if (state.health <= 0) {
    finishGame(false);
  }
}

function moveAnomalies() {
  if (state.freezeTurns > 0) {
    return;
  }
  const anomalies = [];
  state.grid.forEach((row, y) =>
    row.forEach((tile, x) => {
      if (tile === tileTypes.anomaly) anomalies.push({ x, y });
    })
  );

  anomalies.forEach((anomaly) => {
    const dir = randomDirection();
    const nx = clamp(anomaly.x + dir.x);
    const ny = clamp(anomaly.y + dir.y);
    if (!isInside(nx, ny)) return;
    const targetTile = state.grid[ny][nx];
    if ([tileTypes.wall, tileTypes.portal, tileTypes.anomaly].includes(targetTile)) {
      return;
    }
    state.grid[anomaly.y][anomaly.x] = tileTypes.empty;
    if (state.player.x === nx && state.player.y === ny) {
      hitAnomaly({ x: nx, y: ny });
    } else {
      state.grid[ny][nx] = tileTypes.anomaly;
    }
  });
}

function timePulse() {
  if (state.paused) return;
  if (state.cooldowns.pulse > 0) {
    log("Time Pulse recharging.");
    return;
  }
  if (state.energy < 18) {
    log("Not enough energy to pulse.");
    return;
  }
  const bonus = state.upgrades.pulse.level;
  state.energy = clampValue(state.energy - 18 + bonus * 2, 120);
  state.freezeTurns = 2 + bonus;
  state.cooldowns.pulse = 4 - Math.min(2, bonus);
  log("Time pulse activated. Anomalies frozen.");
  render();
}

function energyBurst() {
  if (state.paused) return;
  if (state.cooldowns.burst > 0) {
    log("Energy Burst recharging.");
    return;
  }
  if (state.energy < 20) {
    log("Not enough energy to burst.");
    return;
  }
  const radius = 1 + state.upgrades.burst.level;
  let cleared = 0;
  for (let y = state.player.y - radius; y <= state.player.y + radius; y += 1) {
    for (let x = state.player.x - radius; x <= state.player.x + radius; x += 1) {
      if (!isInside(x, y)) continue;
      if (state.grid[y][x] === tileTypes.anomaly) {
        state.grid[y][x] = tileTypes.empty;
        cleared += 1;
      }
    }
  }
  state.energy = clampValue(state.energy - 20, 120);
  state.score += cleared * 12;
  state.cooldowns.burst = 5 - state.upgrades.burst.level;
  log(`Energy burst cleared ${cleared} anomalies.`);
  render();
}

function warp() {
  if (state.paused) return;
  if (state.cooldowns.warp > 0) {
    log("Warp recalibrating.");
    return;
  }
  if (state.energy < 25) {
    log("Not enough energy to warp.");
    return;
  }
  const attempts = 12 + state.upgrades.warp.level * 4;
  let destination = null;
  for (let i = 0; i < attempts; i += 1) {
    const x = rand(gridSize);
    const y = rand(gridSize);
    const tile = state.grid[y][x];
    if ([tileTypes.wall, tileTypes.anomaly].includes(tile)) continue;
    destination = { x, y };
    break;
  }

  if (!destination) {
    log("Warp failed. No safe rift found.");
    return;
  }
  state.energy = clampValue(state.energy - 25, 120);
  state.player = destination;
  state.cooldowns.warp = 6 - state.upgrades.warp.level * 2;
  log("Warped through the rift.");
  render();
}

function restartCycle() {
  if (state.paused) return;
  log("Cycle rebooting.");
  buildGrid();
  state.energy = clampValue(state.energy - 10, 120);
  render();
}

function drainEnergy(amount) {
  state.energy = clampValue(state.energy - amount, 120);
}

function finishGame(success) {
  overlayEl.classList.remove("hidden");
  overlayEl.querySelector("h2").textContent = success
    ? "You escaped the rift!"
    : "Run terminated";
  overlayEl.querySelector("p").textContent = success
    ? `Final score ${state.score}. The neon labyrinth bends to your will.`
    : "The rift collapsed. Tap start to try again.";
  render();
}

function renderUpgrades() {
  upgradesEl.innerHTML = "";
  Object.entries(state.upgrades).forEach(([key, upgrade]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "upgrade";
    const label = document.createElement("div");
    label.innerHTML = `<strong>${upgrade.label}</strong><br/>Level ${upgrade.level}/${upgrade.max}`;
    const button = document.createElement("button");
    button.textContent = `Upgrade (${upgrade.cost} score)`;
    button.disabled = upgrade.level >= upgrade.max;
    button.addEventListener("click", () => buyUpgrade(key));
    wrapper.append(label, button);
    upgradesEl.appendChild(wrapper);
  });
}

function buyUpgrade(key) {
  const upgrade = state.upgrades[key];
  if (state.score < upgrade.cost || upgrade.level >= upgrade.max) {
    log("Insufficient score for upgrade.");
    return;
  }
  state.score -= upgrade.cost;
  upgrade.level += 1;
  log(`${upgrade.label} upgraded to level ${upgrade.level}.`);
  renderUpgrades();
  render();
}

function updateCooldowns() {
  Object.keys(state.cooldowns).forEach((key) => {
    if (state.cooldowns[key] > 0) {
      state.cooldowns[key] = Math.max(0, state.cooldowns[key] - 1);
    }
  });
}

function renderAbilities() {
  const pulseReady = state.cooldowns.pulse === 0;
  const burstReady = state.cooldowns.burst === 0;
  const warpReady = state.cooldowns.warp === 0;
  abilityPulse.disabled = !pulseReady || state.energy < 18 || state.paused;
  abilityBurst.disabled = !burstReady || state.energy < 20 || state.paused;
  abilityWarp.disabled = !warpReady || state.energy < 25 || state.paused;
  cooldownPulse.textContent = pulseReady ? "Ready" : `${state.cooldowns.pulse} turns`;
  cooldownBurst.textContent = burstReady ? "Ready" : `${state.cooldowns.burst} turns`;
  cooldownWarp.textContent = warpReady ? "Ready" : `${state.cooldowns.warp} turns`;
}

function log(message) {
  state.log.unshift({ message, time: new Date().toLocaleTimeString() });
  if (state.log.length > 30) {
    state.log.pop();
  }
}

function renderLog() {
  logEl.innerHTML = "";
  state.log.forEach((entry) => {
    const div = document.createElement("div");
    div.className = "log-entry";
    div.textContent = `[${entry.time}] ${entry.message}`;
    logEl.appendChild(div);
  });
}

function rand(max) {
  return Math.floor(Math.random() * max);
}

function clamp(value) {
  return Math.max(0, Math.min(gridSize - 1, value));
}

function clampValue(value, max) {
  return Math.max(0, Math.min(max, value));
}

function isInside(x, y) {
  return x >= 0 && y >= 0 && x < gridSize && y < gridSize;
}

function randomDirection() {
  const dirs = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];
  return dirs[rand(dirs.length)];
}

window.addEventListener("keydown", (event) => {
  switch (event.key.toLowerCase()) {
    case "arrowup":
    case "w":
      move(0, -1);
      break;
    case "arrowdown":
    case "s":
      move(0, 1);
      break;
    case "arrowleft":
    case "a":
      move(-1, 0);
      break;
    case "arrowright":
    case "d":
      move(1, 0);
      break;
    case " ":
      timePulse();
      break;
    case "e":
      energyBurst();
      break;
    case "q":
      warp();
      break;
    case "r":
      restartCycle();
      break;
    case "p":
      togglePause();
      break;
    default:
      break;
  }
});

function togglePause() {
  if (overlayEl.classList.contains("hidden") === false) {
    return;
  }
  state.paused = !state.paused;
  log(state.paused ? "Paused." : "Resumed.");
  render();
}

init();
