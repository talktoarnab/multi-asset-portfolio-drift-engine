import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  Bell, Save, AlertCircle, CheckCircle2, ShieldAlert, MailCheck 
} from 'lucide-react';

interface AlertSettingsProps {
  initialThreshold: number;
  initialEnabled: boolean;
  onSettingsUpdate: (threshold: number, enabled: boolean) => void;
}

export const AlertSettings: React.FC<AlertSettingsProps> = ({
  initialThreshold,
  initialEnabled,
  onSettingsUpdate,
}) => {
  const [threshold, setThreshold] = useState((initialThreshold * 100).toString());
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Keep state in sync with props
  useEffect(() => {
    setThreshold((initialThreshold * 100).toString());
    setEnabled(initialEnabled);
  }, [initialThreshold, initialEnabled]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const parsedThreshold = parseFloat(threshold);
    if (isNaN(parsedThreshold) || parsedThreshold <= 0 || parsedThreshold > 100) {
      setError('Alert threshold must be a valid percentage between 0.1% and 100%.');
      return;
    }

    setLoading(true);
    try {
      const decimalThreshold = parsedThreshold / 100;
      const data = await api.updateSettings(decimalThreshold, enabled);
      onSettingsUpdate(data.user.alert_threshold, data.user.notification_enabled);
      setSuccess('Alert settings updated successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update alert settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5 mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center space-x-2">
          <Bell className="h-6 w-6 text-indigo-600" />
          <span>Alert & Notification Settings</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure threshold-triggered email notifications for portfolio drift.
        </p>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Explanation */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5 mb-3">
              <ShieldAlert className="h-4.5 w-4.5 text-indigo-500" />
              <span>How Alerts Work</span>
            </h3>
            <p className="text-xs text-slate-600 line-height-1.5 space-y-2">
              Our serverless EventBridge scheduler runs a daily evaluation job. It fetches live end-of-day market prices for all your tickers, calculates your total absolute portfolio drift, and records a historical snapshot.
              <br /><br />
              If your total drift exceeds your configured threshold (e.g., 5.0%), and notifications are enabled, we dispatch a high-quality HTML email alert via Amazon SES showing exactly which assets have drifted and require rebalancing.
            </p>
          </div>
        </div>

        {/* Right: Form */}
        <div className="md:col-span-2">
          <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            {/* Threshold Input */}
            <div>
              <label className="block text-sm font-bold text-slate-700">
                Drift Alert Threshold (%)
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Trigger an alert when the sum of absolute deviations of all assets from their target weights exceeds this percentage.
              </p>
              <div className="relative mt-2 rounded-md shadow-sm max-w-xs">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  required
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 pr-8 pl-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm font-semibold"
                  placeholder="5.0"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-slate-400 text-sm">%</span>
                </div>
              </div>
            </div>

            {/* Enable Toggle */}
            <div className="border-t border-slate-100 pt-6">
              <div className="flex items-start">
                <div className="flex h-5 items-center">
                  <input
                    id="notifications"
                    name="notifications"
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="notifications" className="font-bold text-slate-700 flex items-center space-x-1.5">
                    <MailCheck className="h-4.5 w-4.5 text-emerald-500" />
                    <span>Enable Email Notifications</span>
                  </label>
                  <p className="text-xs text-slate-500 mt-1">
                    Receive HTML email reports when your portfolio drift exceeds the threshold.
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="border-t border-slate-100 pt-6 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-1.5 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{loading ? 'Saving Settings...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
