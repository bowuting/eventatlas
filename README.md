# EventAtlas (Avalanche MVP)

当前仓库已打通四条核心链路：

1. 组织者发布活动与票种
2. C 端用户链上购票（TicketPass，多币支付）
3. 现场签到并铸造到场证明（AttendanceProof）
4. 仅到场可评价，评分上链（ReviewAnchor，平台代付 gas）

## 目录结构

- `apps/api`：后端 API（活动发布、票种管理、订单确认、签到、评价）
- `apps/web`：前端页面（组织者控制台、活动市场、签到中心、评价中心）
- `packages/contracts`：Solidity 合约与部署脚本
- `packages/shared`：前后端共享 ABI

## 已实现能力

### 1) 活动与票务（发布 + 购买）

- `POST /organizer/events`：创建活动（返回 `eventId`）
- `POST /organizer/events/:id/tickets`：创建票种
- 票种定价：美元 6 位精度（例如 `$12.34` => `12340000`）
- 支付币种：`AVAX` / `USDT` / `USDC`
  - `AVAX`：基于链上 AVAX/USD 预言机实时换算
  - `USDT` / `USDC`：按 1:1 美元金额（6 decimals）支付
- `POST /orders`：创建订单（支持 `paymentToken`）
- `POST /orders/confirm`：按 `txHash` 回填并确认 `TicketMinted`

### 2) 签到与到场证明（AttendanceProof）

- `POST /checkin/code`：生成一次性动态签到码（30-120 秒）
- `POST /checkin`：提交签到并链上铸造 `AttendanceProof`
- 签到校验：
  - 钱包持有活动有效票（`hasValidTicket`）
  - nonce 未使用且未过期
  - 同活动同地址不可重复签到（链上和数据库双重约束）

### 3) 评价（评分上链，内容链下）

- `POST /reviews`：提交评价
- `GET /events/:id/reviews`：获取活动评价列表
- 评价校验：
  - 必须持有 `AttendanceProof`
  - 同地址同活动只能评价一次
- 数据落地：
  - 评分 + `reviewHash` 上链（ReviewAnchor）
  - 文本/媒体等内容链下存 PostgreSQL
- Gas 支付：平台后端钱包代付（`DEPLOYER_PRIVATE_KEY`）

## 合约说明

### TicketPass

- `registerEvent`
- `setEventTimeRange`（链上活动时间）
- `configureTicketType`（USD 定价，6 decimals）
- `buyTicketWithNative`（AVAX 支付，实时换算 + 滑点保护）
- `buyTicketWithERC20`（USDT/USDC 支付）
- `quoteNativePriceWei`
- `requestRefund`（开始前 2 小时前可退，先 burn 门票）
- `cancelEvent` + `refundCanceledTicket(s)`（活动取消后全额退款）
- `setPlatformTreasury`（设置平台收款地址）
- `settleEvent`（活动结束后自动分账并直接打款：平台 5%，组织者 95%）
- `hasValidTicket(eventId, user)`（签到资格校验）

### AttendanceProof

- `mintAttendance(eventId, to)`
- `hasAttendanceProof(eventId, user)`
- 默认不可转让（SBT 风格）

### ReviewAnchor

- `submitRating(eventId, user, rating, reviewHash)`（平台代付上链）
- `hasRated(eventId, user)`
- 仅到场用户可评分，且每活动每地址只能一次评分

## 数据存储（PostgreSQL）

- `events`、`ticket_types`：业务数据 + 链上同步状态字段
- `orders`：订单与交易确认状态
- `checkin_nonces`：签到动态码与过期/使用状态
- `checkins`：签到状态、Attendance 交易哈希与 tokenId
- `reviews`：评分、评价内容、reviewHash、上链状态与交易哈希

API 启动时会自动建表与增量补字段。

### 自动结算 Worker（后端 Cron）

- 默认启用，周期扫描“已结束且未结算”的链上活动
- 自动调用 `TicketPass.settleEvent(eventId)` 完成结算并直接打款（平台 5% / 组织者 95%）
- 失败任务会记录并自动重试
- 环境变量：
  - `SETTLEMENT_WORKER_ENABLED=true|false`
  - `SETTLEMENT_WORKER_INTERVAL_MS=60000`
  - `SETTLEMENT_WORKER_BATCH_SIZE=20`

## 环境准备

1. 启用 pnpm

```bash
corepack enable
corepack prepare pnpm@9.12.0 --activate
```

2. 安装依赖

```bash
corepack pnpm install
```

3. 配置环境变量

```bash
cp .env.example .env
```

至少填写：

- `DATABASE_URL`（PostgreSQL）
- `DEPLOYER_PRIVATE_KEY`
- `AVAX_RPC_URL`（Fuji）
- `AVAX_USD_PRICE_FEED`（AVAX/USD Chainlink Feed）
- `PLATFORM_TREASURY`（可选；平台收款地址，不填默认部署者）
- `USDT_ADDRESS`
- `USDC_ADDRESS`
- `TICKET_PASS_ADDRESS`
- `ATTENDANCE_PROOF_ADDRESS`
- `REVIEW_ANCHOR_ADDRESS`
- 前端 `VITE_TICKET_PASS_ADDRESS`
- 前端 `VITE_USDT_ADDRESS`
- 前端 `VITE_USDC_ADDRESS`

4. 启动 PostgreSQL（示例）

```bash
docker run --name eventatlas-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=eventatlas \
  -p 5432:5432 \
  -d postgres:16
```

## 部署合约（Fuji）

```bash
corepack pnpm --filter @eventatlas/contracts compile
corepack pnpm --filter @eventatlas/contracts deploy:fuji:ticket
corepack pnpm --filter @eventatlas/contracts configure:fuji:ticket-payments
corepack pnpm --filter @eventatlas/contracts deploy:fuji:attendance
corepack pnpm --filter @eventatlas/contracts deploy:fuji:review
```

部署后写入 `.env`：

- `TICKET_PASS_ADDRESS=0x...`
- `ATTENDANCE_PROOF_ADDRESS=0x...`
- `REVIEW_ANCHOR_ADDRESS=0x...`
- `VITE_TICKET_PASS_ADDRESS=0x...`

## 启动开发

```bash
corepack pnpm dev
```

- API: `http://localhost:4000`
- Web: `http://localhost:5173`

## 主要接口

- `GET /health`
- `GET /events`
- `GET /events/:id`
- `POST /organizer/events`
- `POST /organizer/events/:id/tickets`
- `POST /orders`
- `POST /orders/confirm`
- `POST /checkin/code`
- `POST /checkin`
- `POST /reviews`
- `GET /events/:id/reviews`

## 下一步（建议）

- 评价签名授权（防止平台代付场景下地址冒用）
- 个人时间线 / 地图（基于 checkins + attendance）
- 链上事件订阅 worker（异步回填）
