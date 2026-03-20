/**
 * Animation system — 10 agent animations driven by status.
 *
 * Each animation function receives (ctx, x, y, t, frame) and draws
 * additional effects around the agent sprite.
 */

type AnimFn = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number) => void;

// 1. IDLE — gentle breathing (scale pulse)
const idleAnim: AnimFn = (_ctx, _x, _y, _t) => {
  // Breathing handled via bobOffset in Scene
};

// 2. WORKING — typing sparks / code particles
const workingAnim: AnimFn = (ctx, x, y, t) => {
  // Small floating code symbols
  const symbols = ["{ }", "=>", "( )", "< />", "++", "fn"];
  const idx = Math.floor(t / 400) % symbols.length;
  ctx.font = "9px monospace";
  ctx.fillStyle = "#2cb67d";
  ctx.globalAlpha = 0.6 + Math.sin(t * 0.005) * 0.3;
  ctx.fillText(symbols[idx], x + 18, y - 20 + Math.sin(t * 0.003) * 5);
  ctx.globalAlpha = 1;
};

// 3. TALKING — speech bubbles popping
const talkingAnim: AnimFn = (ctx, x, y, t) => {
  const dots = Math.floor((t / 300) % 4);
  const text = ".".repeat(dots);
  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#7f5af0";
  ctx.fillText("💬" + text, x + 16, y - 28);
};

// 4. THINKING — rotating gears
const thinkingAnim: AnimFn = (ctx, x, y, t) => {
  ctx.save();
  ctx.translate(x + 8, y - 30);
  ctx.rotate(t * 0.002);
  ctx.font = "14px serif";
  ctx.fillText("⚙️", -7, 7);
  ctx.restore();

  // Light bulb flicker
  ctx.globalAlpha = 0.5 + Math.sin(t * 0.008) * 0.5;
  ctx.font = "12px serif";
  ctx.fillText("💡", x - 12, y - 32);
  ctx.globalAlpha = 1;
};

// 5. SLEEPING — floating Z's
const sleepingAnim: AnimFn = (ctx, x, y, t) => {
  const zs = ["z", "Z", "z"];
  for (let i = 0; i < 3; i++) {
    const zy = y - 25 - i * 12 - ((t * 0.02 + i * 20) % 40);
    const zx = x + 10 + i * 6;
    ctx.font = `${10 + i * 3}px sans-serif`;
    ctx.fillStyle = "#525272";
    ctx.globalAlpha = 1 - ((t * 0.02 + i * 20) % 40) / 40;
    ctx.fillText(zs[i], zx, zy);
  }
  ctx.globalAlpha = 1;
};

// 6. CELEBRATING — confetti particles
const celebratingAnim: AnimFn = (ctx, x, y, t) => {
  const confettiColors = ["#e53170", "#2cb67d", "#7f5af0", "#ff8906", "#3da9fc"];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + t * 0.003;
    const radius = 20 + Math.sin(t * 0.005 + i) * 10;
    const cx = x + Math.cos(angle) * radius;
    const cy = y - 20 + Math.sin(angle) * radius * 0.5;
    ctx.fillStyle = confettiColors[i % confettiColors.length];
    ctx.globalAlpha = 0.8;
    ctx.fillRect(cx, cy, 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.font = "16px serif";
  ctx.fillText("🎉", x - 8, y - 38);
};

// 7. REVIEWING — magnifying glass
const reviewingAnim: AnimFn = (ctx, x, y, t) => {
  const swing = Math.sin(t * 0.004) * 8;
  ctx.font = "14px serif";
  ctx.fillText("🔍", x + 16 + swing, y - 10);
};

// 8. DEPLOYING — rocket
const deployingAnim: AnimFn = (ctx, x, y, t) => {
  const lift = Math.sin(t * 0.006) * 6;
  ctx.font = "14px serif";
  ctx.fillText("🚀", x + 14, y - 30 + lift);
  // Flame particles
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#ff8906" : "#e53170";
    ctx.globalAlpha = 0.6;
    ctx.fillRect(x + 18 + Math.random() * 4, y - 18 + lift + i * 3, 2, 2);
  }
  ctx.globalAlpha = 1;
};

// 9. TESTING — checklist
const testingAnim: AnimFn = (ctx, x, y, t) => {
  const check = Math.floor(t / 600) % 2 === 0;
  ctx.font = "12px serif";
  ctx.fillText(check ? "✅" : "❌", x + 16, y - 24);
  ctx.font = "9px sans-serif";
  ctx.fillStyle = "#3da9fc";
  ctx.fillText("test", x + 16, y - 12);
};

// 10. WAITING — hourglass rotation
const waitingAnim: AnimFn = (ctx, x, y, t) => {
  ctx.save();
  ctx.translate(x + 8, y - 28);
  const flip = Math.floor(t / 1000) % 2 === 0;
  if (flip) ctx.scale(1, -1);
  ctx.font = "14px serif";
  ctx.fillText("⏳", -7, 7);
  ctx.restore();
};

/** Map status → animation function */
export const ANIMATIONS: Record<string, AnimFn> = {
  idle: idleAnim,
  working: workingAnim,
  talking: talkingAnim,
  thinking: thinkingAnim,
  sleeping: sleepingAnim,
  celebrating: celebratingAnim,
  reviewing: reviewingAnim,
  deploying: deployingAnim,
  testing: testingAnim,
  waiting: waitingAnim,
};
