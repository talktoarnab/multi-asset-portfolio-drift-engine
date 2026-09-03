import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { formatCurrency, formatPercent, formatDate } from '../utils/math';
import { 
  FolderPlus, Eye, Calculator, Trash2, AlertCircle, 
  TrendingUp, BarChart3, Plus, X 
} from 'lucide-react';

interface DashboardProps {
  alertThreshold: number;
  onSelectPortfolio: (id: string) => void;
  onSelectRebalance: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  alertThreshold,
  onSelectPortfolio,
  onSelectRebalance,
}) => {
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDesc, setNewPortfolioDesc] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  
  // Selected portfolio details for rendering charts
  const [activePortfolioDetails, setActivePortfolioDetails] = useState<any>(null);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);

  const fetchPortfolios = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listPortfolios();
      setPortfolios(data.portfolios);
      if (data.portfolios.length > 0) {
        // Select the first portfolio to load charts
        setActivePortfolioId(data.portfolios[0].portfolio_id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load portfolios');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivePortfolioDetails = async (id: string) => {
    try {
      const details = await api.getPortfolio(id);
      setActivePortfolioDetails(details);
    } catch (err) {
      console.error('Failed to load portfolio details for charts', err);
    }
  };

  useEffect(() => {
    fetchPortfolios();
  }, []);

  useEffect(() => {
    if (activePortfolioId) {
      fetchActivePortfolioDetails(activePortfolioId);
    } else {
      setActivePortfolioDetails(null);
    }
  }, [activePortfolioId]);

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;

    setCreateLoading(true);
    try {
      const data = await api.createPortfolio(newPortfolioName, newPortfolioDesc);
      setPortfolios([data.portfolio, ...portfolios]);
      setActivePortfolioId(data.portfolio.portfolio_id);
      setShowCreateModal(false);
      setNewPortfolioName('');
      setNewPortfolioDesc('');
    } catch (err: any) {
      alert(err.message || 'Failed to create portfolio');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeletePortfolio = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the portfolio "${name}"? This will permanently delete all its holdings and historical data.`)) {
      return;
    }

    try {
      await api.deletePortfolio(id);
      setPortfolios(portfolios.filter(p => p.portfolio_id !== id));
      if (activePortfolioId === id) {
        const remaining = portfolios.filter(p => p.portfolio_id !== id);
        setActivePortfolioId(remaining.length > 0 ? remaining[0].portfolio_id : null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete portfolio');
    }
  };

  // --- RENDERING SVG CHARTS ---
  
  // 1. Target vs Current Weight Bar Chart
  const renderWeightChart = () => {
    if (!activePortfolioDetails || !activePortfolioDetails.holdings || activePortfolioDetails.holdings.length === 0) {
      return (
        <div className="flex h-48 items-center justify-center text-slate-400 text-sm">
          No holdings configured. Click "Manage Holdings" to add assets.
        </div>
      );
    }

    const holdings = activePortfolioDetails.holdings;
    const chartHeight = 160;
    const barWidth = 32;
    const gap = 36;
    const paddingLeft = 50;
    const paddingTop = 20;
    const paddingBottom = 30;
    const chartWidth = paddingLeft + holdings.length * (barWidth * 2 + gap) + 20;

    return (
      <div className="overflow-x-auto">
        <svg width={Math.max(400, chartWidth)} height={chartHeight + paddingTop + paddingBottom} className="mx-auto">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
            const y = paddingTop + chartHeight * (1 - ratio);
            return (
              <g key={idx}>
                <line x1={paddingLeft} y1={y} x2={Math.max(400, chartWidth) - 10} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                <text x={paddingLeft - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-medium">
                  {formatPercent(ratio)}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {holdings.map((h: any, idx: number) => {
            const x = paddingLeft + idx * (barWidth * 2 + gap);
            
            // Target Bar
            const targetHeight = h.target_weight * chartHeight;
            const targetY = paddingTop + chartHeight - targetHeight;
            
            // Current Bar
            const currentHeight = h.current_weight * chartHeight;
            const currentY = paddingTop + chartHeight - currentHeight;

            return (
              <g key={h.ticker}>
                {/* Target Weight Bar (Slate/Gray) */}
                <rect 
                  x={x} 
                  y={targetY} 
                  width={barWidth} 
                  height={Math.max(2, targetHeight)} 
                  fill="#94a3b8" 
                  rx="4"
                  className="transition-all duration-500"
                />
                
                {/* Current Weight Bar (Indigo) */}
                <rect 
                  x={x + barWidth + 4} 
                  y={currentY} 
                  width={barWidth} 
                  height={Math.max(2, currentHeight)} 
                  fill="#4f46e5" 
                  rx="4"
                  className="transition-all duration-500"
                />

                {/* X Axis Label */}
                <text 
                  x={x + barWidth + 2} 
                  y={paddingTop + chartHeight + 18} 
                  textAnchor="middle" 
                  className="text-xs font-bold fill-slate-700"
                >
                  {h.ticker}
                </text>
              </g>
            );
          })}

          {/* Legend */}
          <g transform={`translate(${paddingLeft}, 10)`}>
            <rect x="0" y="0" width="12" height="12" fill="#94a3b8" rx="2" />
            <text x="16" y="10" className="text-[10px] fill-slate-500 font-medium">Target Weight</text>
            
            <rect x="110" y="0" width="12" height="12" fill="#4f46e5" rx="2" />
            <text x="126" y="10" className="text-[10px] fill-slate-500 font-medium">Current Weight</text>
          </g>
        </svg>
      </div>
    );
  };

  // 2. Historical Drift Line Chart (Pure SVG)
  const renderDriftChart = () => {
    if (!activePortfolioDetails || !activePortfolioDetails.snapshots || activePortfolioDetails.snapshots.length === 0) {
      return (
        <div className="flex h-48 items-center justify-center text-slate-400 text-sm">
          No historical drift data available yet. Run the daily evaluator to build history.
        </div>
      );
    }

    const snapshots = activePortfolioDetails.snapshots;
    const chartHeight = 160;
    const paddingLeft = 50;
    const paddingTop = 20;
    const paddingBottom = 30;
    const chartWidth = 450;
    const totalWidth = paddingLeft + chartWidth + 20;

    // Find max drift to scale Y axis
    const maxDriftVal = Math.max(...snapshots.map((s: any) => s.total_drift), 0.10);
    const yMax = Math.ceil(maxDriftVal * 10) / 10; // Round up to nearest 10%

    // Generate path coordinates
    const points = snapshots.map((s: any, idx: number) => {
      const x = paddingLeft + (idx / (snapshots.length - 1)) * chartWidth;
      const y = paddingTop + chartHeight * (1 - s.total_drift / yMax);
      return { x, y, ...s };
    });

    const pathD = points.length > 0 
      ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p: any) => `L ${p.x} ${p.y}`).join(' ')
      : '';

    // Area under the line path
    const areaD = points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
      : '';

    return (
      <div>
        <svg width="100%" height={chartHeight + paddingTop + paddingBottom} viewBox={`0 0 ${totalWidth} ${chartHeight + paddingTop + paddingBottom}`} className="mx-auto">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
            const y = paddingTop + chartHeight * (1 - ratio);
            const val = yMax * ratio;
            return (
              <g key={idx}>
                <line x1={paddingLeft} y1={y} x2={paddingLeft + chartWidth} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
                <text x={paddingLeft - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-medium">
                  {formatPercent(val)}
                </text>
              </g>
            );
          })}

          {/* Alert Threshold line */}
          {alertThreshold < yMax && (
            <g>
              <line 
                x1={paddingLeft} 
                y1={paddingTop + chartHeight * (1 - alertThreshold / yMax)} 
                x2={paddingLeft + chartWidth} 
                y2={paddingTop + chartHeight * (1 - alertThreshold / yMax)} 
                stroke="#e11d48" 
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <text 
                x={paddingLeft + chartWidth - 5} 
                y={paddingTop + chartHeight * (1 - alertThreshold / yMax) - 6} 
                textAnchor="end" 
                className="text-[9px] fill-rose-600 font-bold"
              >
                Alert Threshold ({formatPercent(alertThreshold)})
              </text>
            </g>
          )}

          {/* Area Path */}
          {areaD && <path d={areaD} fill="url(#areaGrad)" />}

          {/* Line Path */}
          {pathD && <path d={pathD} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

          {/* Data Points */}
          {points.map((p: any, idx: number) => (
            <g key={idx}>
              <circle 
                cx={p.x} 
                cy={p.y} 
                r="4" 
                fill="#ffffff" 
                stroke={p.total_drift > alertThreshold ? '#e11d48' : '#4f46e5'} 
                strokeWidth="2" 
              />
              {/* Show date for first, middle, and last points */}
              {(idx === 0 || idx === Math.floor(points.length / 2) || idx === points.length - 1) && (
                <text 
                  x={p.x} 
                  y={paddingTop + chartHeight + 18} 
                  textAnchor="middle" 
                  className="text-[9px] fill-slate-400 font-medium"
                >
                  {formatDate(p.timestamp)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 mb-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Portfolio Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor asset allocation drift and execute smart rebalancing.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
        >
          <FolderPlus className="h-4.5 w-4.5" />
          <span>New Portfolio</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-start space-x-2.5 mb-8">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      ) : portfolios.length === 0 ? (
        <div className="text-center bg-white rounded-xl border border-slate-200 p-12 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 mb-4">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No portfolios found</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Get started by creating your first multi-asset portfolio. You can add index funds, gold ETFs, cash hedges, and more.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 inline-flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            <FolderPlus className="h-4 w-4" />
            <span>Create First Portfolio</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Portfolios List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">My Portfolios</h2>
            <div className="space-y-3">
              {portfolios.map((p) => {
                const isActive = activePortfolioId === p.portfolio_id;
                return (
                  <div
                    key={p.portfolio_id}
                    onClick={() => setActivePortfolioId(p.portfolio_id)}
                    className={`cursor-pointer rounded-xl border p-5 shadow-sm transition-all ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-50/20 ring-1 ring-indigo-600'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900">{p.name}</h3>
                        {p.description && (
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">{p.description}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePortfolio(p.portfolio_id, p.name);
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                        title="Delete Portfolio"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPortfolio(p.portfolio_id);
                        }}
                        className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Manage Holdings</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRebalance(p.portfolio_id);
                        }}
                        className="flex items-center space-x-1 text-xs font-semibold text-emerald-600 hover:text-emerald-500"
                      >
                        <Calculator className="h-3.5 w-3.5" />
                        <span>Rebalance</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Active Portfolio Analytics & Charts */}
          <div className="lg:col-span-2 space-y-8">
            {activePortfolioDetails ? (
              <>
                {/* Active Portfolio Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Value</span>
                    <div className="mt-2 text-3xl font-extrabold text-slate-900">
                      {formatCurrency(activePortfolioDetails.total_value)}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Drift</span>
                    <div className="mt-2 flex items-baseline space-x-2">
                      <span className={`text-3xl font-extrabold ${
                        activePortfolioDetails.total_drift > alertThreshold
                          ? 'text-rose-600'
                          : 'text-indigo-600'
                      }`}>
                        {formatPercent(activePortfolioDetails.total_drift)}
                      </span>
                      <span className="text-xs text-slate-400">
                        (Threshold: {formatPercent(alertThreshold)})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Weight Comparison Chart */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5 mb-4">
                      <BarChart3 className="h-4 w-4 text-indigo-500" />
                      <span>Target vs Current Weight</span>
                    </h3>
                    {renderWeightChart()}
                  </div>

                  {/* Historical Drift Chart */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5 mb-4">
                      <TrendingUp className="h-4 w-4 text-indigo-500" />
                      <span>Historical Drift Snapshots</span>
                    </h3>
                    {renderDriftChart()}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-64 items-center justify-center bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-slate-400 text-sm">
                Select a portfolio to view analytics.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Portfolio Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Create New Portfolio</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePortfolio} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Portfolio Name</label>
                <input
                  type="text"
                  required
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  placeholder="e.g., All-Weather Retirement"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Description (Optional)</label>
                <textarea
                  value={newPortfolioDesc}
                  onChange={(e) => setNewPortfolioDesc(e.target.value)}
                  rows={3}
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Describe the target strategy, e.g., 70% Equities, 15% Gold, 15% Silver"
                />
              </div>

              <div className="flex justify-end space-x-3 border-t border-slate-100 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {createLoading ? 'Creating...' : 'Create Portfolio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
