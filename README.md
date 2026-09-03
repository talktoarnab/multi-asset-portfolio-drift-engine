# Multi-Asset Portfolio Drift Engine

The **Multi-Asset Portfolio Drift Engine** is a specialized, production-grade FinTech SaaS designed for self-directed retail investors and FIRE (Financial Independence, Retire Early) practitioners. It automates the tracking of asset allocation drift and calculates precise, tax-efficient rebalancing recommendations across diverse asset classes (e.g., standard equity index funds paired with gold/silver ETF hedges).

---

## 🚀 Key Features

1. **Automated Drift Tracking**: Calculates exact percentage deviation from target asset allocations as market prices fluctuate.
2. **Standard Rebalancing (Buy & Sell)**: Generates precise buy/sell order recommendations to bring portfolios back to perfect target weights.
3. **Cash-Injection Rebalancing (Buy-Only)**: Implements a highly accurate **greedy water-filling algorithm** to allocate new cash to under-allocated assets, avoiding capital gains taxes by avoiding asset sales.
4. **Scheduled Monitoring & Alerts**: Automatically evaluates portfolio drift daily via a serverless cron, recording historical drift snapshots and dispatching high-quality HTML email alerts via Amazon SES when drift exceeds user-defined thresholds.
5. **Robust Local Mock Fallback**: The entire frontend and backend can run 100% locally and offline using simulated services (LocalStorage and random-walk mock prices), making local development and testing painless.

---

## 📐 Mathematical Engine

### 1. Drift Calculation
For a portfolio with $N$ assets, let:
- $Q_i$ be the quantity of asset $i$
- $P_i$ be the current unit price of asset $i$
- $W_i^{\text{target}}$ be the target weight of asset $i$ (where $\sum_{i=1}^N W_i^{\text{target}} = 1.0$)

The current value of asset $i$ is:
$$V_i = Q_i \times P_i$$

The total portfolio value is:
$$V_{\text{total}} = \sum_{i=1}^N V_i$$

The current weight of asset $i$ is:
$$W_i^{\text{current}} = \frac{V_i}{V_{\text{total}}}$$

The drift of asset $i$ is:
$$\text{Drift}_i = W_i^{\text{current}} - W_i^{\text{target}}$$

The total absolute portfolio drift is calculated as:
$$\text{Drift}_{\text{total}} = \sum_{i=1}^N \left| W_i^{\text{current}} - W_i^{\text{target}} \right|$$

If $\text{Drift}_{\text{total}} > \text{Threshold}$ (e.g., 5%), an email alert is triggered.

---

### 2. Rebalancing Algorithms

#### Mode A: Standard Rebalance (Sell & Buy)
Calculates the exact buy/sell transactions to bring the portfolio back to perfect target weights.
The target value for asset $i$ is:
$$V_i^{\text{target}} = V_{\text{total}} \times W_i^{\text{target}}$$

The required value adjustment is:
$$\Delta V_i = V_i^{\text{target}} - V_i$$

The required transaction is:
- If $\Delta V_i > 0$: **BUY** $\Delta Q_i = \frac{\Delta V_i}{P_i}$ shares.
- If $\Delta V_i < 0$: **SELL** $\Delta Q_i = \frac{|\Delta V_i|}{P_i}$ shares.

---

#### Mode B: Cash-Injection Rebalance (Buy-Only / Tax-Efficient)
Solves the constrained optimization problem of allocating a cash injection $C$ to bring the portfolio as close as possible to target weights without selling any assets:
$$\text{Minimize } \sum_{i=1}^N \left( \frac{V_i + \Delta V_i}{V_{\text{total}} + C} - W_i^{\text{target}} \right)^2$$
Subject to:
1. $\Delta V_i \ge 0$ (no selling)
2. $\sum_{i=1}^N \Delta V_i = C$

This is solved using a **greedy water-filling algorithm**:
1. Initialize $\Delta V_i = 0$ for all $i$, and remaining cash $R = C$.
2. Define a small allocation step size $S = \min(1.0, C / 1000)$.
3. While $R \ge S$:
   - Find the asset $j$ that is furthest below its target weight, i.e., maximizes:
     $$D_i = W_i^{\text{target}} - \frac{V_i + \Delta V_i}{V_{\text{total}} + C}$$
   - Allocate $S$ to asset $j$: $\Delta V_j \leftarrow \Delta V_j + S$, and decrement remaining cash: $R \leftarrow R - S$.
4. Allocate any remaining microscopic cash $R$ to the asset with the largest remaining deficit.
5. Calculate recommended buy quantities: $\Delta Q_i = \frac{\Delta V_i}{P_i}$.

---

## ☁️ Serverless AWS Architecture

