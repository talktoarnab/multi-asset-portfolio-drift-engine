import { useState, useEffect } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { PortfolioManager } from './components/PortfolioManager';
import { RebalanceCalculator } from './components/RebalanceCalculator';
import { AlertSettings } from './components/AlertSettings';
import { api } from './utils/api';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [alertThreshold, setAlertThreshold] = useState(0.05);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  
  const [currentScreen, setCurrentScreen] = useState('dashboard'); // 'dashboard', 'portfolio-manager', 'rebalance', 'settings'
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // Check for existing session token
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('PDE_TOKEN');
      if (token) {
        try {
          const data = await api.getMe();
          setUserEmail(data.user.email);
          setAlertThreshold(data.user.alert_threshold);
          setNotificationEnabled(data.user.notification_enabled);
          setIsAuthenticated(true);
        } catch (err) {
          console.error('Session expired or invalid', err);
          api.logout();
        }
      }
      setSessionLoading(false);
    };
    checkSession();
  }, []);

  const handleAuthSuccess = (email: string, threshold: number, enabled: boolean) => {
    setUserEmail(email);
    setAlertThreshold(threshold);
    setNotificationEnabled(enabled);
    setIsAuthenticated(true);
    setCurrentScreen('dashboard');
  };

  const handleLogout = () => {
    api.logout();
    setIsAuthenticated(false);
    setUserEmail('');
    setCurrentScreen('dashboard');
    setSelectedPortfolioId(null);
  };

  const handleSelectPortfolio = (id: string) => {
    setSelectedPortfolioId(id);
    setCurrentScreen('portfolio-manager');
  };

  const handleSelectRebalance = (id: string) => {
    setSelectedPortfolioId(id);
    setCurrentScreen('rebalance');
  };

  const handleSettingsUpdate = (threshold: number, enabled: boolean) => {
    setAlertThreshold(threshold);
    setNotificationEnabled(enabled);
  };

  if (sessionLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="flex h-full flex-col bg-slate-50">
      <Navbar 
        userEmail={userEmail} 
        currentScreen={currentScreen} 
        setCurrentScreen={(screen) => {
          setCurrentScreen(screen);
          setSelectedPortfolioId(null);
        }} 
        onLogout={handleLogout} 
      />
      
      <main className="flex-1 overflow-y-auto">
        {currentScreen === 'dashboard' && (
          <Dashboard 
            alertThreshold={alertThreshold} 
            onSelectPortfolio={handleSelectPortfolio} 
            onSelectRebalance={handleSelectRebalance} 
          />
        )}
        
        {currentScreen === 'portfolio-manager' && selectedPortfolioId && (
          <PortfolioManager 
            portfolioId={selectedPortfolioId} 
            onBack={() => setCurrentScreen('dashboard')} 
          />
        )}
        
        {currentScreen === 'rebalance' && selectedPortfolioId && (
          <RebalanceCalculator 
            portfolioId={selectedPortfolioId} 
            onBack={() => setCurrentScreen('dashboard')} 
          />
        )}
        
        {currentScreen === 'settings' && (
          <AlertSettings 
            initialThreshold={alertThreshold} 
            initialEnabled={notificationEnabled} 
            onSettingsUpdate={handleSettingsUpdate} 
          />
        )}
      </main>
    </div>
  );
}
