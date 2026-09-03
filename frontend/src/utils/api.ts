/// <reference types="vite/client" />
// API Client with robust LocalStorage-backed Mock Fallback for local development

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Helper to get auth headers
const getHeaders = () => {
  const token = localStorage.getItem('PDE_TOKEN');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

// --- MOCK DATABASE AND LOGIC (FALLBACK) ---
const getMockUser = () => {
  const userStr = localStorage.getItem('PDE_MOCK_USER');
  return userStr ? JSON.parse(userStr) : null;
};

const saveMockUser = (user: any) => {
  localStorage.setItem('PDE_MOCK_USER', JSON.stringify(user));
};

const getMockPortfolios = (): any[] => {
  const pStr = localStorage.getItem('PDE_MOCK_PORTFOLIOS');
  return pStr ? JSON.parse(pStr) : [];
};

const saveMockPortfolios = (portfolios: any[]) => {
  localStorage.setItem('PDE_MOCK_PORTFOLIOS', JSON.stringify(portfolios));
};

const getMockHoldings = (portfolioId: string): any[] => {
  const hStr = localStorage.getItem(`PDE_MOCK_HOLDINGS_${portfolioId}`);
  return hStr ? JSON.parse(hStr) : [];
};

const saveMockHoldings = (portfolioId: string, holdings: any[]) => {
  localStorage.setItem(`PDE_MOCK_HOLDINGS_${portfolioId}`, JSON.stringify(holdings));
};

const getMockSnapshots = (portfolioId: string): any[] => {
  const sStr = localStorage.getItem(`PDE_MOCK_SNAPSHOTS_${portfolioId}`);
  if (sStr) return JSON.parse(sStr);
  
  // Generate some realistic historical snapshots if empty
  const now = Math.floor(Date.now() / 1000);
  const snapshots = [];
  for (let i = 10; i >= 0; i--) {
    const timestamp = now - i * 24 * 60 * 60; // 1 day steps
    // Random walk for total value and drift
    const total_value = 10000 + Math.sin(i) * 500 + Math.random() * 200;
    const total_drift = 0.02 + (10 - i) * 0.005 + Math.random() * 0.01;
    snapshots.push({
      timestamp,
      total_value,
      total_drift,
      triggered_alert: total_drift > 0.05
    });
  }
  return snapshots;
};

const saveMockSnapshots = (portfolioId: string, snapshots: any[]) => {
  localStorage.setItem(`PDE_MOCK_SNAPSHOTS_${portfolioId}`, JSON.stringify(snapshots));
};

// Realistic prices for well-known tickers
const MOCK_PRICES: { [key: string]: number } = {
  'SPY': 450.0,
  'VOO': 410.0,
  'QQQ': 380.0,
  'GLD': 185.0,
  'SLV': 23.0,
  'AAPL': 175.0,
  'MSFT': 350.0,
  'AMZN': 130.0,
  'TSLA': 240.0,
  'BTC-USD': 60000.0,
  'ETH-USD': 3000.0,
  'IAU': 35.0,
  'BND': 72.0
};

const getPrice = (ticker: string): number => {
  const clean = ticker.toUpperCase().trim();
  if (clean in MOCK_PRICES) {
    // Add a tiny random fluctuation (random walk)
    const base = MOCK_PRICES[clean];
    const fluctuation = base * (0.995 + Math.random() * 0.01);
    return Math.round(fluctuation * 100) / 100;
  }
  // Deterministic price based on string hash
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const price = 10 + (Math.abs(hash) % 490);
  return Math.round(price * 100) / 100;
};

// Core Drift Math in Typescript (Matching Python Backend)
const calculateMockDrift = (holdings: any[]) => {
  let totalValue = 0;
  const calculatedHoldings = holdings.map(h => {
    const price = getPrice(h.ticker);
    const currentValue = h.quantity * price;
    totalValue += currentValue;
    return {
      ...h,
      price,
      current_value: currentValue,
    };
  });

  let totalDrift = 0;
  const holdingsWithWeights = calculatedHoldings.map(ch => {
    const currentWeight = totalValue > 0 ? ch.current_value / totalValue : 0;
    const drift = currentWeight - ch.target_weight;
    totalDrift += Math.abs(drift);
    return {
      ...ch,
      current_weight: currentWeight,
      drift,
    };
  });

  return {
    total_value: totalValue,
    total_drift: totalDrift,
    holdings: holdingsWithWeights
  };
};

// Greedy water-filling algorithm in TypeScript (Matching Python Backend)
const calculateMockCashInjection = (holdings: any[], cashInjection: number) => {
  if (cashInjection <= 0) return [];
  
  const driftData = calculateMockDrift(holdings);
  const totalValue = driftData.total_value;
  const newTotalValue = totalValue + cashInjection;
  
  const allocations: { [key: string]: number } = {};
  const currentValues: { [key: string]: number } = {};
  const targetWeights: { [key: string]: number } = {};
  
  driftData.holdings.forEach(h => {
    allocations[h.ticker] = 0;
    currentValues[h.ticker] = h.current_value;
    targetWeights[h.ticker] = h.target_weight;
  });
  
  const step = Math.min(1.0, cashInjection / 1000.0);
  let remainingCash = cashInjection;
  
  while (remainingCash >= step) {
    let bestTicker = null;
    let maxDeficit = -999999.0;
    
    for (const ticker of Object.keys(targetWeights)) {
      const currentVal = currentValues[ticker] + allocations[ticker];
      const projectedWeight = newTotalValue > 0 ? currentVal / newTotalValue : 0;
      const deficit = targetWeights[ticker] - projectedWeight;
      
      if (deficit > maxDeficit) {
        maxDeficit = deficit;
        bestTicker = ticker;
      }
    }
    
    if (bestTicker) {
      allocations[bestTicker] += step;
      remainingCash -= step;
    } else {
      break;
    }
  }
  
  if (remainingCash > 0) {
    let bestTicker = null;
    let maxDeficit = -999999.0;
    for (const ticker of Object.keys(targetWeights)) {
      const currentVal = currentValues[ticker] + allocations[ticker];
      const projectedWeight = newTotalValue > 0 ? currentVal / newTotalValue : 0;
      const deficit = targetWeights[ticker] - projectedWeight;
      if (deficit > maxDeficit) {
        maxDeficit = deficit;
        bestTicker = ticker;
      }
    }
    if (bestTicker) {
      allocations[bestTicker] += remainingCash;
    }
  }
  
  const recommendations: any[] = [];
  driftData.holdings.forEach(h => {
    const allocatedAmount = allocations[h.ticker];
    if (allocatedAmount > 0 && h.price > 0) {
      recommendations.push({
        ticker: h.ticker,
        action: 'BUY',
        amount: Math.round(allocatedAmount * 100) / 100,
        shares: Math.round((allocatedAmount / h.price) * 10000) / 10000
      });
    }
  });
  
  return recommendations;
};

// --- API CLIENT EXPORTS ---
export const api = {
  // 1. Authentication
  register: async (email: string, password: string) => {
    if (!API_URL) {
      // Mock Register
      const user = { email, alert_threshold: 0.05, notification_enabled: true };
      saveMockUser({ ...user, password_hash: 'mock-hash' });
      localStorage.setItem('PDE_TOKEN', 'mock-jwt-token');
      
      // Seed initial mock portfolios if none exist
      if (getMockPortfolios().length === 0) {
        const pId = 'portfolio-1';
        saveMockPortfolios([
          {
            portfolio_id: pId,
            name: 'All-Weather Retirement Portfolio',
            description: 'Standard index funds paired with gold and silver ETF hedges.',
            created_at: Math.floor(Date.now() / 1000),
            updated_at: Math.floor(Date.now() / 1000)
          }
        ]);
        saveMockHoldings(pId, [
          { ticker: 'SPY', asset_class: 'Equity', target_weight: 0.70, quantity: 10, purchase_price: 440.0 },
          { ticker: 'GLD', asset_class: 'Gold', target_weight: 0.15, quantity: 5, purchase_price: 180.0 },
          { ticker: 'SLV', asset_class: 'Silver', target_weight: 0.15, quantity: 8, purchase_price: 22.0 }
        ]);
      }
      
      return { token: 'mock-jwt-token', user };
    }
    
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Registration failed');
    const data = await response.json();
    localStorage.setItem('PDE_TOKEN', data.token);
    return data;
  },

  login: async (email: string, password: string) => {
    if (!API_URL) {
      // Mock Login
      const user = getMockUser();
      if (!user || email.toLowerCase().trim() !== user.email) {
        throw new Error('Invalid email or password');
      }
      localStorage.setItem('PDE_TOKEN', 'mock-jwt-token');
      return { token: 'mock-jwt-token', user: { email: user.email, alert_threshold: user.alert_threshold, notification_enabled: user.notification_enabled } };
    }

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Login failed');
    const data = await response.json();
    localStorage.setItem('PDE_TOKEN', data.token);
    return data;
  },

  getMe: async () => {
    if (!API_URL) {
      const user = getMockUser();
      if (!user) throw new Error('Unauthorized');
      return { user };
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch user profile');
    return response.json();
  },

  updateSettings: async (alert_threshold: number, notification_enabled: boolean) => {
    if (!API_URL) {
      const user = getMockUser();
      if (!user) throw new Error('Unauthorized');
      user.alert_threshold = alert_threshold;
      user.notification_enabled = notification_enabled;
      saveMockUser(user);
      return { user };
    }

    const response = await fetch(`${API_URL}/auth/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ alert_threshold, notification_enabled }),
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Failed to update settings');
    return response.json();
  },

  // 2. Portfolios
  listPortfolios: async () => {
    if (!API_URL) {
      return { portfolios: getMockPortfolios() };
    }

    const response = await fetch(`${API_URL}/portfolios`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to list portfolios');
    return response.json();
  },

  createPortfolio: async (name: string, description: string = '') => {
    if (!API_URL) {
      const portfolios = getMockPortfolios();
      const newPortfolio = {
        portfolio_id: `portfolio-${Date.now()}`,
        name,
        description,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };
      portfolios.push(newPortfolio);
      saveMockPortfolios(portfolios);
      return { portfolio: newPortfolio };
    }

    const response = await fetch(`${API_URL}/portfolios`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, description }),
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Failed to create portfolio');
    return response.json();
  },

  getPortfolio: async (id: string) => {
    if (!API_URL) {
      const portfolios = getMockPortfolios();
      const portfolio = portfolios.find(p => p.portfolio_id === id);
      if (!portfolio) throw new Error('Portfolio not found');
      
      const holdings = getMockHoldings(id);
      const driftData = calculateMockDrift(holdings);
      const snapshots = getMockSnapshots(id);
      
      return {
        portfolio,
        holdings: driftData.holdings,
        total_value: driftData.total_value,
        total_drift: driftData.total_drift,
        snapshots
      };
    }

    const response = await fetch(`${API_URL}/portfolios/${id}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch portfolio details');
    return response.json();
  },

  saveHoldings: async (id: string, holdings: any[]) => {
    if (!API_URL) {
      saveMockHoldings(id, holdings);
      
      // Update portfolio updated_at timestamp
      const portfolios = getMockPortfolios();
      const pIdx = portfolios.findIndex(p => p.portfolio_id === id);
      if (pIdx !== -1) {
        portfolios[pIdx].updated_at = Math.floor(Date.now() / 1000);
        saveMockPortfolios(portfolios);
      }
      
      // Save a new historical snapshot representing this change
      const driftData = calculateMockDrift(holdings);
      const snapshots = getMockSnapshots(id);
      snapshots.push({
        timestamp: Math.floor(Date.now() / 1000),
        total_value: driftData.total_value,
        total_drift: driftData.total_drift,
        triggered_alert: driftData.total_drift > 0.05
      });
      saveMockSnapshots(id, snapshots);
      
      return { message: 'Holdings saved successfully' };
    }

    const response = await fetch(`${API_URL}/portfolios/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ holdings }),
    });
    if (!response.ok) throw new Error((await response.json()).error || 'Failed to save holdings');
    return response.json();
  },

  deletePortfolio: async (id: string) => {
    if (!API_URL) {
      const portfolios = getMockPortfolios();
      const filtered = portfolios.filter(p => p.portfolio_id !== id);
      saveMockPortfolios(filtered);
      localStorage.removeItem(`PDE_MOCK_HOLDINGS_${id}`);
      localStorage.removeItem(`PDE_MOCK_SNAPSHOTS_${id}`);
      return { message: 'Portfolio deleted successfully' };
    }

    const response = await fetch(`${API_URL}/portfolios/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete portfolio');
    return response.json();
  },

  // 3. Rebalancing
  calculateRebalance: async (id: string, cash_injection: number = 0) => {
    if (!API_URL) {
      const holdings = getMockHoldings(id);
      const driftData = calculateMockDrift(holdings);
      
      // Standard rebalance (sell and buy)
      const standard_rebalance = [];
      for (const h of driftData.holdings) {
        if (h.price <= 0) continue;
        const targetValue = driftData.total_value * h.target_weight;
        const valueDiff = targetValue - h.current_value;
        const sharesDiff = valueDiff / h.price;
        if (Math.abs(valueDiff) >= 0.01) {
          standard_rebalance.push({
            ticker: h.ticker,
            action: valueDiff > 0 ? 'BUY' : 'SELL',
            amount: Math.round(Math.abs(valueDiff) * 100) / 100,
            shares: Math.round(Math.abs(sharesDiff) * 10000) / 10000
          });
        }
      }
      
      // Cash-injection rebalance (buy-only)
      const cash_injection_rebalance = cash_injection > 0 
        ? calculateMockCashInjection(holdings, cash_injection)
        : [];
        
      return {
        portfolio_id: id,
        portfolio_name: 'Mock Portfolio',
        total_value: driftData.total_value,
        total_drift: driftData.total_drift,
        cash_injection,
        standard_rebalance,
        cash_injection_rebalance
      };
    }

    const response = await fetch(`${API_URL}/portfolios/${id}/rebalance`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ cash_injection }),
    });
    if (!response.ok) throw new Error('Failed to calculate rebalancing recommendations');
    return response.json();
  },

  logout: () => {
    localStorage.removeItem('PDE_TOKEN');
  }
};
