import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '../components/ui/Button';
import { Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const [error, setError] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/" />;
  }

  const handleLogin = async () => {
    setError('');
    setLoadingMsg('Connecting safely...');
    
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(userDocRef);
      
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          email: (userCredential.user.email || '').substring(0, 150),
          username: (userCredential.user.displayName || 'Anonymous').substring(0, 30),
          trustScore: 0,
          joinedAt: serverTimestamp()
        });
      }
      
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('This login method is not enabled. Please enable it in Firebase Console.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoadingMsg('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm space-y-8 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
            <Shield className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold font-heading text-slate-100">
            Welcome to FindMe
          </h2>
          <p className="text-slate-400 text-sm font-medium">
            A safe space for emotional sharing and building trust. Log in securely to connect with others.
          </p>
        </div>

        {error && <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm text-center font-bold">{error}</div>}

        <div className="space-y-4 pt-4">
          <Button 
            onClick={handleLogin} 
            disabled={!!loadingMsg}
            className="w-full h-12 text-base font-bold bg-slate-800 text-slate-200 border-2 border-slate-700 hover:bg-slate-700 hover:border-slate-600 shadow-none flex items-center justify-center gap-3 transition-all"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335"/>
              <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4"/>
              <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05"/>
              <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853"/>
            </svg>
            {loadingMsg || 'Continue with Google'}
          </Button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <div className="bg-indigo-500/10 p-4 rounded-xl">
            <h3 className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 mb-1">Our Promise</h3>
            <p className="text-xs font-medium text-indigo-300 leading-relaxed">We use Google to verify identities without storing passwords. Your emotional updates and circle chats remain secure.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
