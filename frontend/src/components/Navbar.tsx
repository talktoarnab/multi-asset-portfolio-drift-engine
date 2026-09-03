import React from 'react';
import { TrendingUp, Bell, LogOut, User } from 'lucide-react';

interface NavbarProps {
  userEmail: string;
  currentScreen: string;
  setCurrentScreen: (screen: string) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  userEmail,
  currentScreen,
  setCurrentScreen,
  onLogout,
}) => {
  return (
    <nav className="bg-slate-900 text-white shadow-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentScreen('dashboard')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white shadow-md">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight">DriftEngine</span>
              <span className="hidden sm:inline text-xs text-slate-400 block -mt-1">Multi-Asset Portfolio</span>
            </div>
          </div>

          {/* Navigation & User Info */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setCurrentScreen('dashboard')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                currentScreen === 'dashboard' || currentScreen === 'portfolio-manager' || currentScreen === 'rebalance'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Dashboard
            </button>
            
            <button
              onClick={() => setCurrentScreen('settings')}
              className={`flex items-center space-x-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                currentScreen === 'settings'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Bell className="h-4 w-4" />
              <span className="hidden md:inline">Alert Settings</span>
            </button>

            {/* User Profile Tag */}
            <div className="hidden md:flex items-center space-x-2 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300 border border-slate-700">
              <User className="h-3.5 w-3.5 text-indigo-400" />
              <span className="font-medium max-w-[150px] truncate">{userEmail}</span>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center space-x-1 rounded-md bg-rose-950/40 border border-rose-900/50 hover:bg-rose-900/60 text-rose-200 px-3 py-2 text-sm font-medium transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
