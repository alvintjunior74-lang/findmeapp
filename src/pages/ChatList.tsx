import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function ChatList() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    
    const qrooms = query(
      collection(db, 'chatRooms'),
      where('participants', 'array-contains', user.uid)
    );
    
    // We get direct messages user is part of. 
    // And, we still have the global chat logic in ChatRoom. Let's list the global chat manually or via another query.
    // For simplicity, we just inject the global chat manually and add direct messages.

    const unsubscribe = onSnapshot(qrooms, (snapshot) => {
      const dmRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(dmRooms);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'chatRooms'));
    
    return () => unsubscribe();
  }, [user]);

  return (
    <div className="flex flex-col h-full bg-slate-950 p-4 space-y-6">
      <h2 className="text-xl font-bold font-heading text-slate-100 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-indigo-400" />
        Your Circles & Chats
      </h2>

      <div className="space-y-3">
        {/* Global Chat Room */}
        <Link 
          to="/chat/global-trust-circle" 
          className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:bg-slate-800 shadow-sm transition-colors"
        >
          <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-200">Global Trust Circle</h3>
            <p className="text-sm text-slate-400 font-medium">A public space to connect safely.</p>
          </div>
        </Link>
        
        {/* Direct Messages */}
        {rooms.map(room => {
          const otherUserId = room.participants?.find((p: string) => p !== user?.uid);
          const timeStr = room.createdAt?.toDate ? formatDistanceToNow(room.createdAt.toDate(), { addSuffix: true }) : '';

          return (
            <Link 
              key={room.id}
              to={`/chat/${room.id}`} 
              className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:bg-slate-800 shadow-sm transition-colors"
            >
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 font-bold rounded-xl flex items-center justify-center">
                {otherUserId ? otherUserId.substring(0,2).toUpperCase() : 'U'}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-200">
                  User {otherUserId ? otherUserId.substring(0, 4) : 'Unknown'}
                </h3>
                <p className="text-sm text-slate-400 font-medium">Direct Message {timeStr ? `• Created ${timeStr}` : ''}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  );
}
