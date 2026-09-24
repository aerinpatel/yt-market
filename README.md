# 🏛️ CreatorX (YT Market) — Institutional-Grade Creator Equity Exchange

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript_5-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Socket.io_4.8-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/PostgreSQL_16-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/Prisma_6-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma 6" />
  <img src="https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

---

## 📌 Executive Summary

**CreatorX** is an event-driven, high-concurrency financial exchange that enables fractional Initial Public Offerings (IPOs) and continuous secondary market trading for YouTube creator channels. 

Unlike traditional platforms that rely on slow relational database queries to match orders, CreatorX features an **in-memory Limit Order Book (LOB) matching engine** operating inside a dedicated Node.js **Worker Thread** using **Binary Min/Max Heaps and FIFO Linked-List queues** to guarantee strict sub-millisecond **Price-Time Priority**. 

The in-memory execution core is backed by a **two-phase dual-escrow ledger in PostgreSQL**, guaranteeing atomic settlement, zero-overdraft execution, Volume-Weighted Average Price (VWAP) cost-basis accounting, price improvement refunds, and real-time [Socket.IO](https://socket.io/) market telemetry.

---

## 🏛️ System Architecture

<p align="center">
  <img src="./docs/images/architecture.png" alt="CreatorX (YT Market) System Architecture Diagram" width="100%" />
</p>

<br />

<details>
<summary><b>🔍 Click to view interactive Mermaid Source Diagram</b></summary>

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Layer (Next.js 16 App Router & React 19)"]
        UI_Terminal["Trading Terminal (/creator/[id])\n(L2 Depth Ladder & Native SVG Chart)"]
        UI_Market["Market Overview & Ticker (/market)"]
        UI_Portfolio["Portfolio & PnL Ledger (/portfolio)"]
        UI_Studio["Creator Studio (/creator-options)\n(IPO Configurator & Cap Table)"]
        WS_Client["Socket.IO Client (WebSockets)"]
    end

    subgraph ServerLayer ["Server & Gateway Layer (Node.js)"]
        ServerTS["server.ts (Custom HTTP Server)"]
        SocketServer["Socket.IO Server\n(Rooms: book:id, trades:id, global:tape, user:id)"]
        
        subgraph APIRoutes ["REST API Endpoints (/app/api)"]
            API_Orders["POST /api/orders\n(Pre-Trade Collateral Escrow)"]
            API_Cancel["DELETE /api/orders/[id]\n(Lazy Tombstone & Escrow Refund)"]
            API_IPO["POST /api/creators/ipo\n(Cap Table Allocation)"]
            API_Portfolio["GET /api/portfolio\n(Holdings & Realized PnL)"]
        end

        subgraph CoreServices ["Domain Services (/lib)"]
            YTService["youtube.ts (Direct YouTube Data API v3)"]
            ScoreEngine["scoreEngine.ts (Algorithmic Valuation)"]
            Reconcile["reconciliation.ts (Post-Trade Settlement)"]
        end
    end

    subgraph EngineLayer ["Matching Engine Subsystem (/lib/engine)"]
        MEBridge["MatchingEngine.ts (Main Thread EventEmitter & IPC Bridge)"]
        MWorker["matchingWorker.ts (Dedicated Node.js Worker Thread)"]
        OBook["OrderBook.ts (In-Memory Order Book per Creator)"]
        MinHeap["MinHeap (Asks - Lowest Price Root)"]
        MaxHeap["MaxHeap (Bids - Highest Price Root)"]
        FIFOQueue["LinkedList Queue (Strict FIFO at Price Level)"]
    end

    subgraph PersistenceLayer ["Persistence Layer (PostgreSQL 16)"]
        Prisma["Prisma ORM 6.4.1"]
        DB[(PostgreSQL Database)]
    end

    %% Client Interactions
    UI_Terminal <-->|"WebSocket: Live Depth & Trade Ticks"| WS_Client
    WS_Client <--> SocketServer
    UI_Terminal -->|"POST /api/orders"| API_Orders
    UI_Portfolio -->|"DELETE /api/orders/[id]"| API_Cancel
    UI_Studio -->|"POST /api/creators/ipo"| API_IPO

    %% Server & Gateway
    ServerTS -->|"Mounts"| SocketServer
    ServerTS -->|"Boot Hydration (FIFO Order Replay)"| Prisma

    %% Order Execution Flow
    API_Orders -->|"1. Pre-Trade Escrow ($transaction)"| Prisma
    API_Orders -->|"2. placeOrder(engineOrder)"| MEBridge
    MEBridge <-->|"Thread IPC (postMessage)"| MWorker
    MWorker --> OBook
    OBook --> MinHeap
    OBook --> MaxHeap
    MinHeap --> FIFOQueue
    MaxHeap --> FIFOQueue

    %% Event Broadcast & Settlement
    MWorker -->|"Trade & Depth Events"| MEBridge
    MEBridge -->|"Broadcast"| SocketServer
    MEBridge -->|"Matched Trades"| Reconcile
    Reconcile -->|"3. Post-Trade Double-Entry Settlement"| Prisma
    Prisma --> DB

    %% Valuation Pipeline
    API_IPO -->|"Fetch Metrics"| YTService
    YTService --> ScoreEngine
    ScoreEngine -->|"Initial Valuation"| API_IPO
```
</details>

---

## 🔬 Low-Level Design (LLD) & Data Structures

### 1. In-Memory Order Book Data Structures (`lib/engine/`)

The matching engine maintains a dedicated `OrderBook` instance for every active creator in memory.

```
       BIDS (MaxHeap)                           ASKS (MinHeap)
  Root: Highest Buy Price                   Root: Lowest Sell Price
        [ $10.50 ]                                [ $10.60 ]
       /          \                              /          \
   [ $10.40 ]    [ $10.30 ]                  [ $10.70 ]    [ $10.80 ]
       |             |                           |             |
   FIFO Queue    FIFO Queue                  FIFO Queue    FIFO Queue
   [Ord1, Ord2]     [Ord3]                      [Ord4]    [Ord5, Ord6]
```

* **Price Level Priority via Binary Heaps (`Heap.ts`)**:
  * **Bids** are stored in a **`MaxHeap`**: Root contains the highest buyer ($O(1)$ peek).
  * **Asks** are stored in a **`MinHeap`**: Root contains the lowest seller ($O(1)$ peek).
  * Inserting or removing a price level executes in $O(\log K)$ where $K$ is the number of distinct price levels.
* **Price-Time Priority (FIFO Queue at Price Level)**:
  * Each price node in the heap contains a doubly-linked **`Queue<Order>`**.
  * If two orders arrive at the exact same price, the order that arrived earlier executes first ($O(1)$ enqueue, $O(1)$ dequeue).
* **Instant Price Level Lookup (`keyMap`)**:
  * An in-memory `Map<number, HeapNode<T>>` provides $O(1)$ lookup to verify if a price node already exists before triggering heap allocations.
* **$O(1)$ Lazy Tombstone Cancellation**:
  * Deleting an arbitrary node from a binary heap is an expensive $O(N)$ operation requiring heap restructuring.
  * Instead, cancellation flags `order.isCancelled = true` in $O(1)$. When the matching engine or depth aggregator traverses the book, it lazily prunes tombstones without blocking the match cycle.
* **Self-Trade Prevention (STP)**:
  * Before matching opposing orders, the engine checks: `buyOrder.userId === sellOrder.userId`.
  * If identical, the resting order is cancelled immediately to prevent wash trading, returned to the main thread for collateral refund, and an alert is pushed to `user:${userId}`.

---

### 2. Multi-Threaded Concurrency Model

Node.js operates on a single-threaded event loop. High-frequency matching involving deep order sweeps or multi-level fills can monopolize CPU cycles, causing WebSocket dropouts and delayed HTTP responses.

```mermaid
sequenceDiagram
    autonumber
    participant Main as Main Thread (MatchingEngine.ts)
    participant Worker as Worker Thread (matchingWorker.ts)
    participant Book as OrderBook (In-Memory Heap)

    Main->>Worker: parentPort.postMessage({ type: 'PLACE_ORDER', order, correlationId })
    Note over Worker: Non-blocking OS thread execution
    Worker->>Book: book.placeOrder(order)
    Book-->>Worker: { trades, stpCancelledOrders }
    Worker-->>Main: parentPort.postMessage({ type: 'SUCCESS', data, correlationId })
    Main-->>Main: resolve(correlationId) & emit('trade', trades)
```

* **Worker Thread Isolation (`matchingWorker.ts`)**:
  All heap mutations and queue dequeues execute on a dedicated OS thread spawned via Node.js `worker_threads`.
* **Asynchronous IPC Message Bus**:
  Requests between the main thread and worker thread use a unique `correlationId` tracked in an in-memory `Map<string, { resolve, reject, timer }>`.
* **Fault Tolerance & Graceful Degradation**:
  If the worker thread encounters an uncaught exception or terminates unexpectedly, `MatchingEngine.ts` catches the failure, restarts the worker thread, and temporarily falls back to local synchronous execution (`localExecute`) so trades never halt.

---

### 3. Financial Custody & Dual-Escrow Settlement (`reconciliation.ts`)

In an exchange, **collateral must be guaranteed before an order ever enters the matching engine**.

```mermaid
flowchart TD
    subgraph Phase1 ["Phase 1: Pre-Trade Collateral Escrow (orders/route.ts)"]
        CheckBalance{"Check Collateral\nin PostgreSQL"}
        CheckBalance -- BUY --> DebitCash["Decrement walletBalance: (price * quantity)"]
        CheckBalance -- SELL --> DebitShares["Decrement holding.quantity: quantity"]
        CheckBalance -- Insufficient --> Rollback["Rollback (HTTP 400 Insufficient Funds)"]
        DebitCash --> InsertOrder["INSERT Order (status: 'OPEN')"]
        DebitShares --> InsertOrder
    end

    subgraph Phase2 ["Phase 2: In-Memory Matching (matchingWorker.ts)"]
        InsertOrder --> Match["Heap Match @ Maker Execution Price"]
    end

    subgraph Phase3 ["Phase 3: Post-Trade Settlement (reconciliation.ts)"]
        Match --> WriteTrade["INSERT Trade (Immutable execution log)"]
        WriteTrade --> UpdateBuyer["Upsert Buyer Holding (Volume-Weighted Avg Cost)"]
        UpdateBuyer --> PriceImprovement{"Executed Price < Buy Limit Price?"}
        PriceImprovement -- Yes --> Refund["Credit Buyer walletBalance with (Limit - Executed) * Qty"]
        PriceImprovement -- No --> SettleSeller
        Refund --> SettleSeller["Credit Seller walletBalance with (ExecutedPrice * Qty)"]
        SettleSeller --> LogPnL["INSERT RealizedPnL (Immutable tax & audit record)"]
        LogPnL --> UpdateOrder["UPDATE Orders: remainingQuantity -= Qty (PARTIAL/FILLED)"]
    end
```

#### A. Pre-Trade Escrow Invariants
* **Buy Orders**: `user.walletBalance` is decremented by `price * quantity` inside an ACID `prisma.$transaction`. Naked buying and overdrafts are mathematically impossible.
* **Sell Orders**: `holding.quantity` is decremented by `quantity` inside the transaction. Naked short selling is eliminated.
* **Position Limit**: Enforces a strict cap preventing any single investor from holding more than 5% of a creator's public float.

#### B. Post-Trade Double-Entry Reconciliation
* **Volume-Weighted Average Price (VWAP) Cost Basis**:
  When a buyer acquires shares in multiple tranches, their cost basis updates using:

  $$\text{New Avg Buy Price} = \frac{(Q_{\text{prev}} \times P_{\text{prev}}) + (Q_{\text{trade}} \times P_{\text{trade}})}{Q_{\text{prev}} + Q_{\text{trade}}}$$

* **Maker-Taker Pricing & Price Improvement Refund**:
  Trades always execute at the **Maker's price** (the resting order already in the book). If a buyer places a Limit Buy at **$20.00** and matches an ask resting at **$15.00**, the trade settles at $15.00. The $5.00/share difference is immediately credited back to the buyer's `walletBalance`:

  $$\text{Refund Amount} = (P_{\text{limit}} - P_{\text{executed}}) \times Q_{\text{trade}}$$

* **Immutable Realized PnL Ledger**:
  When shares are liquidated, profit/loss is calculated and written to an immutable `RealizedPnL` record:

  $$\text{Realized PnL} = (P_{\text{sell}} - P_{\text{cost}}) \times Q_{\text{sold}}$$

  *Why a dedicated table?* Because `Holding.avgBuyPrice` changes upon subsequent purchases, calculating past profit on the fly from current holding state corrupts historical tax records. An append-only ledger guarantees historical auditability.

---

### 4. Algorithmic Valuation Engine (`lib/scoreEngine.ts`)

Channels are tokenized and initially priced based on verified performance metrics fetched via the YouTube Data API v3.

$$\text{Base Score} = (\text{Subs} \times 0.50) + (\text{Total Views} \times 0.01) + (\text{Video Count} \times 50)$$

* **Economic Rationale**:
  * **$0.50 / Subscriber**: Reflects lifetime organic subscriber enterprise value.
  * **$0.01 / View**: Approximates historical ad inventory yield based on an average $10 RPM.
  * **$50.00 / Video**: Capitalizes evergreen back-catalog video assets.
* **Suggested IPO Pricing**:

  $$\text{Suggested Valuation} = \max(10000, \, \text{Base Score} \times 0.05)$$

  $$\text{IPO Share Price} = \frac{\text{Suggested Valuation}}{10000 \text{ Float Shares}}$$

---

### 5. Real-Time Telemetry & Socket Room Topology (`server.ts`)

To prevent client packet floods and eliminate expensive database polling, CreatorX uses a unified HTTP and WebSocket server running a single TCP connection per client divided into isolated [Socket.IO](https://socket.io/) rooms:

| Room Topic | Emitted Payload | Update Frequency | Purpose |
| :--- | :--- | :--- | :--- |
| **`book:${creatorId}`** | `OrderBookSnapshot` (Top 10 bids/asks) | On limit order placement, match, or cancellation | Renders visual depth ladder |
| **`trades:${creatorId}`** | Lightweight `Trade` tick (~80 bytes) | On matched execution | Flashes terminal header & updates price curve |
| **`global:tape`** | Aggregated `GlobalTrade` tick with channel name | On any trade across all creators | Drives real-time `/market` overview tape |
| **`user:${userId}`** | `stp_alert` / private fill notifications | On user-specific events | Private alerts without leaking data to public |

---

## 📊 Database Schema & Financial Invariants

```mermaid
erDiagram
    User ||--o{ Holding : "owns"
    User ||--o{ Order : "places"
    User ||--o{ RealizedPnL : "realizes"
    Creator ||--o{ Holding : "issued to"
    Creator ||--o{ Order : "order book for"
    Creator ||--o{ Trade : "executions in"
    Order ||--o{ Trade : "matched into"
    Holding ||--o{ RealizedPnL : "liquidated from"
    Trade ||--o| RealizedPnL : "triggers"

    User {
        String id PK
        String email UK
        Decimal walletBalance "Decimal(14,2) Exact Precision"
    }

    Creator {
        String id PK
        String youtubeChannelId UK
        BigInt totalShares
        BigInt floatShares "Public circulating equity"
        BigInt ownerShares "Creator retained equity"
        Decimal ipoPrice "Decimal(10,2)"
        IpoStatus ipoStatus "PENDING | LISTED | DELISTED"
    }

    Holding {
        String id PK
        String userId FK
        String creatorId FK
        BigInt quantity "Unencumbered shares"
        Decimal avgBuyPrice "Weighted Average Cost Basis"
        Decimal lowestBuyPrice "Analytical Lifetime Low"
        Decimal highestBuyPrice "Analytical Lifetime High"
    }

    Order {
        String id PK
        String userId FK
        String creatorId FK
        OrderSide side "BUY | SELL"
        OrderType type "LIMIT | MARKET"
        Decimal price "Limit price (null for Market)"
        BigInt quantity
        BigInt remainingQuantity "Active resting collateral"
        OrderStatus status "OPEN | PARTIAL | FILLED | CANCELLED"
    }

    Trade {
        String id PK
        String buyOrderId FK
        String sellOrderId FK
        Decimal price "Executed maker price"
        BigInt quantity
        DateTime executedAt
    }

    RealizedPnL {
        String id PK
        String tradeId FK "Unique audit constraint"
        Decimal avgCostAtSale
        Decimal sellPrice
        BigInt quantity
        Decimal pnl "Decimal(14,2)"
    }
```

### Key Schema Design Decisions
1. **Arbitrary-Precision Decimals (`@db.Decimal(14, 2)`)**:
   Standard IEEE 754 floating point numbers (`Float` / `Double`) suffer from binary representation errors (`0.1 + 0.2 !== 0.3`). In financial systems, this causes balance leaks. All cash and share prices use PostgreSQL arbitrary-precision base-10 decimals.
2. **64-bit BigInt for Quantities (`BigInt`)**:
   Standard 32-bit signed integers cap at $2.14 \times 10^9$. For high-volume fractional shares and YouTube view metrics, `BigInt` prevents arithmetic integer overflow.
3. **Composite Hydration Index**:
   `@@index([creatorId, side, status, price])` on the `Order` table allows instant chronological rehydration of open orders during crash recovery.

---

## 📈 Current Project Phase & Maturity Status

| Phase | Milestone | Scope & Core Deliverables | Status |
| :---: | :--- | :--- | :---: |
| **Phase 1** | **Core DSA & Engine** | Custom Min/Max Binary Heaps, FIFO Linked List queues, $O(1)$ lazy tombstone cancellation, Self-Trade Prevention (STP). | ✅ **Complete** |
| **Phase 2** | **Worker Concurrency** | Dedicated `worker_threads` matching loop, asynchronous IPC message protocol, crash recovery boot hydration. | ✅ **Complete** |
| **Phase 3** | **Financial Custody** | PostgreSQL dual-escrow, atomic order cancellation, post-trade double-entry settlement, price improvement refund, immutable Realized PnL ledger. | ✅ **Complete** |
| **Phase 4** | **Valuation & IPO** | YouTube Data API v3 integration with timeout resilience, algorithmic channel valuation, creator float/owner cap table allocation. | ✅ **Complete** |
| **Phase 5** | **Real-Time Telemetry & UI** | Unified Socket.IO server with room topology, L2 depth ladder, live trade ticker, native SVG area & candlestick charts with snapping crosshairs. | ✅ **Complete** |
| **Phase 6** | **Distributed Scaling** | Horizontal scaling via Redis Pub/Sub, Kafka asynchronous ledger settlement, engine sharding by `creatorId`. | 🔄 **Architected / Planned** |

---

## ⚡ System Design Analysis: Scalability Bottlenecks & Roadmap

The table below outlines the exact failure points of the current architecture under increasing traffic loads, and the engineering interventions required to scale to 10 million users:

```
[Level 1: 1k Users] ──► [Level 2: 10k Users] ──► [Level 3: 100k Users] ──► [Level 4: 1M Users] ──► [Level 5: 10M Users]
  PgBouncer Pool          Redis Pub/Sub            Kafka Async Settle       In-Memory Wallets        Edge Conflation
  Single-Query CTE        Read Replicas            Engine Sharding          Raft WAL Consensus       Tick Throttling
```

### 1. Level 1: 0 to 1,000 Concurrent Users (~100 TPS) — *Current System*
* **Primary Bottleneck**: **PostgreSQL Connection Pool Exhaustion.**
* **Root Cause**: `app/api/orders/route.ts` executes an interactive transaction across 4 sequential network round-trips over TCP. At 15ms latency to cloud DB, each order holds a connection for ~75ms. Prisma’s default pool (10 connections) saturates under 150 concurrent requests, triggering 15-second `maxWait` timeouts.
* **Solution**: Place **PgBouncer** in front of PostgreSQL; collapse the 4 Prisma queries into a single atomic PostgreSQL Stored Procedure or Common Table Expression (CTE).

### 2. Level 2: 10,000 Concurrent Users (~1,000 TPS)
* **Primary Bottleneck**: **Single-Node Socket.IO Memory & Row-Level Lock Deadlocks.**
* **Root Cause**: 10,000 open WebSockets in a single Node.js heap consume ~500MB RAM, causing event loop tick latency during large broadcasts. Concurrently, hundreds of orders updating the same creator's `Holding` records cause PostgreSQL row-lock deadlocks (`40P01: Deadlock detected`).
* **Solution**: Scale horizontally across multiple web instances using **`@socket.io/redis-adapter`**; split database traffic using PostgreSQL **Read Replicas** for SSR pages.

### 3. Level 3: 100,000 Concurrent Users (~10,000 TPS)
* **Primary Bottleneck**: **Single Worker Thread & Synchronous Database Write Throughput.**
* **Root Cause**: A single worker thread processes orders sequentially for all creators. At 10,000 orders/sec, the thread message queue backs up. Simultaneously, synchronous PostgreSQL disk writes (Write-Ahead Logging) cannot keep pace.
* **Solution**:
  1. **Shard the Matching Engine by `creatorId`**: Since trading in Creator A is independent of Creator B, partition order books across worker threads using consistent hashing: `Worker ID = hash(creatorId) % N`.
  2. **Asynchronous Ledger via Apache Kafka**: Decouple order execution from database writes. The matching engine emits matched trades to a Kafka topic (`trades.executed`). Dedicated consumer workers batch-insert records into PostgreSQL in bulk.

### 4. Level 4: 1,000,000 Concurrent Users (~50,000 – 100,000 TPS)
* **Primary Bottleneck**: **Synchronous Pre-Trade Database Escrow.**
* **Root Cause**: Querying PostgreSQL to check and lock user wallet balances before matching creates a hard I/O ceiling.
* **Solution (The LMAX / Binance Exchange Pattern)**: Move the **Escrow Vault into In-Memory Distributed State (Redis Cluster / Aerospike)**. User balances are locked in RAM in microseconds, backed by an append-only replicated Write-Ahead Log (WAL) with Raft consensus. PostgreSQL is demoted to a cold archival warehouse for end-of-day reconciliation.

### 5. Level 5: 10,000,000 Users (Hyper-Scale / Exchange Scale)
* **Primary Bottleneck**: **WebSocket Egress Bandwidth (Fan-Out Explosion).**
* **Root Cause**: 500,000 users watching a viral creator chart means a 100-byte trade tick requires 500,000 × 100 bytes = **50 MB per trade**. At 50 trades/sec, network egress hits **2.5 GB/sec**, melting network interfaces.
* **Solution**:
  1. **100ms Tick Conflation**: Batch all trade executions and order book modifications occurring in a 100ms window into a single compressed frame, reducing bandwidth by 85–90%.
  2. **Edge Market-Data Gateways**: Terminate WebSockets at the edge using Cloudflare Workers or AWS API Gateway distributed across 200+ global edge locations.
  3. **Database Sharding**: Horizontally partition PostgreSQL across clusters using Citus or CockroachDB.

---

## 🛠️ Technology Stack Breakdown

| Layer | Technology | Primary Rationale & Architectural Responsibility |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16 (App Router)** | Server-Side Rendering (SSR) for SEO and low Initial Server Response times. |
| **UI Library** | **React 19** | Concurrent rendering, Server Components, and zero-bundle hydration. |
| **Language** | **TypeScript 5** | Strict end-to-end type safety between database schema, engine, and frontend. |
| **Real-Time Telemetry** | **Socket.IO 4.8** | Low-overhead WebSocket streaming with automatic fallback and channel room isolation. |
| **Matching Engine** | **Node.js `worker_threads`** | Decoupling compute-heavy heap operations from the main Node.js event loop. |
| **Database & ORM** | **PostgreSQL 16 + Prisma 6** | ACID compliance, row-level write locks, `Decimal(14,2)` monetary accuracy. |
| **Styling** | **Tailwind CSS v4** | High-performance compiled CSS tokens for low-latency terminal rendering. |
| **External Integration**| **YouTube Data API v3** | Direct HTTP ingestion with `AbortSignal.timeout(3500)` fallback resilience. |
| **Containerization** | **Docker & Docker Compose** | Reproducible local and staging database environments. |

---

## 🚀 Local Development Setup

### Prerequisites
* **Node.js**: `v20.x` or later
* **npm**: `v10.x` or later
* **Docker & Docker Compose** (Optional for local PostgreSQL)

### 1. Clone the Repository
```bash
git clone https://github.com/aerinpatel/YT_market_main.git
cd YT_market_main/my-app
```

### 2. Configure Environment Variables
Create a `.env` file in the `my-app` directory:
```ini
# Database Connection (Neon Cloud or Local Docker)
DATABASE_URL="postgresql://postgres:mysecretpassword@localhost:5432/yt_push_db?schema=public"
DIRECT_URL="postgresql://postgres:mysecretpassword@localhost:5432/yt_push_db?schema=public"

# YouTube Data API Key
YOUTUBE_API_KEY="your-google-api-key"

# Authentication Secret
JWT_SECRET="super-secure-production-jwt-secret-key-32-chars"

# Server Configuration
PORT=3000
NODE_ENV="development"
```

### 3. Start Local PostgreSQL (via Docker)
```bash
docker compose up -d
```

### 4. Install Dependencies & Push Schema
```bash
npm install
npx prisma generate
npx prisma db push
```

### 5. Launch the Custom Trading Server
```bash
npm run dev
```
The server will hydrate open orders from PostgreSQL and start on `http://localhost:3000`.

---

## 🧪 Testing & Verification

Run the test suite to validate the matching engine, order book priority queues, and self-trade prevention logic:

```bash
# Run unit tests on matching engine and heaps
npm run test:engine

# Verify TypeScript compilation across the entire project
npx tsc --noEmit

# Run full Next.js production build verification
npm run build
```

---

## 📄 License & Attribution

Distributed under the MIT License. Built by [Aerin Patel](https://github.com/aerinpatel) as an exploration into high-performance financial systems, algorithmic order matching, and real-time event-driven architecture.
