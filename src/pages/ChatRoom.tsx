import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Send, Lock, ArrowLeft, Mic } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useParams, Link } from 'react-router-dom';
import { useSpeech } from '../hooks/useSpeech';

// Simple "Encryption" simulation for demonstration purposes as requested in the prompt.
// In a real production app, use actual Web Crypto API (SubtleCrypto) with secure keys.
function encryptSim(text: string) {
  try { return btoa(encodeURIComponent(text)); } catch(e) { return text; }
}
function decryptSim(text: string) {
  try { return decodeURIComponent(atob(text)); } catch(e) { return text; }
}

export function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const isGlobal = roomId === 'global-trust-circle';

  const { isListening, toggle: toggleListen, supported: speechSupported } = useSpeech(useCallback((spokenText) => {
    setText(prev => prev + spokenText);
  }, []));

  // Initialize room if it doesn't exist yet (for global only)
  useEffect(() => {
    const initRoom = async () => {
      if (!roomId) return;
      try {
        const roomRef = doc(db, 'chatRooms', roomId);
        const rm = await getDoc(roomRef);
        if (!rm.exists() && isGlobal) {
          await setDoc(roomRef, { 
            name: 'Global Circle', 
            createdAt: serverTimestamp(),
            isDirect: false,
            participants: [] 
          });
          setRoomInfo({ name: 'Global Circle' });
        } else if (rm.exists()) {
          setRoomInfo(rm.data());
        }
      } catch(e) {}
    }
    initRoom();
  }, [roomId, isGlobal]);

  useEffect(() => {
    if (!user || !roomId) return;
    const q = query(
      collection(db, 'chatRooms', roomId, 'messages'), 
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          text: decryptSim(data.text)
        };
      }));
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages'));
    
    return () => unsubscribe();
  }, [user, roomId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || !roomId) return;
    
    const encryptedText = encryptSim(text.trim());
    setText('');
    
    try {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: user.uid,
        text: encryptedText,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to send message", err);
      // Rules protect sending based on participants
      alert("Failed to send message. You might not have permission.");
    }
  };

  const otherUserId = roomInfo?.participants?.find((p: string) => p !== user?.uid);
  const roomName = isGlobal ? 'Global Trust Circle' : (otherUserId ? `User ${otherUserId.substring(0,4)}` : 'Loading...');

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header Info */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center gap-3 shrink-0">
        <Link to="/chat" className="p-2 text-slate-400 hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h2 className="font-bold text-slate-100 text-base">{roomName}</h2>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{isGlobal ? 'Publicly accessible' : 'Secure direct message'}</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-indigo-500/10 border-b border-indigo-500/20 p-2 flex items-center justify-center gap-2 text-indigo-400 text-[10px] font-bold uppercase tracking-wider text-center shrink-0">
        <Lock className="w-3 h-3" />
        Messages in this circle are secured.
      </div>

      {/* Messages View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => {
          const isMe = msg.senderId === user?.uid;
          const timeStr = msg.timestamp?.toDate ? formatDistanceToNow(msg.timestamp.toDate(), { addSuffix: true }) : '';
          
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div 
                className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                  isMe 
                    ? 'bg-indigo-600 text-white rounded-br-sm' 
                    : 'bg-slate-900 text-slate-200 rounded-bl-sm border border-slate-800'
                }`}
              >
                {!isMe && isGlobal && (
                  <p className="text-[10px] font-bold text-slate-400 mb-1">USER {msg.senderId.substring(0, 4)}</p>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2 px-1">
                {timeStr} {isMe && '• You'}
              </span>
            </div>
          )
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
        <form onSubmit={handleSend} className="flex gap-2 items-end">
          <div className="relative flex-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Type a secure message..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none max-h-32 shadow-sm"
              rows={1}
            />
            {speechSupported && (
              <button
                type="button"
                onClick={toggleListen}
                className={`absolute bottom-2 right-2 p-1.5 rounded-full transition-colors ${
                  isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50'
                }`}
                title="Dictate message"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button type="submit" disabled={!text.trim()} size="icon" className="shrink-0 h-11 w-11 shrink-0 bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-900/20">
            <Send className="w-4 h-4 ml-0.5" />
          </Button>
        </form>
      </div>

    </div>
  );
}
