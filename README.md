# 🔬 Coincidence Lab

A real-time, local-network (LAN) parapsychological experiment for testing coincidence, telepathy, and ESP using the classic 5-choice Zener card protocol and exact binomial probability analysis.

---

## ✨ Features

* **Strict Scientific Blinding:** The Sender focuses on the target symbol; the target is held in memory solely on the Sender device and is never transmitted over the network until after the Receiver submits their perception. Zero DevTools inspection cheating.
* **Exact Binomial Probability Analysis:** Computes mathematically exact one-tailed and two-tailed $p$-values ($p = 0.20$) using the cumulative binomial distribution—no inaccurate normal approximations for small sample sizes.
* **Psi-Hitting & Psi-Missing Detection:** Distinguishes statistically significant above-chance scores (*Psi-Hitting*) from below-chance deviations (*Psi-Missing*).
* **Collaborative Room Lobby:**
  * Connect first, then claim roles interactively in the lobby.
  * Real-time role syncing: when one player claims **Sender**, the partner is automatically assigned **Receiver**.
  * **Swap Roles ⇄** button to trade positions with one tap.
* **Configurable Session Length:** Presets for 10, 25 (classic Zener deck standard), 50, Unlimited ($\infty$), or custom trial counts.
* **Two Feedback Protocols:**
  * **Blind Run (Scored at End):** Rhine's classic experimental standard—results and scores are withheld during the run to prevent gambler's fallacy and counting bias.
  * **Immediate Feedback:** Instant hit/miss banners and audio cues after each guess for training mode.
* **Full Data Export:** Download the session report as structured **CSV** (for Excel, Google Sheets, Python/pandas) or **JSON** with full trial-by-trial ledgers and per-symbol hit rates.
* **Cross-Device & Mobile-Ready:** Designed for running between a laptop and a smartphone over local Wi-Fi, featuring Web Audio synthesis with mobile autoplay unlocking and reconnect grace periods.

---

## 🃏 Zener Symbols

| ID | Symbol | Name | Chance Probability |
|:--:|:------:|:----:|:------------------:|
| 0 | ⭕ | Circle | 20% (1 in 5) |
| 1 | ➕ | Cross | 20% (1 in 5) |
| 2 | 〰️ | Waves | 20% (1 in 5) |
| 3 | 🔲 | Square | 20% (1 in 5) |
| 4 | ⭐ | Star | 20% (1 in 5) |

---

## 🚀 Quick Start

### 1. Prerequisites
* [Node.js](https://nodejs.org/) (v16 or higher)

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Server
```bash
npm start
```

The terminal will print the local and network URLs:
```
----------------------------------------
🔬 Coincidence Lab Server Running!
----------------------------------------
On your laptop browser, open:
👉 http://localhost:3000

On your phone (same Wi-Fi), open:
👉 http://192.168.x.x:3000
----------------------------------------
```

### 4. Pair & Play
1. **Host:** Open `http://localhost:3000`, configure your session length and protocol, and click **"Create Room & Enter Lobby"**.
2. **Guest:** Open the URL on another device (or scan/open direct link `?room=CODE`), enter the room code, and click **"Join Room"**.
3. **Lobby:** Pick **Sender** or **Receiver** and click **"Start Experiment"**.

---

## 📁 Project Architecture

```
coincidence-lab/
├── server.js                      # Express static server & Socket.IO room manager
├── package.json                   # Dependencies and scripts
└── public/
    ├── index.html                 # Clean semantic HTML markup & layout
    ├── css/
    │   └── styles.css             # UI styling & custom scrollbars
    └── js/
        ├── symbols.js             # Zener symbols, scalable SVGs & cryptographic shuffle
        ├── audio.js               # Web Audio synthesizer & mobile unlock
        ├── stats.js               # Exact binomial probability PMF & p-values
        └── app.js                 # App state machine, socket relay & DOM logic
```

---

## 📜 License
ISC
