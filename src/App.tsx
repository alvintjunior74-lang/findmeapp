import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Feed } from './pages/Feed';
import { ChatRoom } from './pages/ChatRoom';
import { ChatList } from './pages/ChatList';
import { Dashboard } from './pages/Dashboard';
import { Shield, Home, MessageSquare, LogOut, Palette, Activity } from 'lucide-react';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isChat = location.pathname.startsWith('/chat');
  const [theme, setTheme] = useState(localStorage.getItem('findme_theme') || 'dark');
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  useEffect(() => {
    document.body.className = '';
    if (theme === 'flower') {
      document.body.classList.add('theme-flower');
    } else {
      document.body.classList.add('theme-dark');
    }
    localStorage.setItem('findme_theme', theme);
  }, [theme]);
  
  return (
    <div className={`min-h-screen flex flex-col max-w-2xl mx-auto shadow-2xl overflow-hidden ${theme === 'flower' ? 'bg-white/90 backdrop-blur-sm border-x border-pink-200' : 'bg-slate-950 border-x border-slate-800'}`}>
      <header className={`px-8 py-5 flex justify-between items-center border-b shrink-0 ${theme === 'flower' ? 'bg-white/80 border-pink-100' : 'bg-slate-900 border-slate-800'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${theme === 'flower' ? 'bg-pink-100 shadow-pink-100/50' : 'bg-indigo-500/20 shadow-indigo-900/20'}`}>
            <Shield className={`w-5 h-5 ${theme === 'flower' ? 'text-pink-500' : 'text-indigo-400'}`} />
          </div>
          <h1 className={`text-xl font-heading font-bold tracking-tight ${theme === 'flower' ? 'text-pink-900' : 'text-slate-100'}`}>FindMe</h1>
        </div>
        <div className="flex items-center gap-2 relative">
          <button 
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className={`p-2 rounded-lg font-bold text-sm transition-all ${theme === 'flower' ? 'text-pink-600 hover:bg-pink-50' : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800'}`}
            title="Choose Theme"
          >
            <Palette className="w-5 h-5" />
          </button>
          
          {showThemeMenu && (
            <div className={`absolute top-full right-0 mt-2 p-2 rounded-xl shadow-xl border z-50 min-w-[120px] ${theme === 'flower' ? 'bg-white border-pink-100' : 'bg-slate-800 border-slate-700'}`}>
              <button 
                onClick={() => { setTheme('dark'); setShowThemeMenu(false); }}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 font-medium transition-colors ${theme === 'dark' ? 'bg-indigo-500/20 text-indigo-300' : (theme === 'flower' ? 'text-slate-600 hover:bg-slate-50' : 'text-slate-300 hover:bg-slate-700')}`}
              >
                Dark Theme
              </button>
              <button 
                onClick={() => { setTheme('flower'); setShowThemeMenu(false); }}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg font-medium transition-colors ${theme === 'flower' ? 'bg-pink-100 text-pink-700' : 'text-slate-300 hover:bg-slate-700'}`}
              >
                Flower Theme
              </button>
            </div>
          )}
          <button onClick={() => signOut(auth)} className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-sm transition-all ${theme === 'flower' ? 'text-pink-600 hover:bg-pink-50' : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800'}`}>
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>
      
      <main id="scroll-container" className="flex-1 overflow-y-auto relative">
        {children}
      </main>

      <nav className={`border-t flex justify-around p-2 shrink-0 ${theme === 'flower' ? 'bg-white/80 border-pink-100' : 'bg-slate-900 border-slate-800'}`}>
        <Link 
          to="/" 
          className={`flex flex-col items-center gap-1.5 px-6 py-2 rounded-xl transition-all ${
            location.pathname === '/' 
              ? (theme === 'flower' ? 'text-pink-600 bg-pink-50' : 'text-indigo-400 bg-indigo-500/10')
              : (theme === 'flower' ? 'text-pink-400 hover:text-pink-600 hover:bg-pink-50/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800')
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </Link>
        <Link 
          to="/dashboard" 
          className={`flex flex-col items-center gap-1.5 px-6 py-2 rounded-xl transition-all ${
            location.pathname === '/dashboard' 
              ? (theme === 'flower' ? 'text-pink-600 bg-pink-50' : 'text-indigo-400 bg-indigo-500/10')
              : (theme === 'flower' ? 'text-pink-400 hover:text-pink-600 hover:bg-pink-50/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800')
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Activity</span>
        </Link>
        <Link 
          to="/chat" 
          className={`flex flex-col items-center gap-1.5 px-6 py-2 rounded-xl transition-all ${
            isChat 
              ? (theme === 'flower' ? 'text-pink-600 bg-pink-50' : 'text-indigo-400 bg-indigo-500/10')
              : (theme === 'flower' ? 'text-pink-400 hover:text-pink-600 hover:bg-pink-50/50' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800')
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Chats</span>
        </Link>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout><Feed /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/chat" element={
            <ProtectedRoute>
              <Layout><ChatList /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/chat/:roomId" element={
            <ProtectedRoute>
              <Layout><ChatRoom /></Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
