# Pivoine — Continuous Scroll-Film Luxury Skincare

A continuous scroll-film website experience for **Pivoine Peony Renewal Cream** built with HTML5 `<canvas>`, Web Worker image decoding, Lenis smooth scroll inertia, and high-performance frame blitting.

## Features

- **Continuous Scroll-Film Engine**: 60/120 FPS frame scrubbing synchronized with scroll velocity.
- **Multi-Threaded Worker Decoding**: Off-thread image decompression with `createImageBitmap` and transferable buffers to prevent UI thread stutter.
- **Adaptive Memory Management**: Sliding window caching to guarantee 60fps scrolling without memory exhaustion.
- **Luxury Editorial Aesthetics**: APCA-tested contrast, Playfair Display & Manrope typography, breathing halo buttons, and masked text reveal animations.
- **Responsive Layout**: Designed for seamless fluid viewing across ultra-wide desktop monitors, laptops, tablets, and mobile devices.

## Tech Stack

- **HTML5 Canvas (2D Context)**
- **Vanilla Modern CSS** (Glassmorphism, custom easing curves, design tokens)
- **Vanilla JavaScript** (Worker pool, Lenis physics, dynamic framemap)
- **Vite** (Local development server)

## Getting Started

### Prerequisites

Node.js (v18+)

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Visit `http://localhost:5173/` in your browser.

## License

MIT
