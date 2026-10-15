/**
 * PIVOINE — 60/120 FPS Continuous Scroll-Film Canvas Engine
 */
(() => {
  "use strict";

  const TOTAL_FRAMES = 718; // Full complete 718-frame reel
  const FRAME_PATH = "frames/f_";
  const FRAME_EXT = ".webp";
  const pad = (i) => String(i + 1).padStart(4, "0");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // DOM Elements
  const canvas = document.getElementById("film");
  const ctx = canvas.getContext("2d", { alpha: false }); // Opaque 2D context for max blit performance
  const progressBar = document.getElementById("prog");
  const veil = document.getElementById("veil");
  const veilFill = document.getElementById("veil-fill");

  // Physics & Frame State
  let curFrame = 0;
  let targetFrame = 0;
  let lastFrame = 0;
  let scrollVelocity = 0;
  let EASE_TAU = 22; // ms inertia time-constant

  // Decoded Window Cache (frameIndex -> ImageBitmap or HTMLImageElement)
  const decodedWindow = new Map();
  const pendingRequests = new Set();
  const requestQueue = []; // Prioritized decode queue [ { idx, priority } ]
  const WIN_CAP = 180; // High cache capacity for smooth playback
  const MAX_CONCURRENT_NETWORK = 16;
  let activeNetworkRequests = 0;
  let loadedCount = 0;
  let activeFrameBitmap = null; // Sticky last successfully rendered frame

  // Frame Mapping Function (from framemap.js or linear fallback)
  function mapProgressToFrame(p) {
    const isPortrait = window.innerWidth <= 820;
    const fmapArr = isPortrait ? ((window.__FMAP || {}).portrait || (window.__FMAP || {}).desktop) : (window.__FMAP || {}).desktop;
    if (!fmapArr || fmapArr.length < 2) {
      return p * (TOTAL_FRAMES - 1);
    }
    const x = clamp(p, 0, 1) * (fmapArr.length - 1);
    const k = Math.min(fmapArr.length - 2, Math.floor(x));
    const interpolated = fmapArr[k] + (fmapArr[k + 1] - fmapArr[k]) * (x - k);
    const maxMap = isPortrait ? ((window.__FMAP || {}).portrait_n || 1021) : ((window.__FMAP || {}).desktop_n || 1171);
    return clamp((interpolated / maxMap) * (TOTAL_FRAMES - 1), 0, TOTAL_FRAMES - 1);
  }

  // 1. Worker Pool with Absolute URL & Main-Thread Fallback
  const workerCode = `
    onmessage = async (e) => {
      const { id, url } = e.data;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        postMessage({ id, bmp }, [bmp]); // Zero-copy transferable
      } catch (err) {
        postMessage({ id, err: true });
      }
    };
  `;

  let workers = [];
  const WORKER_COUNT = Math.max(2, Math.min(6, navigator.hardwareConcurrency || 4));
  const pendingJobs = new Map();
  let nextJobId = 0;
  let workerIdx = 0;

  try {
    const workerBlob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(workerBlob);
    workers = Array.from({ length: WORKER_COUNT }, () => new Worker(workerUrl));

    workers.forEach((worker) => {
      worker.onmessage = (e) => {
        const { id, bmp, err } = e.data;
        const job = pendingJobs.get(id);
        if (!job) return;
        pendingJobs.delete(id);

        if (!err && bmp) {
          job.resolve(bmp);
        } else {
          job.reject();
        }
      };
    });
  } catch (_) {
    workers = [];
  }

  // Direct Main Thread Image Loader Fallback
  function decodeMainThread(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        if ('createImageBitmap' in window) {
          createImageBitmap(img).then(resolve).catch(() => resolve(img));
        } else {
          resolve(img);
        }
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function flushQueue() {
    while (activeNetworkRequests < MAX_CONCURRENT_NETWORK && requestQueue.length > 0) {
      // Sort by priority ascending (smallest distance = highest priority)
      requestQueue.sort((a, b) => a.priority - b.priority);
      const item = requestQueue.shift();
      if (!item) break;
      executeFrameDecode(item.idx);
    }
  }

  function requestFrameDecode(idx, priority = 100) {
    if (idx < 0 || idx >= TOTAL_FRAMES) return;
    if (decodedWindow.has(idx) || pendingRequests.has(idx)) return;

    // Check if already in queue
    const existing = requestQueue.find(q => q.idx === idx);
    if (existing) {
      if (priority < existing.priority) {
        existing.priority = priority;
      }
      return;
    }

    pendingRequests.add(idx);
    requestQueue.push({ idx, priority });
    flushQueue();
  }

  function executeFrameDecode(idx) {
    activeNetworkRequests++;
    const relUrl = `${FRAME_PATH}${pad(idx)}${FRAME_EXT}`;
    const absUrl = new URL(relUrl, window.location.href).href;

    let decodePromise;
    if (workers.length > 0) {
      const id = ++nextJobId;
      decodePromise = new Promise((resolve, reject) => {
        pendingJobs.set(id, { resolve, reject });
        const w = workers[workerIdx++ % workers.length];
        w.postMessage({ id, url: absUrl });
      }).catch(() => decodeMainThread(absUrl));
    } else {
      decodePromise = decodeMainThread(absUrl);
    }

    decodePromise
      .then((bmp) => {
        decodedWindow.set(idx, bmp);
        loadedCount++;
        evictStaleFrames();
        if (veilFill && loadedCount <= 20) {
          veilFill.style.width = Math.min(100, Math.round((loadedCount / 20) * 100)) + "%";
        }
        // Immediately repaint if this frame is closest or on screen
        if (Math.abs(curFrame - idx) <= 1.5 || !activeFrameBitmap) {
          drawCurrentFrame();
        }
      })
      .catch(() => {})
      .finally(() => {
        activeNetworkRequests = Math.max(0, activeNetworkRequests - 1);
        pendingRequests.delete(idx);
        flushQueue();
      });
  }

  // 2. Memory Cache Management
  function evictStaleFrames() {
    if (decodedWindow.size <= WIN_CAP) return;

    const currentIdx = Math.round(curFrame);
    while (decodedWindow.size > WIN_CAP) {
      let farthest = -1;
      let maxDist = -1;

      for (const idx of decodedWindow.keys()) {
        const dist = Math.abs(idx - currentIdx);
        if (dist > maxDist) {
          maxDist = dist;
          farthest = idx;
        }
      }

      // Never evict within a 35-frame radius of current playback
      if (farthest !== -1 && maxDist > 35) {
        const staleBmp = decodedWindow.get(farthest);
        decodedWindow.delete(farthest);
        if (staleBmp && staleBmp !== activeFrameBitmap && typeof staleBmp.close === 'function') {
          staleBmp.close(); // Explicitly free GPU memory
        }
      } else {
        break;
      }
    }
  }

  // 3. Bidirectional Adaptive Lookahead Scheduler
  function scheduleAhead() {
    const idx = Math.round(curFrame);
    const speed = Math.abs(scrollVelocity);
    const direction = targetFrame >= curFrame ? 1 : -1;
    
    // Immediate frame gets top priority (0)
    requestFrameDecode(idx, 0);

    // Lookahead span scales up during fast scroll
    const forwardSpan = Math.min(50, Math.ceil(speed * 35) + 16);
    const backwardSpan = Math.min(20, Math.ceil(speed * 12) + 8);

    // Request immediate contiguous neighborhood
    for (let offset = 1; offset <= forwardSpan; offset++) {
      requestFrameDecode(idx + offset * direction, offset);
      if (offset <= backwardSpan) {
        requestFrameDecode(idx - offset * direction, offset + 5);
      }
    }

    // When scrolling fast, request sampled keyframes across the trajectory
    if (speed > 0.05) {
      const step = Math.max(4, Math.floor(speed * 20));
      const trajectoryEnd = Math.round(targetFrame);
      for (let f = idx; direction > 0 ? f <= trajectoryEnd : f >= trajectoryEnd; f += direction * step) {
        requestFrameDecode(f, 30);
      }
    }
  }

  // 4. Canvas Blit & Cover-Fit Math
  function drawCurrentFrame() {
    const idx = Math.round(curFrame);
    let bmp = decodedWindow.get(idx);

    // Fallback to closest available neighbor in cache
    if (!bmp) {
      for (let d = 1; d <= 80; d++) {
        if (decodedWindow.has(idx - d)) { bmp = decodedWindow.get(idx - d); break; }
        if (decodedWindow.has(idx + d)) { bmp = decodedWindow.get(idx + d); break; }
      }
    }

    if (!bmp && activeFrameBitmap) {
      bmp = activeFrameBitmap;
    }

    if (!bmp) return;
    activeFrameBitmap = bmp;

    const cw = canvas.width;
    const ch = canvas.height;
    const bw = bmp.width || bmp.naturalWidth || 1928;
    const bh = bmp.height || bmp.naturalHeight || 1072;

    const scale = Math.max(cw / bw, ch / bh);
    const dw = bw * scale;
    const dh = bh * scale;

    // Responsive horizontal focal point: 0.6 on desktop leaves left column clean
    const focalX = window.innerWidth > 820 ? 0.6 : 0.5;
    const dx = (cw - dw) * focalX;
    const dy = (ch - dh) * 0.5;

    ctx.drawImage(bmp, dx, dy, dw, dh);
  }

  // 5. Canvas Resize & High-DPI Adaptation
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
    ctx.imageSmoothingEnabled = true;
    drawCurrentFrame();
  }
  window.addEventListener("resize", resizeCanvas, { passive: true });

  // 6. Continuous Render Loop with Speed Limiting (Prevents frame skidding on fast flick)
  let lastTime = performance.now();
  const MAX_FRAME_STEP_PER_FRAME = 2.5; // Max frames to advance per render tick (keeps playback smooth & visible)

  function render(time) {
    const dt = Math.min(time - lastTime, 50);
    lastTime = time;

    // Exponential Tau Smoothing with velocity clamp so frames don't flash past unseen
    const delta = targetFrame - curFrame;
    if (Math.abs(delta) > 0.001) {
      let step = delta * (1 - Math.exp(-dt / EASE_TAU));
      // Clamp rate of change so fast scroll plays through visible intermediate frames smoothly
      step = clamp(step, -MAX_FRAME_STEP_PER_FRAME, MAX_FRAME_STEP_PER_FRAME);
      curFrame += step;
    } else {
      curFrame = targetFrame;
    }

    scrollVelocity = (curFrame - lastFrame) / Math.max(1, dt);
    lastFrame = curFrame;

    scheduleAhead();
    drawCurrentFrame();

    requestAnimationFrame(render);
  }

  // 7. Lenis Smooth Scroll Setup
  let lenis = null;
  function updateScrollTarget(scrollPos) {
    const collectionEl = document.getElementById("collection");
    const maxScroll = collectionEl ? (collectionEl.offsetTop - window.innerHeight) : (document.body.scrollHeight - window.innerHeight);
    const progress = clamp(scrollPos / Math.max(1, maxScroll), 0, 1);

    targetFrame = mapProgressToFrame(progress);

    if (progressBar) {
      progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
    }
  }

  if (window.Lenis) {
    lenis = new Lenis({
      lerp: 0.08, // Smooth silky deceleration
      wheelMultiplier: 0.9,
      smoothWheel: true
    });

    lenis.on("scroll", ({ scroll }) => {
      updateScrollTarget(scroll);
    });

    function lenisLoop(time) {
      lenis.raf(time);
      requestAnimationFrame(lenisLoop);
    }
    requestAnimationFrame(lenisLoop);
  } else {
    window.addEventListener("scroll", () => {
      updateScrollTarget(window.scrollY);
    }, { passive: true });
  }

  requestAnimationFrame(render);

  // Background Preloader for Continuous Smooth Experience
  // Pre-warms frames in idle time so fast scrolling hits warm cache
  function prewarmFrames(start = 0, step = 5) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(function warm(deadline) {
        let curr = start;
        while (deadline.timeRemaining() > 3 && curr < TOTAL_FRAMES) {
          requestFrameDecode(curr, 200);
          curr += step;
        }
        if (curr < TOTAL_FRAMES) {
          requestIdleCallback(warm);
        }
      });
    }
  }
  setTimeout(() => prewarmFrames(0, 4), 1000);

  // 8. IntersectionObserver for Reveal Animations
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
  );
  document.querySelectorAll(".scene, .collection, .foot").forEach((el) => observer.observe(el));

  // 9. Startup & Initial Preload
  resizeCanvas();
  // Immediately request the first 30 frames
  for (let i = 0; i < Math.min(30, TOTAL_FRAMES); i++) {
    requestFrameDecode(i);
  }

  function revealPage() {
    if (veil) veil.classList.add("gone");
    drawCurrentFrame();
  }

  // Reveal as soon as DOM is ready or after brief 150ms timeout
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(revealPage, 150);
  } else {
    window.addEventListener("DOMContentLoaded", () => setTimeout(revealPage, 150));
  }
  setTimeout(revealPage, 500); // Safety fallback

})();
