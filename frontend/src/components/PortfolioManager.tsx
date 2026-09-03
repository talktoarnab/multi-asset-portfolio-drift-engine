import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  ArrowLeft, Plus, Trash2, Save, AlertCircle, CheckCircle2, Info 
} from 'lucide-react';

interface PortfolioManagerProps {
  portfolioId: string;
  onBack: () => void;
}

interface HoldingRow {
  ticker: string;
  asset_class: string;
  target_weight: string; // string for inline input editing
  quantity: string;      // string for inline input editing
  purchase_price: string;// string for inline input editing
}

export const PortfolioManager: React.FC<PortfolioManagerProps> = ({
  portfolioId,
  onBack,
}) => {
  const [portfolio, setPortfolio] = useState<any>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPortfolioDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getPortfolio(portfolioId);
      setPortfolio(data.portfolio);
      
      // Convert holdings to editable rows
      if (data.holdings && data.holdings.length > 0) {
        setHoldings(data.holdings.map((h: any) => ({
          ticker: h.ticker,
          asset_class: h.asset_class || 'Equity',
          target_weight: (h.target_weight * 100).toString(),
          quantity: h.quantity.toString(),
          purchase_price: h.purchase_price ? h.purchase_price.toString() : '0'
        })));
      } else {
        // Seed with a default row if empty
        setHoldings([{ ticker: '', asset_class: 'Equity', target_weight: '', quantity: '', purchase_price: '' }]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load portfolio details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioDetails();
  }, [portfolioId]);

  const handleAddRow = () => {
    setHoldings([...holdings, { ticker: '', asset_class: 'Equity', target_weight: '', quantity: '', purchase_price: '' }]);
  };

  const handleRemoveRow = (idx: number) => {
    const updated = holdings.filter((_, i) => i !== idx);
    setHoldings(updated.length > 0 ? updated : [{ ticker: '', asset_class: 'Equity', target_weight: '', quantity: '', purchase_price: '' }]);
  };

  const handleFieldChange = (idx: number, field: keyof HoldingRow, val: string) => {
    const updated = [...holdings];
    updated[idx] = { ...updated[idx], [field]: val };
    setHoldings(updated);
  };

  // Calculate total target weight
  const totalTargetWeight = holdings.reduce((sum, h) => {
    const weight = parseFloat(h.target_weight) || 0;
    return sum + weight;
  }, 0);

  const isWeightValid = Math.abs(totalTargetWeight - 100) < 0.001;

  const handleSave = async () => {
    setError('');
    setSuccess('');
    
    // Validate rows
    const cleanedHoldings = [];
    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i];
      const ticker = h.ticker.toUpperCase().trim();
      
      if (!ticker) {
        setError(`Row ${i + 1} is missing a Ticker Symbol.`);
        return;
      }
      
      const targetWeight = parseFloat(h.target_weight);
      if (isNaN(targetWeight) || targetWeight < 0 || targetWeight > 100) {
        setError(`Holding '${ticker}' must have a valid target weight between 0% and 100%.`);
        return;
      }
      
      const qty = parseFloat(h.quantity);
      if (isNaN(qty) || qty < 0) {
        setError(`Holding '${ticker}' must have a valid non-negative quantity.`);
        return;
      }
      
      const purchasePrice = parseFloat(h.purchase_price) || 0;
      if (purchasePrice < 0) {
        setError(`Holding '${ticker}' purchase price cannot be negative.`);
        return;
      }
      
      cleanedHoldings.push({
        ticker,
        asset_class: h.asset_class,
        target_weight: targetWeight / 100, // Convert percentage to decimal (e.g. 70% -> 0.70)
        quantity: qty,
        purchase_price: purchasePrice
      });
    }

    if (!isWeightValid) {
      setError(`Total target weight must sum to exactly 100% (currently ${totalTargetWeight.toFixed(1)}%).`);
      return;
    }

    setSaveLoading(true);
    try {
      await api.saveHoldings(portfolioId, cleanedHoldings);
      setSuccess('Holdings saved successfully! Portfolio drift and history updated.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to save holdings');
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
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
              Manage Holdings: {portfolio?.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Define your target asset allocation model and log current holdings.
            </p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleAddRow}
            className="flex items-center justify-center space-x-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Asset</span>
          </button>
          
          <button
            onClick={handleSave}
            disabled={saveLoading}
            className="flex items-center justify-center space-x-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saveLoading ? 'Saving...' : 'Save Holdings'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start space-x-2.5 mb-6">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-start space-x-2.5 mb-6">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Holdings Editor Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider">Ticker Symbol</th>
              <th scope="col" className="px-6 py-3.5 text-left font-bold text-slate-500 uppercase tracking-wider">Asset Class</th>
              <th scope="col" className="px-6 py-3.5 text-right font-bold text-slate-500 uppercase tracking-wider">Target Weight (%)</th>
              <th scope="col" className="px-6 py-3.5 text-right font-bold text-slate-500 uppercase tracking-wider">Current Shares</th>
              <th scope="col" className="px-6 py-3.5 text-right font-bold text-slate-500 uppercase tracking-wider">Purchase Price ($)</th>
              <th scope="col" className="relative px-6 py-3.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {holdings.map((h, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50">
                {/* Ticker */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    required
                    value={h.ticker}
                    onChange={(e) => handleFieldChange(idx, 'ticker', e.target.value)}
                    className="block w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 font-bold uppercase placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g., SPY"
                  />
                </td>

                {/* Asset Class */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={h.asset_class}
                    onChange={(e) => handleFieldChange(idx, 'asset_class', e.target.value)}
                    className="block w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="Equity">Equity (Stocks/ETFs)</option>
                    <option value="Gold">Gold ETF / Hedge</option>
                    <option value="Silver">Silver ETF / Hedge</option>
                    <option value="Bond">Bonds / Fixed Income</option>
                    <option value="Cash">Cash / Money Market</option>
                    <option value="Crypto">Cryptocurrency</option>
                  </select>
                </td>

                {/* Target Weight */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="relative inline-block rounded-md shadow-sm">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      required
                      value={h.target_weight}
                      onChange={(e) => handleFieldChange(idx, 'target_weight', e.target.value)}
                      className="block w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="0.0"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <span className="text-slate-400 text-xs">%</span>
                    </div>
                  </div>
                </td>

                {/* Shares Quantity */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    value={h.quantity}
                    onChange={(e) => handleFieldChange(idx, 'quantity', e.target.value)}
                    className="block w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="0"
                  />
                </td>

                {/* Purchase Price */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="relative inline-block rounded-md shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-slate-400 text-xs">$</span>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={h.purchase_price}
                      onChange={(e) => handleFieldChange(idx, 'purchase_price', e.target.value)}
                      className="block w-28 rounded-lg border border-slate-300 pl-7 pr-3 py-1.5 text-right text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="0.00"
                    />
                  </div>
                </td>

                {/* Remove Button */}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleRemoveRow(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded transition-colors"
                    title="Remove Asset"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Table Footer: Weight Validation Bar */}
        <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-slate-200">
          <div className="flex items-center space-x-2">
            <Info className="h-4.5 w-4.5 text-slate-400" />
            <span className="text-xs text-slate-500">
              Ensure the sum of all target weights is exactly 100%.
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm font-bold text-slate-700">Total Target Weight:</span>
            <div className="flex items-center space-x-2">
              <span className={`text-lg font-extrabold ${
                isWeightValid ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {totalTargetWeight.toFixed(1)}%
              </span>
              {isWeightValid ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-500" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
