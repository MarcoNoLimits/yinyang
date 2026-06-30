# YinYang v3 — Setup & Execution Guide

YinYang v3 is an advanced, deep-prose autonomous roleplay engine running on the `deepseek/deepseek-v4-flash` model (via OpenRouter) with a LangGraph-orchestrated multi-agent swarm backend and a responsive, immersive React frontend.

---

## 🏗️ System Architecture

The backend implements a **Context-Isolated 4-Way Agent Router** that classifies player actions and delegates them to specialized narrative nodes:

```
                  ┌──────────────────────┐
                  │     Player Action    │
                  └──────────┬───────────┘
                             │
                             ▼
               ┌───────────────────────────┐
               │  Intent Classifier Router │
               └─────────────┬─────────────┘
                             │
         ┌───────────────────┼───────────────────┬───────────────────┐
         ▼                   ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│Narrative Direct.│ │    Worldsmith   │ │PersonaBlacksmith│ │  Grand Arbiter  │
│  (Story/Prose)  │ │ (World/Quests)  │ │ (PNJ Generation)│ │ (Rules/Combat)  │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │                   │
         └───────────────────┴─────────┬─────────┴───────────────────┘
                                       │
                                       ▼
                       ┌──────────────────────────────┐
                       │ LedgerGuard (Postgres State) │
                       └──────────────────────────────┘
```

1. **🎭 Narrative Director v3**: Generates immersive French literary prose and story flow.
2. **🗺️ Worldsmith**: Creates dungeons, regions, points of interest, and custom quests.
3. **👤 Persona Blacksmith**: Models character details, NPC behaviors, and dialog patterns.
4. **⚖️ Grand Arbiter**: Adjudicates rules, processes combat states, and updates hero stats.

All states are updated in an **atomic transaction** with **Postgres advisory locks** to guarantee consistency.

---

## 🛠️ Prerequisites

Ensure you have the following installed on your system:
- **Python 3.10+** (with virtual environment support)
- **Node.js 18+** & **npm**
- **Supabase Database Project** (hosting the Postgres database)

---

## ⚙️ Configuration Setup

### 1. Backend Configuration (`SwarmService/.env`)
Create a `.env` file inside the `SwarmService/` directory:
```env
# OpenRouter API Key
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_URL=https://openrouter.ai/api/v1
MODEL_NAME=deepseek/deepseek-v4-flash

# Database Connection (Supabase PostgreSQL Connection String)
DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:6543/postgres?sslmode=require
```

### 2. Frontend Configuration (`Frontend/.env`)
Create a `.env` file inside the `Frontend/` directory:
```env
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 🚀 Running the Engine

### Step 1: Start the Backend Service (FastAPI)

1. Navigate to the `SwarmService/` folder:
   ```bash
   cd SwarmService
   ```
2. Create and activate a Python virtual environment:
   * **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   * **Linux / macOS:**
     ```bash
     python -m venv .venv
     source .venv/bin/activate
     ```
3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the FastAPI server:
   ```bash
   python main.py
   ```
   The backend service starts on **`http://localhost:8000`**.

### Step 2: Run the Verification Test Suite

Verify that the multi-agent swarm state machine, routing intent parser, and output parsing layers are fully functional by running the verification test runner:
```bash
python verify_swarm.py
```
This runs 6 unique gameplay scenarios (exploration, combat checks, continuity validation, companion emulations) against the server to check for structural accuracy and logic rules.

### Step 3: Start the Frontend Application (React)

1. Open a new terminal window and navigate to the `Frontend/` folder:
   ```bash
   cd Frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend application is now accessible at **`http://localhost:5173`**.

---

## 🕹️ Gameplay & UI Features

- **RPG Hero Resource Bars**: View real-time stats for `VITALITÉ` (red), `ENDURANCE` (green), and `RÉSERVE MAGIQUE` (blue) in the left panel.
- **Active Agent Badges**: Next to the location banner, look for badges showing which AI agent processed your action (e.g. `⚖️ ARBITRE DE JEU`, `🎭 DIRECTEUR NARRATIF`).
- **Fiche de Personnage (Character Sheet)**: Expand the right panel accordion to inspect your character's stats, level, faction, and abilities. Secret techniques are marked with `🔒` (hidden from NPCs under anti-metagaming guidelines).
- **Thought Log Debugger (Scratchpad)**: Click the header at the top of the chat panel to toggle a hidden debug log displaying the AI's private thoughts, environment rules analysis, and game master logic.
