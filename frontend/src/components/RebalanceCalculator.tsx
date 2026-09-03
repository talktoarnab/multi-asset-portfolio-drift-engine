import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency, formatNumber } from '../utils/math';
import { 
  ArrowLeft, Copy, Check, Info, AlertCircle, 
  ArrowRightLeft, BadgeDollarSign, Sparkles 
} from 'lucide-react';

interface RebalanceCalculatorProps {
  portfolioId: string;
  onBack: () => void;
}

export const RebalanceCalculator: React.FC<RebalanceCalculatorProps> = ({
  portfolioId,
  onBack,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cashInjection, setCashInjection] = useState('1000');
  const [rebalanceData, setRebalanceData] = useState<any>(null);
  const [copiedStandard, setCopiedStandard] = useState(false);
  const [copiedCash, setCopiedCash] = useState(false);

  const fetchRebalanceRecommendations = async (cash: number = 0) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.calculateRebalance(portfolioId, cash);
      setRebalanceData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate rebalancing recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRebalanceRecommendations(parseFloat(cashInjection) || 0);
  }, [portfolioId]);

  const handleRecalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(cashInjection) || 0;
    fetchRebalanceRecommendations(cash);
  };

  const copyToClipboard = (recommendations: any[], type: 'standard' | 'cash') => {
    if (!recommendations || recommendations.length === 0) return;
    
    const text = recommendations.map(r => 
      `${r.action} ${r.ticker}: Buy/Sell ${formatCurrency(r.amount)} (~${formatNumber(r.shares, 4)} shares)`
    ).join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'standard') {
        setCopiedStandard(true);
        setTimeout(() => setCopiedStandard(false), 2000);
      } else {
        setCopiedCash(true);
        setTimeout(() => setCopiedCash(false), 2000);
      }
    });
  };

  if (loading && !rebalanceData) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Rebalancing Calculator: {rebalanceData?.portfolio_name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Generate precise fractional buy/sell recommendations to realign your portfolio.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start space-x-2.5 mb-6">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Cash Injection Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-8">
        <form onSubmit={handleRecalculate} className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-slate-700 flex items-center space-x-1">
              <BadgeDollarSign className="h-4.5 w-4.5 text-indigo-500" />
              <span>New Cash Injection (for Tax-Efficient Buy-Only Mode)</span>
            </label>
            <p className="text-xs text-slate-500 mt-1">
              Specify how much cash you want to add to your portfolio. We will calculate how to buy under-allocated assets without selling.
            </p>
            <div className="relative mt-2 rounded-md shadow-sm max-w-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="text-slate-400 text-sm">$</span>
              </div>
              <input
                type="number"
                min="0"
                step="1"
                value={cashInjection}
                onChange={(e) => setCashInjection(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm font-semibold"
                placeholder="0"
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            Calculate Recommendations
          </button>
        </form>
      </div>

      {/* Rebalancing Modes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Mode A: Standard Rebalance */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-900 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="h-5.5 w-5.5 text-indigo-400" />
                <h2 className="text-lg font-bold">Mode A: Standard Rebalance</h2>
              </div>
              <button
                onClick={() => copyToClipboard(rebalanceData?.standard_rebalance, 'standard')}
                disabled={!rebalanceData?.standard_rebalance || rebalanceData.standard_rebalance.length === 0}
                className="flex items-center space-x-1 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors disabled:opacity-50"
              >
                {copiedStandard ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Orders</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Sells over-allocated assets and buys under-allocated assets. Brings the portfolio back to perfect target weights.
            </p>
          </div>

          <div className="p-6 flex-1 flex flex-col">
            {rebalanceData?.standard_rebalance && rebalanceData.standard_rebalance.length > 0 ? (
              <div className="space-y-4 flex-1">
                <div className="divide-y divide-slate-100">
                  {rebalanceData.standard_rebalance.map((r: any, idx: number) => (
                    <div key={idx} className="py-3 flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ${
                          r.action === 'BUY' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {r.action}
                        </span>
                        <span className="font-bold text-slate-900 text-base">{r.ticker}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{formatCurrency(r.amount)}</div>
                        <div className="text-xs text-slate-500">~{formatNumber(r.shares, 4)} shares</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-sm text-center">
                <Check className="h-8 w-8 text-emerald-500 mb-2" />
                <span>Your portfolio is perfectly aligned! No rebalancing required.</span>
              </div>
            )}
          </div>
        </div>

        {/* Mode B: Cash-Injection Rebalance */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-900 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5.5 w-5.5 text-emerald-400" />
                <h2 className="text-lg font-bold">Mode B: Cash-Injection Rebalance</h2>
              </div>
              <button
                onClick={() => copyToClipboard(rebalanceData?.cash_injection_rebalance, 'cash')}
                disabled={!rebalanceData?.cash_injection_rebalance || rebalanceData.cash_injection_rebalance.length === 0}
                className="flex items-center space-x-1 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors disabled:opacity-50"
              >
                {copiedCash ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Orders</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Tax-efficient buy-only mode. Allocates your {formatCurrency(rebalanceData?.cash_injection || 0)} cash injection to buy under-allocated assets without selling.
            </p>
          </div>

          <div className="p-6 flex-1 flex flex-col">
            {rebalanceData?.cash_injection <= 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-sm text-center">
                <Info className="h-8 w-8 text-indigo-400 mb-2" />
                <span>Enter a cash injection amount above to calculate buy-only recommendations.</span>
              </div>
            ) : rebalanceData?.cash_injection_rebalance && rebalanceData.cash_injection_rebalance.length > 0 ? (
              <div className="space-y-4 flex-1">
                <div className="divide-y divide-slate-100">
                  {rebalanceData.cash_injection_rebalance.map((r: any, idx: number) => (
                    <div key={idx} className="py-3 flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-3">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                          {r.action}
                        </span>
                        <span className="font-bold text-slate-900 text-base">{r.ticker}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-900">{formatCurrency(r.amount)}</div>
                        <div className="text-xs text-slate-500">~{formatNumber(r.shares, 4)} shares</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-sm text-center">
                <Check className="h-8 w-8 text-emerald-500 mb-2" />
                <span>No cash injection recommended. Your portfolio is already close to target weights.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