- **Frontend Layer**: React / Vite Single Page Application (SPA) hosted on **Amazon S3** and distributed globally via **Amazon CloudFront** with Origin Access Control (OAC).
- **API Layer**: **Amazon API Gateway** handling secure REST endpoints for user configuration and portfolio setup.
- **Compute Layer**: **AWS Lambda** (Python 3.10) executing core math, portfolio CRUD operations, and cron-triggered evaluations.
- **Scheduler**: **Amazon EventBridge** triggering the daily portfolio health-check Lambda function.
- **Database Layer**: **Amazon DynamoDB** using a Single-Table Design for users, portfolios, holdings, and historical snapshots.
- **Security**: **AWS Secrets Manager** for third-party financial API keys; JWT-based user authentication.

---

## 📂 Project Structure

```
multi-asset-portfolio-drift-engine/
├── .github/
│   └── workflows/
│       ├── lint.yml            # Lint & validate Terraform on PRs
│       ├── plan.yml            # Preview AWS changes on PRs
│       └── deploy.yml          # Provision AWS & deploy React frontend on merge to main
├── terraform/
│   ├── providers.tf            # AWS provider configuration
│   ├── variables.tf            # Input variables (region, environment, secrets)
│   ├── dynamodb.tf             # DynamoDB Single-Table schema
│   ├── s3_cloudfront.tf        # S3 bucket & CloudFront distribution with OAC
│   ├── lambda_api.tf           # Lambda functions, IAM roles, API Gateway REST API
│   ├── scheduler.tf            # EventBridge daily cron rule
│   └── outputs.tf              # CloudFront URL, API Gateway URL, etc.
├── backend/
│   ├── requirements.txt        # Python backend dependencies
│   ├── common/
│   │   ├── __init__.py
│   │   ├── db.py               # DynamoDB CRUD operations with Decimal/Float converters
│   │   ├── math_engine.py      # Core drift & rebalancing algorithms
│   │   ├── financial_api.py    # Yahoo Finance price fetcher with mock fallback
│   │   ├── auth.py             # JWT token signing & secure PBKDF2 password hashing
│   │   └── api_utils.py        # API Gateway proxy response & auth helpers
│   ├── api/
│   │   ├── auth_handler.py     # Register, Login, JWT settings
│   │   ├── portfolio_handler.py# Portfolio & Holding CRUD
│   │   └── rebalance_handler.py# On-demand drift & rebalance calculations
│   └── cron/
│       └── daily_evaluator.py  # Daily EventBridge cron, price update, snapshot, SES alert
└── frontend/
    ├── package.json            # React, Vite, Tailwind, Lucide dependencies
    ├── vite.config.ts          # Vite configuration
    ├── tsconfig.json           # TypeScript configuration
    ├── tailwind.config.js      # Tailwind CSS setup
    ├── postcss.config.js       # PostCSS setup
    ├── index.html              # Main HTML entry
    └── src/
        ├── main.tsx            # React mount entry
        ├── App.tsx             # Main application state & screen routing
        ├── index.css           # Global Tailwind directives
        ├── components/
        │   ├── AuthScreen.tsx  # Beautiful login & registration
        │   ├── Dashboard.tsx   # Portfolios list, summary cards, interactive SVG charts
        │   ├── PortfolioManager.tsx # Interactive holdings editor (target weights sum to 100%)
        │   ├── RebalanceCalculator.tsx # Side-by-side standard & cash-injection rebalancer
        │   └── AlertSettings.tsx # Threshold & notification settings
        └── utils/
            ├── api.ts          # API client with LocalStorage mock backend fallback
            └── math.ts         # Currency, percent, and date formatting helpers
```

---

## 🛠️ Local Development & Testing

### 1. Run the Frontend (100% Offline with Simulated Backend)
The frontend contains a full-fidelity simulated backend. If no API Gateway URL is configured, it automatically falls back to LocalStorage persistence and realistic random-walk price feeds!

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. You can immediately register, create portfolios, add holdings, see interactive SVG charts, and calculate rebalancing recommendations!

---

### 2. Test the Python Backend Core & Daily Evaluator
You can run the backend core and daily evaluator locally using the built-in Mock Database fallback:

```bash
cd backend
# Create virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run the daily evaluator cron script locally
MOCK_DB=true python cron/daily_evaluator.py
```

---

## 🚀 Deployment to AWS

### 1. Provision Infrastructure using Terraform
Ensure you have configured your AWS CLI credentials, then run:

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

This will provision all serverless AWS resources and output the `frontend_url` and `api_url`.

### 2. Deploy the Frontend
Build and sync the frontend static assets to S3, injecting the deployed API Gateway URL:

```bash
cd frontend
VITE_API_URL="<YOUR_API_URL_FROM_TERRAFORM_OUTPUT>" npm run build
aws s3 sync dist/ s3://<YOUR_S3_BUCKET_FROM_TERRAFORM_OUTPUT> --delete
aws cloudfront create-invalidation --distribution-id <YOUR_CLOUDFRONT_ID_FROM_TERRAFORM_OUTPUT> --paths "/*"
```
