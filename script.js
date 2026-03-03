    // ===== Base Dimensions =====
    const WIDTH = 400;
    const HEIGHT = 600;
    const HUD_HEIGHT = 112;
    const INITIAL_RADIUS = 70;

    // ===== Time, Level, and Shrink Config =====
    const LEVELS = [
      { startTime: 20, targetTime: 40 },
      { startTime: 15, targetTime: 50 },
      { startTime: 10, targetTime: 60 },
      { startTime: 5, targetTime: 70 }
    ];
    const PREP_TIME = 3;
    const MAX_LEVEL = LEVELS.length;
    const HARD_SHRINK_START = 2.0;
    const HARD_SHRINK_GOAL = 0.9;
    const HARD_SECOND_BLUE_CHANCE = 0.5;
    const TIMER_DRAIN_RATE = 1.0;
    const BASE_SHRINK = 1.8;
    const MIN_SHRINK = 1.3;
    const MAX_SHRINK = 2.2;
    const PERFECT_WAVE_LIFE = 420;
    const PERFECT_WAVE_START_RADIUS = 10;
    const PERFECT_WAVE_END_RADIUS = 92;
    const PIXEL_SIZE = 3;
    const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';
    const WRONG_TAP_SHAKE_MS = 60;
    const WRONG_TAP_SHAKE_AMPLITUDE = 18;
    const WRONG_TAP_SHAKE_FREQUENCY = 11;
    const BG_TRACKS = ["music/1.mp3", "music/2.mp3", "music/3.mp3", "music/4.mp3", "music/5.mp3", "music/6.mp3"];
    const PERFECT_TAP_SFX = "music/10.mp3";
    const GOOD_TAP_SFX = "music/11.mp3";
    const RED_GAME_OVER_SFX = "music/12.mp3";
    const BG_IMAGES = ["pics/1.png", "pics/2.png", "pics/3.png", "pics/4.png", "pics/5.png", "pics/6.png"];
    const BG_IMAGE_ROTATE_MS = 60000;

    // ===== Circle Rules =====
    const PERFECT_ZONE = 0.3;
    const GOOD_ZONE = 0.6;
    const BASE_RED_CHANCE = 0.25; // active after 10 score
    const FAKE_COLORS = ["#35c26b", "#f2c43c", "#a55cff", "#ff9a2f"];
    const BEST_TAPS_KEY = "shrinkingPanicBestTaps";
    const MAX_COMMENTS = 50;
    const SUPABASE_URL = "https://tztqtjvhaqkhfbtdtkqp.supabase.co"; // e.g. https://xxxx.supabase.co
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6dHF0anZoYXFraGZidGR0a3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTkxOTMsImV4cCI6MjA4ODAzNTE5M30.qeKAO46tBsrmqn-A9x4a2ObT6-1m7qv8VncHLmymhuI"; // Project Settings -> API -> anon public
    const SUPABASE_FEEDBACK_TABLE = "feedback_comments";
    const LEVEL1 = LEVELS[0];

    // ===== DOM Elements =====
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const hudEl = document.getElementById("hud");
    const scoreEl = document.getElementById("score");
    const bestEl = document.getElementById("best");
    const timeEl = document.getElementById("time");
    const targetEl = document.getElementById("target");
    const fillEl = document.getElementById("fill");
    const startBtn = document.getElementById("startBtn");
    const overlay = document.getElementById("overlay");
    const loseFillEl = document.getElementById("loseFill");
    const bgLayerEl = document.getElementById("bgLayer");
    const feedbackFormEl = document.getElementById("feedbackForm");
    const feedbackNameEl = document.getElementById("feedbackName");
    const feedbackTextEl = document.getElementById("feedbackText");
    const feedbackListEl = document.getElementById("feedbackList");
    const emptyCommentsEl = document.getElementById("emptyComments");
    const feedbackStatusEl = document.getElementById("feedbackStatus");

    // ===== RAF Helpers =====
    const raf = window.requestAnimationFrame
      ? window.requestAnimationFrame.bind(window)
      : function (cb) { return setTimeout(function () { cb(Date.now()); }, 16); };
    const caf = window.cancelAnimationFrame
      ? window.cancelAnimationFrame.bind(window)
      : clearTimeout;

    // ===== Runtime State =====
    const state = {
      running: false,
      taps: 0,
      bestTaps: null,
      level: 1,
      goalTime: LEVEL1.targetTime,
      levelStartTime: LEVEL1.startTime,
      timeLeft: LEVEL1.startTime,
      circles: [],
      radius: INITIAL_RADIUS,
      spawnTime: 0,
      shrinkDuration: BASE_SHRINK,
      currentShrink: BASE_SHRINK,
      lastFrameTime: 0,
      floatingTexts: [],
      perfectWaves: [],
      currentBgTrack: "",
      currentBgImage: "",
      inPrep: false,
      prepRemaining: 0,
      rafId: 0,
      comments: [],
      perfectTapCount: 0,
      hardMode: false,
      hardTapCount: 0
    };
    let supabaseClient = null;

    const bgMusic = new Audio();
    bgMusic.preload = "auto";
    bgMusic.loop = false;
    bgMusic.volume = 0.35;

    const perfectTapSfx = new Audio(PERFECT_TAP_SFX);
    perfectTapSfx.preload = "auto";
    perfectTapSfx.volume = 0.55;

    const goodTapSfx = new Audio(GOOD_TAP_SFX);
    goodTapSfx.preload = "auto";
    goodTapSfx.volume = 0.35;

    const redGameOverSfx = new Audio(RED_GAME_OVER_SFX);
    redGameOverSfx.preload = "auto";
    redGameOverSfx.volume = 0.6;

    // ===== Generic Utilities =====
    function clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }
    function rand(min, max) { return Math.random() * (max - min) + min; }
    function dist(x1, y1, x2, y2) { const dx = x1 - x2; const dy = y1 - y2; return Math.sqrt(dx * dx + dy * dy); }

    // ===== Time Formatting =====
    function formatTime(seconds) {
      const safe = Math.max(0, seconds);
      const whole = Math.floor(safe);
      const mm = String(Math.floor(whole / 60)).padStart(2, "0");
      const ss = String(whole % 60).padStart(2, "0");
      const cc = String(Math.floor((safe - whole) * 100)).padStart(2, "0");
      return mm + ":" + ss + ":" + cc;
    }

    // ===== Best Taps Persistence =====
    function loadBestTaps() {
      const raw = Number(localStorage.getItem(BEST_TAPS_KEY));
      if (!Number.isNaN(raw) && raw > 0) state.bestTaps = Math.floor(raw);
    }

    function saveBestTaps() {
      if (state.bestTaps !== null) localStorage.setItem(BEST_TAPS_KEY, String(state.bestTaps));
    }

    function setFeedbackStatus(text, isError) {
      if (!feedbackStatusEl) return;
      feedbackStatusEl.textContent = text || "";
      feedbackStatusEl.classList.toggle("error", Boolean(isError));
    }

    function initSupabase() {
      if (!window.supabase || !window.supabase.createClient) {
        setFeedbackStatus("Supabase library failed to load.", true);
        return null;
      }
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        setFeedbackStatus("Set SUPABASE_URL and SUPABASE_ANON_KEY in script.js.", true);
        return null;
      }
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    }

    function formatCommentDate(ms) {
      const d = new Date(ms);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return yyyy + "-" + mm + "-" + dd + " " + hh + ":" + min;
    }

    function escapeHtml(text) {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function renderComments() {
      if (!feedbackListEl || !emptyCommentsEl) return;
      if (state.comments.length === 0) {
        feedbackListEl.innerHTML = "";
        emptyCommentsEl.style.display = "block";
        return;
      }
      emptyCommentsEl.style.display = "none";
      const html = [];
      for (let i = 0; i < state.comments.length; i += 1) {
        const item = state.comments[i];
        html.push(
          '<li class="commentItem">'
          + '<strong class="commentAuthor">'
          + escapeHtml(item.name)
          + "</strong>"
          + "<div>" + escapeHtml(item.text) + "</div>"
          + '<span class="commentTime">' + formatCommentDate(item.createdAt) + "</span>"
          + "</li>"
        );
      }
      feedbackListEl.innerHTML = html.join("");
    }

    async function loadComments() {
      if (!supabaseClient) return;
      setFeedbackStatus("Loading comments...", false);
      const query = supabaseClient
        .from(SUPABASE_FEEDBACK_TABLE)
        .select("name,text,created_at")
        .order("created_at", { ascending: false })
        .limit(MAX_COMMENTS);
      const result = await query;
      if (result.error) {
        setFeedbackStatus("Failed to load comments: " + result.error.message, true);
        return;
      }
      const rows = Array.isArray(result.data) ? result.data : [];
      state.comments = rows.map(function (row) {
        return {
          name: row.name || "Anonymous",
          text: row.text || "",
          createdAt: Date.parse(row.created_at) || Date.now()
        };
      });
      renderComments();
      setFeedbackStatus("");
    }

    async function handleFeedbackSubmit(e) {
      e.preventDefault();
      if (!feedbackNameEl || !feedbackTextEl) return;
      if (!supabaseClient) {
        setFeedbackStatus("Supabase is not configured.", true);
        return;
      }
      const name = feedbackNameEl.value.trim();
      const text = feedbackTextEl.value.trim();
      if (!name || !text) return;
      const submitBtn = feedbackFormEl ? feedbackFormEl.querySelector('button[type="submit"]') : null;
      if (submitBtn) submitBtn.disabled = true;
      setFeedbackStatus("Sending...", false);
      const result = await supabaseClient
        .from(SUPABASE_FEEDBACK_TABLE)
        .insert({
          name: name,
          text: text
        });
      if (submitBtn) submitBtn.disabled = false;
      if (result.error) {
        setFeedbackStatus("Failed to send comment: " + result.error.message, true);
        return;
      }
      feedbackTextEl.value = "";
      setFeedbackStatus("Sent.");
      await loadComments();
    }

    // ===== Difficulty Rules =====
    function getCircleCount() {
      if (state.timeLeft > 20) return 1;
      if (state.timeLeft > 15) return 2;
      if (state.timeLeft >= 8) return 3;
      return 4;
    }

    function getRedChance() {
      return state.taps >= 10 ? BASE_RED_CHANCE : 0;
    }

    // ===== Array Shuffle =====
    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    function getLevelConfig(level) {
      return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))];
    }

    function updateShrinkAfterSuccess(reactionTime) {
      if (state.hardMode) {
        state.hardTapCount += 1;
        const hardProgress = clamp(state.hardTapCount / Math.max(1, state.goalTime), 0, 1);
        state.currentShrink = HARD_SHRINK_START - (HARD_SHRINK_START - HARD_SHRINK_GOAL) * hardProgress;
        return;
      }
      if (reactionTime < 0.5) state.currentShrink += 0.1;
      else if (reactionTime > 1.0) state.currentShrink -= 0.1;
      state.currentShrink = clamp(state.currentShrink, MIN_SHRINK, MAX_SHRINK);
    }

    // ===== HUD Rendering =====
    function updateHud() {
      scoreEl.textContent = "Taps: " + state.taps;
      bestEl.textContent = "Best Taps: " + (state.bestTaps === null ? "-" : state.bestTaps);
      timeEl.textContent = "Time Left: " + formatTime(state.timeLeft);
      if (state.hardMode) {
        targetEl.textContent = "Hard | Time " + state.levelStartTime + "s | Target " + state.goalTime + "s | Shrink 2.0->0.9";
      } else {
        targetEl.textContent = "Level " + state.level + " | Time " + state.levelStartTime + "s | Target " + state.goalTime + "s";
      }
      const ratio = clamp(state.timeLeft / state.goalTime, 0, 1);
      fillEl.style.width = (ratio * 100).toFixed(1) + "%";

      if (hudEl) {
        const levelRatio = clamp(state.timeLeft / Math.max(1, state.levelStartTime), 0, 1);
        const urgency = 1 - levelRatio;
        const goalNear = clamp((ratio - 0.7) / 0.3, 0, 1);

        const beatMsRed = 5000 - urgency * 4000; // 5s -> 1s
        const phaseRed = (performance.now() % beatMsRed) / beatMsRed;
        const waveRed = Math.sin(phaseRed * Math.PI * 2) * 0.5 + 0.5;
        const redPulse = waveRed * urgency;

        const beatMsGreen = 5000 - goalNear * 4000; // 5s -> 1s
        const phaseGreen = (performance.now() % beatMsGreen) / beatMsGreen;
        const waveGreen = Math.sin(phaseGreen * Math.PI * 2) * 0.5 + 0.5;
        const greenPulse = waveGreen * goalNear;

        const r = Math.round(clamp(6 + urgency * 120 + redPulse * 90 - greenPulse * 24, 0, 255));
        const g = Math.round(clamp(6 + goalNear * 120 + greenPulse * 95 + urgency * 8 - redPulse * 16, 0, 255));
        const b = Math.round(clamp(6 + (1 - urgency) * 18 - redPulse * 12 - greenPulse * 10, 0, 255));
        hudEl.style.backgroundColor = "rgb(" + r + ", " + g + ", " + b + ")";

        const borderR = Math.round(clamp(43 + urgency * 70 + redPulse * 55 - greenPulse * 22, 0, 255));
        const borderG = Math.round(clamp(52 + goalNear * 78 + greenPulse * 52 - redPulse * 14, 0, 255));
        const borderB = Math.round(clamp(68 - urgency * 26 - redPulse * 14 - greenPulse * 16, 0, 255));
        hudEl.style.borderBottomColor = "rgb(" + borderR + ", " + borderG + ", " + borderB + ")";
      }
    }

    function startHardMode() {
      const hardBase = Math.max(1, Math.floor(state.perfectTapCount / 4));
      const hardStartTime = hardBase;
      const hardTargetTime = hardBase * 2;
      state.hardMode = true;
      state.level = MAX_LEVEL + 1;
      state.goalTime = hardTargetTime;
      state.levelStartTime = hardStartTime;
      state.timeLeft = hardStartTime;
      state.currentShrink = HARD_SHRINK_START;
      state.hardTapCount = 0;
      state.inPrep = true;
      state.prepRemaining = PREP_TIME;
      state.circles = [];
      updateHud();
      overlay.textContent = "HARD MODE\nGet Ready: " + Math.ceil(state.prepRemaining);
      overlay.style.display = "grid";
      draw();
    }

    // ===== Level Transition =====
    function applyNextLevel() {
      if (!state.hardMode && state.level >= MAX_LEVEL) {
        startHardMode();
        return;
      }
      if (state.hardMode) {
        endGame(true);
        return;
      }
      state.level += 1;
      const levelConfig = getLevelConfig(state.level);
      state.goalTime = levelConfig.targetTime;
      state.levelStartTime = levelConfig.startTime;
      state.timeLeft = levelConfig.startTime;
      state.inPrep = true;
      state.prepRemaining = PREP_TIME;
      updateHud();
      state.circles = [];
      overlay.textContent = "LEVEL " + state.level + "\nGet Ready: " + Math.ceil(state.prepRemaining);
      overlay.style.display = "grid";
      draw();
    }

    // ===== Circle Build (Correct + Fakes) =====
    function buildCircles() {
      const count = state.taps >= 10 ? Math.max(2, getCircleCount()) : getCircleCount();
      const minCount = state.hardMode ? Math.max(2, count) : count;
      const secondBlue = state.hardMode && Math.random() < HARD_SECOND_BLUE_CHANCE;
      const redChance = getRedChance();
      const colors = shuffle(FAKE_COLORS);
      let colorIdx = 0;
      const circles = [{ x: 0, y: 0, correct: true, isRed: false, color: "#2e8fff", shakeUntil: 0 }];
      if (secondBlue) circles.push({ x: 0, y: 0, correct: true, isRed: false, color: "#2e8fff", shakeUntil: 0 });
      const fakeCount = Math.max(0, minCount - circles.length);

      for (let i = 0; i < fakeCount; i += 1) {
        const red = Math.random() < redChance;
        const color = red ? "#ff3b3b" : colors[colorIdx % colors.length];
        colorIdx += 1;
        circles.push({ x: 0, y: 0, correct: false, isRed: red, color: color, shakeUntil: 0 });
      }
      return circles;
    }

    // ===== Circle Placement (No Overlap) =====
    function placeCircles(circles) {
      const placed = [];
      const m = INITIAL_RADIUS;
      for (let i = 0; i < circles.length; i += 1) {
        let ok = false;
        for (let tries = 0; tries < 220; tries += 1) {
          const x = rand(m, WIDTH - m);
          const y = rand(HUD_HEIGHT + m, HEIGHT - m);
          let overlap = false;
          for (let j = 0; j < placed.length; j += 1) {
            if (dist(x, y, placed[j].x, placed[j].y) < INITIAL_RADIUS * 2 + 8) { overlap = true; break; }
          }
          if (!overlap) {
            circles[i].x = x;
            circles[i].y = y;
            placed.push(circles[i]);
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }
      return true;
    }

    // ===== Spawn New Circle Set =====
    function spawnCircles() {
      const circles = buildCircles();
      let ok = placeCircles(circles);
      for (let r = 0; !ok && r < 16; r += 1) ok = placeCircles(circles);
      if (!ok) circles.splice(0, circles.length, { x: WIDTH / 2, y: (HUD_HEIGHT + HEIGHT) / 2, correct: true, isRed: false, color: "#2e8fff", shakeUntil: 0 });
      state.circles = circles;
      state.spawnTime = performance.now();
      state.lastFrameTime = state.spawnTime;
      state.shrinkDuration = state.currentShrink;
      state.radius = INITIAL_RADIUS;
    }

    // ===== Floating Text Effects =====
    function addFloatingText(x, y, text, color) {
      state.floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color || "#d9efff",
        createdAt: performance.now()
      });
    }

    function drawFloatingTexts(now) {
      const lifeMs = 760;
      const keep = [];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "10px " + PIXEL_FONT;
      for (let i = 0; i < state.floatingTexts.length; i += 1) {
        const ft = state.floatingTexts[i];
        const age = now - ft.createdAt;
        if (age > lifeMs) continue;
        const t = age / lifeMs;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y - t * 32);
        keep.push(ft);
      }
      ctx.globalAlpha = 1;
      state.floatingTexts = keep;
    }

    function drawPixelCircle(x, y, r, color) {
      const step = PIXEL_SIZE;
      const rr = r * r;
      ctx.fillStyle = color;
      for (let gy = -r; gy <= r; gy += step) {
        for (let gx = -r; gx <= r; gx += step) {
          const px = gx + step * 0.5;
          const py = gy + step * 0.5;
          if (px * px + py * py <= rr) {
            const dx = Math.round((x + gx) / step) * step;
            const dy = Math.round((y + gy) / step) * step;
            ctx.fillRect(dx, dy, step, step);
          }
        }
      }
    }

    function drawPixelRing(x, y, innerR, outerR, color) {
      const step = PIXEL_SIZE;
      const inner = Math.max(0, innerR);
      const outer = Math.max(inner + step, outerR);
      const innerSq = inner * inner;
      const outerSq = outer * outer;
      const min = -outer;
      const max = outer;
      ctx.fillStyle = color;
      for (let gy = min; gy <= max; gy += step) {
        for (let gx = min; gx <= max; gx += step) {
          const px = gx + step * 0.5;
          const py = gy + step * 0.5;
          const d2 = px * px + py * py;
          if (d2 >= innerSq && d2 <= outerSq) {
            const dx = Math.round((x + gx) / step) * step;
            const dy = Math.round((y + gy) / step) * step;
            ctx.fillRect(dx, dy, step, step);
          }
        }
      }
    }

    function addPerfectWave(x, y) {
      state.perfectWaves.push({
        x: x,
        y: y,
        createdAt: performance.now()
      });
    }

    function drawPerfectWaves(now) {
      const keep = [];
      for (let i = 0; i < state.perfectWaves.length; i += 1) {
        const w = state.perfectWaves[i];
        const age = now - w.createdAt;
        if (age > PERFECT_WAVE_LIFE) continue;
        const t = age / PERFECT_WAVE_LIFE;
        const eased = 1 - Math.pow(1 - t, 3);
        const radius = PERFECT_WAVE_START_RADIUS + (PERFECT_WAVE_END_RADIUS - PERFECT_WAVE_START_RADIUS) * eased;
        const alpha = (1 - t) * 0.82;
        const ringThickness = Math.max(PIXEL_SIZE, PIXEL_SIZE * (1.8 - t * 0.8));
        drawPixelRing(
          w.x,
          w.y,
          radius - ringThickness,
          radius,
          "rgba(173, 223, 255, " + alpha.toFixed(3) + ")"
        );
        keep.push(w);
      }
      state.perfectWaves = keep;
    }

    function getNextBgTrack() {
      if (BG_TRACKS.length <= 1) return BG_TRACKS[0] || "";
      let track = BG_TRACKS[Math.floor(Math.random() * BG_TRACKS.length)];
      while (track === state.currentBgTrack) {
        track = BG_TRACKS[Math.floor(Math.random() * BG_TRACKS.length)];
      }
      return track;
    }

    function playBgMusic() {
      const track = getNextBgTrack();
      if (!track) return;
      bgMusic.src = track;
      state.currentBgTrack = track;
      bgMusic.currentTime = 0;
      bgMusic.play().catch(function () {});
    }

    function stopBgMusic() {
      bgMusic.pause();
      bgMusic.currentTime = 0;
    }

    function playSfx(audio) {
      audio.currentTime = 0;
      audio.play().catch(function () {});
    }

    function getNextBgImage() {
      if (BG_IMAGES.length <= 1) return BG_IMAGES[0] || "";
      let image = BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)];
      while (image === state.currentBgImage) {
        image = BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)];
      }
      return image;
    }

    function applyNextBackgroundImage() {
      const image = getNextBgImage();
      if (!image) return;
      state.currentBgImage = image;
      const bgValue = "url('" + image + "')";
      if (bgLayerEl) bgLayerEl.style.backgroundImage = bgValue;
      const gameEl = document.getElementById("game");
      if (gameEl) gameEl.style.backgroundImage = bgValue;
    }

    function triggerWrongTapShake(circle) {
      circle.shakeUntil = performance.now() + WRONG_TAP_SHAKE_MS;
    }

    function getShakeOffset(circle, now) {
      if (!circle.shakeUntil || now >= circle.shakeUntil) return 0;
      const remain = circle.shakeUntil - now;
      const t = remain / WRONG_TAP_SHAKE_MS;
      return Math.sin(now / WRONG_TAP_SHAKE_FREQUENCY) * WRONG_TAP_SHAKE_AMPLITUDE * t;
    }

    // ===== Main Canvas Draw =====
    function draw() {
      const now = performance.now();
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      if (!state.running && state.circles.length === 0) return;
      for (let i = 0; i < state.circles.length; i += 1) {
        const c = state.circles[i];
        const shakeX = getShakeOffset(c, now);
        const drawX = c.x + shakeX;
        if (c.correct) {
          drawPixelCircle(drawX, c.y, state.radius, "#2e8fff");
          drawPixelCircle(drawX, c.y, state.radius * GOOD_ZONE, "#58aaff");
          drawPixelCircle(drawX, c.y, state.radius * PERFECT_ZONE, "#87c4ff");
          if (state.radius > 24) {
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "8px " + PIXEL_FONT;
            ctx.fillText("+1.0s", drawX, c.y);
            if (state.radius > 34) {
              ctx.font = "7px " + PIXEL_FONT;
              ctx.fillText("+0.5s", drawX, c.y + state.radius * 0.44);
              ctx.fillText("+0.0s", drawX, c.y - state.radius * 0.68);
            }
          }
        } else {
          drawPixelCircle(drawX, c.y, state.radius, c.color);
        }
      }
      drawPerfectWaves(now);
      drawFloatingTexts(now);
    }

    // ===== Finish Screen =====
    function endGame(win) {
      state.running = false;
      caf(state.rafId);
      state.rafId = 0;
      stopBgMusic();
      if (win && (state.bestTaps === null || state.taps < state.bestTaps)) {
        state.bestTaps = state.taps;
        saveBestTaps();
      }
      updateHud();
      overlay.textContent = win
        ? "YOU WIN\nTaps: " + state.taps + "\nPerfect: " + state.perfectTapCount + "\nTime Left: " + state.timeLeft.toFixed(1) + "s"
        : "Game Over\nTaps: " + state.taps + "\nPerfect: " + state.perfectTapCount + "\nTime Left: " + state.timeLeft.toFixed(1) + "s";
      overlay.style.display = "grid";
      startBtn.textContent = "Restart";
      state.circles = [];
      draw();
      if (!win) {
        loseFillEl.classList.remove("show");
        void loseFillEl.offsetWidth;
        loseFillEl.classList.add("show");
      }
    }

    // ===== Game Loop Update =====
    function update(time) {
      if (!state.running) return;
      if (!state.lastFrameTime) state.lastFrameTime = time;
      const delta = (time - state.lastFrameTime) / 1000;
      state.lastFrameTime = time;

      if (state.inPrep) {
        state.prepRemaining -= delta;
        if (state.prepRemaining <= 0) {
          state.inPrep = false;
          overlay.style.display = "none";
          spawnCircles();
        } else {
          overlay.textContent = state.hardMode
            ? "HARD MODE\nGet Ready: " + Math.ceil(state.prepRemaining)
            : "LEVEL " + state.level + "\nGet Ready: " + Math.ceil(state.prepRemaining);
        }
        updateHud();
        draw();
        state.rafId = raf(update);
        return;
      }

      state.timeLeft -= TIMER_DRAIN_RATE * delta;
      if (state.timeLeft <= 0) { endGame(false); return; }

      const elapsed = (time - state.spawnTime) / 1000;
      const progress = elapsed / state.shrinkDuration;
      state.radius = INITIAL_RADIUS * (1 - progress);
      if (progress >= 1) {
        spawnCircles();
        draw();
        state.rafId = raf(update);
        return;
      }

      updateHud();
      draw();
      state.rafId = raf(update);
    }

    // ===== Pointer Coordinates =====
    function getPoint(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.changedTouches && e.changedTouches[0]
        ? e.changedTouches[0]
        : (e.touches && e.touches[0] ? e.touches[0] : null);
      const x = t ? t.clientX : e.clientX;
      const y = t ? t.clientY : e.clientY;
      return { x: x - rect.left, y: y - rect.top };
    }

    // ===== Click Handling =====
    function handleClick(e) {
      if (!state.running) return;
      if (state.inPrep) return;
      if (e.cancelable) e.preventDefault();
      const tapTime = performance.now();
      const p = getPoint(e);

      for (let i = 0; i < state.circles.length; i += 1) {
        const c = state.circles[i];
        const d = dist(p.x, p.y, c.x, c.y);
        if (d > state.radius) continue;

        if (c.correct) {
          let bonus = 0.0;
          let zone = "EDGE";
          if (d <= state.radius * PERFECT_ZONE) {
            bonus = 1.0;
            zone = "PERFECT";
            state.perfectTapCount += 1;
            addPerfectWave(p.x, p.y);
            playSfx(perfectTapSfx);
          } else if (d <= state.radius * GOOD_ZONE) {
            bonus = 0.5;
            zone = "GOOD";
            playSfx(goodTapSfx);
          }
          addFloatingText(p.x, p.y, zone + " +" + bonus.toFixed(1) + "s", "#d9efff");

          const reactionTime = (tapTime - state.spawnTime) / 1000;
          updateShrinkAfterSuccess(reactionTime);

          state.timeLeft = Math.min(state.timeLeft + bonus, state.goalTime);
          state.taps += 1;

          if (state.timeLeft >= state.goalTime) { applyNextLevel(); return; }
          updateHud();
          spawnCircles();
          draw();
          return;
        }

        if (c.isRed) {
          playSfx(redGameOverSfx);
          endGame(false);
          return;
        }
        triggerWrongTapShake(c);
        return; // fake color click: ignore
      }
      // empty click: ignore
    }

    // ===== Start / Restart =====
    function startGame() {
      if (!ctx) return;
      const levelConfig = getLevelConfig(1);
      state.running = true;
      state.taps = 0;
      state.level = 1;
      state.goalTime = levelConfig.targetTime;
      state.levelStartTime = levelConfig.startTime;
      state.timeLeft = levelConfig.startTime;
      state.currentShrink = BASE_SHRINK;
      state.floatingTexts = [];
      state.perfectWaves = [];
      state.perfectTapCount = 0;
      state.hardMode = false;
      state.hardTapCount = 0;
      state.inPrep = true;
      state.prepRemaining = PREP_TIME;
      state.radius = INITIAL_RADIUS;
      state.circles = [];
      playBgMusic();
      overlay.textContent = "LEVEL " + state.level + "\nGet Ready: " + Math.ceil(state.prepRemaining);
      overlay.style.display = "grid";
      startBtn.textContent = "Restart";
      updateHud();
      draw();
      caf(state.rafId);
      state.rafId = raf(update);
    }

    // ===== App Init =====
    function init() {
      if (!ctx) { overlay.textContent = "Canvas is not supported"; startBtn.disabled = true; return; }
      ctx.imageSmoothingEnabled = false;
      applyNextBackgroundImage();
      window.setInterval(applyNextBackgroundImage, BG_IMAGE_ROTATE_MS);
      bgMusic.addEventListener("ended", function () {
        if (!state.running) return;
        playBgMusic();
      });
      loadBestTaps();
      supabaseClient = initSupabase();
      if (supabaseClient) loadComments();
      updateHud();
      renderComments();
      draw();
      startBtn.addEventListener("click", startGame);
      canvas.addEventListener("click", handleClick);
      canvas.addEventListener("touchstart", handleClick, { passive: false });
      if (feedbackFormEl) feedbackFormEl.addEventListener("submit", handleFeedbackSubmit);
    }

    init();
