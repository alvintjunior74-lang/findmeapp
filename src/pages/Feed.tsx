import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, deleteDoc, or, where, getDocs, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Heart, Send, Sparkles, Trash2, Edit2, Save, MessageCircle, EyeOff, Eye, Share2, Bot, Mic, Volume2, Twitter, Facebook, Copy, Activity, ThumbsUp, Smile, Shield, Search, UserPlus, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getAIAdvice, AIPersona } from '../lib/gemini';
import { useSpeech } from '../hooks/useSpeech';
import { speak } from '../lib/tts';
import { encryptSim } from '../lib/encryption';

const EMOTIONS = [
  { id: 'happy', label: 'Happy', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { id: 'sad', label: 'Sad', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  { id: 'anxious', label: 'Anxious', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  { id: 'tired', label: 'Tired', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  { id: 'hopeful', label: 'Hopeful', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
];

export function Feed() {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [emotion, setEmotion] = useState('neutral');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [isPosting, setIsPosting] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editEmotion, setEditEmotion] = useState('neutral');
  const [editIsAnonymous, setEditIsAnonymous] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [aiReplies, setAiReplies] = useState<Record<string, { loading: boolean, text?: string }>>({});
  const [aiPersona, setAiPersona] = useState<AIPersona>('empathetic');
  const navigate = useNavigate();
  const contentInputRef = React.useRef<HTMLTextAreaElement>(null);

  const [autoSpeak, setAutoSpeak] = useState(false);
  const { isListening, toggle: toggleListen, supported: speechSupported } = useSpeech(useCallback((text) => {
    setContent(prev => prev + text);
  }, []), { continuous: true });

  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [activeListenPostId, setActiveListenPostId] = useState<string | null>(null);
  const [sharingPostId, setSharingPostId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRooms, setUserRooms] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userSearchText, setUserSearchText] = useState('');

  useEffect(() => {
    if (!user || !isSearchingUsers) return;
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        setAllUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.id !== user.uid));
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();
  }, [user, isSearchingUsers]);

  const handleNativeContactShare = async (post: any) => {
    // If Web Share API is available, it's often more useful for general "sharing with contacts"
    // as it allows selecting WhatsApp, SMS, etc.
    const shareData = {
      title: 'Safespace - A Safe Place for Feelings',
      text: `Hey, I wanted to share this with you: "${post.content}"`,
      url: window.location.origin
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error('Share error:', err);
      }
    }

    // Fallback to Contact Picker if supported
    if (!('contacts' in navigator && 'select' in (navigator as any).contacts)) {
      alert('Native Contact Sharing is not fully supported on this browser. Try using the "Search Users" option instead!');
      return;
    }

    try {
      const props = ['name', 'email', 'tel'];
      const opts = { multiple: false };
      const contacts = await (navigator as any).contacts.select(props, opts);
      
      if (contacts.length > 0) {
        const contact = contacts[0];
        const contactTel = contact.tel?.[0];
        
        if (contactTel) {
          if (window.confirm(`Would you like to call ${contact.name?.[0] || 'your friend'} right now?`)) {
            window.location.href = `tel:${contactTel}`;
            return;
          }
        }

        const contactEmail = contact.email?.[0];
        if (!contactEmail) {
          alert('No email found for this contact to verify if they are on Safespace.');
          return;
        }

        const q = query(collection(db, 'users'), where('email', '==', contactEmail));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          alert(`Contact ${contact.name?.[0]} is not yet on Safespace. Use the standard share menu to invite them!`);
        } else {
          const targetUser = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          handleDirectShare(post, targetUser);
        }
      }
    } catch (err) {
      console.error('Contact picker error:', err);
    }
  };

  const handleQuickMoodShare = async () => {
    const text = `Hey, I'm feeling a bit ${emotion} right now and wanted to reach out.`;
    handleNativeContactShare({ content: text });
  };

  const handleMakeCall = (phoneNumber: string) => {
    if (!phoneNumber) return;
    if (window.confirm(`Do you want to call this person to talk about your feelings?`)) {
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  const handleDirectShare = async (post: any, targetUser: any) => {
    if (!user) return;
    
    try {
      // Find or create a DM room
      const roomId = user.uid < targetUser.id 
        ? `${user.uid}_${targetUser.id}` 
        : `${targetUser.id}_${user.uid}`;
      
      const roomRef = doc(db, 'chatRooms', roomId);
      await setDoc(roomRef, {
        name: 'Direct Message',
        participants: [user.uid, targetUser.id],
        isDirect: true,
        createdAt: serverTimestamp()
      }, { merge: true });

      await handleShareToChat(post, roomId);
      setIsSearchingUsers(false);
      setSharingPostId(null);
    } catch (err) {
      console.error("Error direct sharing:", err);
      handleFirestoreError(err, OperationType.WRITE, 'chatRooms');
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chatRooms'),
      where('participants', 'array-contains', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUserRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'chatRooms'));
    return () => unsubscribe();
  }, [user]);

  const handleShareToChat = async (post: any, roomId: string) => {
    if (!user) return;
    try {
      const text = `Check out this post: "${post.content.substring(0, 50)}${post.content.length > 50 ? '...' : ''}"`;
      const encryptedText = encryptSim(text);
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId: user.uid,
        senderName: profile?.username || 'Anonymous',
        text: encryptedText,
        postId: post.id, // For linking
        timestamp: serverTimestamp()
      });
      alert('Shared successfully!');
      setSharingPostId(null);
    } catch (err) {
      console.error("Error sharing to chat", err);
      handleFirestoreError(err, OperationType.WRITE, `chatRooms/${roomId}/messages`);
    }
  };

  const { isListening: isReplyListening, toggle: toggleReplyListen, supported: replySpeechSupported } = useSpeech(useCallback((text) => {
    if (activeListenPostId) {
      setReplyDrafts(prev => ({ ...prev, [activeListenPostId]: (prev[activeListenPostId] || '') + text }));
    }
  }, [activeListenPostId]), { continuous: true });

  const handleAskAI = async (post: any, fromReply: boolean = false) => {
    setAiReplies(prev => ({ ...prev, [post.id]: { loading: true } }));
    let advice;
    if (fromReply) {
      const replyContent = replyDrafts[post.id] || '';
      advice = await getAIAdvice(replyContent, post.emotion, post.content, aiPersona);
      setReplyDrafts(prev => ({ ...prev, [post.id]: '' }));
    } else {
      advice = await getAIAdvice(post.content, post.emotion, undefined, aiPersona);
    }
    setAiReplies(prev => ({ ...prev, [post.id]: { loading: false, text: advice } }));
    if (autoSpeak && advice) {
       speak(advice);
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'posts')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => {
        const t1 = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const t2 = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return t2 - t1;
      });
      setPosts(docs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'posts'));
    return () => unsubscribe();
  }, [user]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;
    setIsPosting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorRole: profile?.role || 'user',
        content: content.trim(),
        emotion: emotion || 'neutral',
        timestamp: serverTimestamp(),
        likeCount: 0,
        supportCount: 0,
        hugCount: 0,
        isAnonymous: isAnonymous
      });
      setContent('');
      setEmotion('neutral');
    } catch (err) {
      console.error(err);
      alert('Failed to post. Check rules.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleReaction = async (postId: string, type: 'likeCount' | 'supportCount' | 'hugCount') => {
    try {
      await updateDoc(doc(db, 'posts', postId), {
        [type]: increment(1)
      });
    } catch (err) {
      console.error(`Error adding ${type}:`, err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (err) {
      console.error("Delete Error:", err);
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const startEdit = (post: any) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setEditEmotion(post.emotion);
    setEditIsAnonymous(post.isAnonymous ?? true);
  };

  const [therapistAdvice, setTherapistAdvice] = useState<Record<string, any[]>>({});
  const isTherapist = profile?.role === 'therapist';

  const fetchTherapistAdvice = async (postId: string) => {
    try {
      const adviceRef = collection(db, 'posts', postId, 'therapistAdvice');
      const q = query(adviceRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const advice = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTherapistAdvice(prev => ({ ...prev, [postId]: advice }));
    } catch (err) {
      console.error("Error fetching therapist advice:", err);
    }
  };

  useEffect(() => {
    if (posts.length > 0) {
      posts.forEach(post => fetchTherapistAdvice(post.id));
    }
  }, [posts]);

  const handleTherapistAdvice = async (postId: string) => {
    if (!user || !profile || profile.role !== 'therapist') return;
    const adviceText = replyDrafts[postId] || '';
    if (!adviceText.trim()) return;

    try {
      await addDoc(collection(db, 'posts', postId, 'therapistAdvice'), {
        therapistId: user.uid,
        therapistName: profile.username,
        content: adviceText.trim(),
        createdAt: serverTimestamp()
      });
      setReplyDrafts(prev => ({ ...prev, [postId]: '' }));
      fetchTherapistAdvice(postId);
    } catch (err) {
      console.error("Error saving therapist advice:", err);
      handleFirestoreError(err, OperationType.WRITE, `posts/${postId}/therapistAdvice`);
    }
  };

  const [showHistory, setShowHistory] = useState<Record<string, boolean>>({});
  const [postHistory, setPostHistory] = useState<Record<string, any[]>>({});

  const fetchHistory = async (postId: string) => {
    if (showHistory[postId]) {
      setShowHistory(prev => ({ ...prev, [postId]: false }));
      return;
    }

    try {
      const historyRef = collection(db, 'posts', postId, 'history');
      const q = query(historyRef, orderBy('editedAt', 'desc'));
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPostHistory(prev => ({ ...prev, [postId]: history }));
      setShowHistory(prev => ({ ...prev, [postId]: true }));
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const saveEdit = async (e: React.FormEvent, post: any) => {
    e.preventDefault();
    if (!editContent.trim()) return;
    setIsSaving(true);
    try {
      const postRef = doc(db, 'posts', post.id);
      
      // Save current version to history before updating
      await addDoc(collection(postRef, 'history'), {
        content: post.content,
        emotion: post.emotion,
        isAnonymous: post.isAnonymous ?? true,
        editedAt: serverTimestamp(),
        authorId: post.authorId
      });

      await updateDoc(postRef, {
        content: editContent.trim(),
        emotion: editEmotion,
        isAnonymous: editIsAnonymous,
        lastEditedAt: serverTimestamp()
      });
      setEditingPostId(null);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `posts/${post.id}`);
      alert('Failed to update post.');
    } finally {
      setIsSaving(false);
    }
  };

  const startDirectChat = async (targetUserId: string) => {
    if (!user) return;
    try {
      // Check if room exists
      const roomsRef = collection(db, 'chatRooms');
      const q = query(roomsRef, where('isDirect', '==', true), where('participants', 'array-contains', user.uid));
      // In practice, we'd filter the other participant client-side since Firestore array-contains doesn't support multiple values easily in this way without more complex data structures.
      // But for a better "functional" feel, we at least query user's rooms.
      const snapshot = await getDocs(q);
      const existingRoom = snapshot.docs.find(d => (d.data().participants as string[]).includes(targetUserId));
      
      if (existingRoom) {
        navigate(`/chat/${existingRoom.id}`);
        return;
      }

      const newRoom = await addDoc(roomsRef, {
        name: 'Direct Message',
        createdAt: serverTimestamp(),
        isDirect: true,
        participants: [user.uid, targetUserId]
      });
      navigate(`/chat/${newRoom.id}`);
    } catch(err) {
      console.error("Error creating chat", err);
    }
  };


  const filteredPosts = posts.filter(post => post.content.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-4 space-y-6 relative pb-24">
      
      {/* New Header Actions */}
      <div className="max-w-4xl mx-auto mb-2 flex flex-wrap items-center gap-4">
        <button 
          onClick={handleQuickMoodShare}
          className="flex-1 min-w-[200px] flex items-center justify-center gap-3 p-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-2xl transition-all group overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <Phone className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
          <div className="text-left">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-tighter">Emergency Connection</p>
            <p className="text-sm font-bold text-slate-200">Share Mood with Friend</p>
          </div>
        </button>

        <button 
          onClick={() => setIsSearchingUsers(true)}
          className="flex-1 min-w-[200px] flex items-center justify-center gap-3 p-4 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-2xl transition-all group"
        >
          <UserPlus className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
          <div className="text-left">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-tighter">Community</p>
            <p className="text-sm font-bold text-slate-200">Find Someone to Talk To</p>
          </div>
        </button>
      </div>
      
      {/* Create Post */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-end mb-4 border-b border-slate-800/50 pb-4">
          <h2 className="text-lg font-heading font-bold text-slate-100 px-1">Share your thoughts</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setAutoSpeak(!autoSpeak)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all ${
                autoSpeak ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-slate-800/50 border-transparent text-slate-500 hover:text-slate-400'
              }`}
              title="Automatically read AI responses aloud"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Auto-Speak: {autoSpeak ? 'ON' : 'OFF'}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium whitespace-nowrap">AI Persona:</span>
              <select
                value={aiPersona}
                onChange={(e) => setAiPersona(e.target.value as AIPersona)}
                className="bg-slate-950/50 border border-slate-800 text-slate-300 text-xs rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="empathetic">Empathetic</option>
                <option value="direct">Direct</option>
                <option value="humorous">Humorous</option>
              </select>
            </div>
          </div>
        </div>
        <form onSubmit={handlePost} className="space-y-4">
          <div className="relative">
            <textarea
              ref={contentInputRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"How are you feeling, " + (profile?.username || 'friend') + "?"}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 pb-10 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow resize-none"
              rows={3}
              maxLength={1000}
            />
            {speechSupported && (
              <div className="absolute bottom-3 right-3 flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleListen}
                  className={`p-1.5 rounded-full transition-colors ${
                    isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800/50 text-slate-400 hover:text-indigo-400 hover:bg-slate-800'
                  }`}
                  title="Dictate message"
                >
                  <Mic className="w-4 h-4" />
                </button>
                {content.trim() && (
                  <button
                    type="submit"
                    className="p-1.5 text-indigo-400 hover:bg-indigo-500/10 rounded-full transition-all"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map(emo => (
                <button
                  key={emo.id}
                  type="button"
                  onClick={() => setEmotion(emo.id)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    emotion === emo.id 
                      ? emo.color + ' ring-1 ring-current' 
                      : 'bg-slate-800/50 border-transparent text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {emo.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <button 
                type="button" 
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${isAnonymous ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-400'}`}
              >
                {isAnonymous ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {isAnonymous ? 'Anonymous' : 'Public'}
              </button>
              <button
                type="button"
                onClick={handleQuickMoodShare}
                className="px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl transition-all flex items-center gap-2 group"
              >
                <Phone className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                <span className="font-bold text-xs">Send to Friend</span>
              </button>
              <Button type="submit" disabled={isPosting || !content.trim()} size="sm" className="gap-2 shrink-0">
                Post <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Search and Filter */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Sparkles className="h-4 w-4 text-slate-500" />
        </div>
        <input
          type="text"
          placeholder="Search posts by keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow"
        />
      </div>

      {/* Feed List */}
      <div className="space-y-4">
        {filteredPosts.map(post => {
          const matchedEmotion = EMOTIONS.find(e => e.id === post.emotion);
          const timeStr = post.timestamp?.toDate ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true }) : 'just now';
          const isOwnPost = user?.uid === post.authorId;
          const showAvatar = !post.isAnonymous || isOwnPost;
          
          return (
            <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm transition-all relative group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${post.isAnonymous ? 'bg-slate-800 text-slate-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    {showAvatar ? post.authorId.substring(0,2).toUpperCase() : '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <p className="text-sm font-bold text-slate-200">
                         {post.isAnonymous ? 'Anonymous' : 'User ' + post.authorId.substring(0, 4)}
                       </p>
                       {post.authorRole === 'therapist' && !post.isAnonymous && (
                         <span className="flex items-center gap-1 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">
                           <Shield className="w-2.5 h-2.5" /> Therapist
                         </span>
                       )}
                       <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{timeStr}</span>
                    </div>
                    {matchedEmotion && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block border font-medium ${matchedEmotion.color}`}>
                        feeling {matchedEmotion.label.toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>
              {isOwnPost && editingPostId !== post.id && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchHistory(post.id)} className="flex items-center gap-1.5 p-1.5 text-xs font-medium text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded-md transition-colors" title="View History">
                    <Activity className="w-4 h-4" /> History
                  </button>
                  <button onClick={() => startEdit(post)} className="flex items-center gap-1.5 p-1.5 text-xs font-medium text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded-md transition-colors" aria-label="Edit">
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button onClick={() => handleDeletePost(post.id)} className="flex items-center gap-1.5 p-1.5 text-xs font-medium text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-md transition-colors" aria-label="Delete">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
            </div>

            {editingPostId === post.id ? (
              <form onSubmit={(e) => saveEdit(e, post)} className="space-y-4 mb-4">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow resize-none"
                    rows={3}
                    maxLength={1000}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2">
                      {EMOTIONS.map(emo => (
                        <button
                          key={emo.id}
                          type="button"
                          onClick={() => setEditEmotion(emo.id)}
                          className={`text-xs px-2 py-1 rounded-full border transition-all ${
                            editEmotion === emo.id 
                              ? emo.color + ' ring-1 ring-current' 
                              : 'bg-slate-800/50 border-transparent text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {emo.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => setEditIsAnonymous(!editIsAnonymous)}
                        className={`flex items-center gap-1 text-xs font-medium mr-2 ${editIsAnonymous ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-400'}`}
                      >
                        {editIsAnonymous ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPostId(null)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSaving || !editContent.trim()} size="sm" className="gap-1.5">
                        <Save className="w-3.5 h-3.5" /> Save
                      </Button>
                    </div>
                  </div>
                </form>
              ) : (
                <p className="text-slate-300 leading-relaxed text-sm mb-4">
                  {post.content}
                </p>
              )}
              
              {showHistory[post.id] && (
                <div className="mt-4 mb-6 space-y-4 border-l-2 border-indigo-500/20 pl-4 py-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Edit History</h4>
                  {postHistory[post.id]?.length === 0 ? (
                    <p className="text-xs text-slate-500">No previous versions found.</p>
                  ) : (
                    postHistory[post.id]?.map((h: any) => (
                      <div key={h.id} className="text-xs space-y-1 opacity-70">
                        <div className="flex justify-between text-[9px] font-medium text-slate-500">
                          <span>{h.editedAt?.toDate ? formatDistanceToNow(h.editedAt.toDate(), { addSuffix: true }) : 'Recently'}</span>
                          <span className="uppercase">{h.emotion}</span>
                        </div>
                        <p className="text-slate-400 italic">"{h.content}"</p>
                      </div>
                    ))
                  )}
                </div>
              )}
              
              {therapistAdvice[post.id]?.length > 0 && (
                <div className="mt-4 mb-6 space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 px-1">
                    <Activity className="w-3 h-3" /> Professional Support
                  </h4>
                  {therapistAdvice[post.id].map((advice: any) => (
                    <div key={advice.id} className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 relative group/advice">
                      <div className="flex items-center gap-2 mb-2 text-emerald-400">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold">
                          {advice.therapistName?.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-bold">Therapist {advice.therapistName}</span>
                        <span className="text-[9px] text-slate-500 ml-auto">
                          {advice.createdAt?.toDate ? formatDistanceToNow(advice.createdAt.toDate(), { addSuffix: true }) : 'Recently'}
                        </span>
                        {user?.uid === advice.therapistId && (
                          <button
                            onClick={async () => {
                              if (window.confirm("Delete this advice?")) {
                                try {
                                  await deleteDoc(doc(db, 'posts', post.id, 'therapistAdvice', advice.id));
                                  fetchTherapistAdvice(post.id);
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.DELETE, `posts/${post.id}/therapistAdvice/${advice.id}`);
                                }
                              }
                            }}
                            className="p-1 text-rose-400 hover:bg-rose-500/10 rounded ml-1"
                            title="Delete Advice"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed italic">
                        "{advice.content}"
                      </p>
                      <button 
                         onClick={() => speak(advice.content)} 
                         className="absolute top-4 right-4 p-1.5 text-emerald-400 opacity-0 group-hover/advice:opacity-100 transition-all hover:bg-emerald-500/10 rounded-lg"
                         title="Read aloud"
                      >
                         <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {aiReplies[post.id] && (
                <div className="mb-4 mt-2 bg-indigo-900/10 border border-indigo-500/20 rounded-xl p-4 relative">
                  <div className="flex items-center gap-2 mb-2 text-indigo-400">
                    <Bot className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">AI Companion</span>
                  </div>
                  {aiReplies[post.id].loading ? (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse"></div>
                      <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse delay-75"></div>
                      <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse delay-150"></div>
                    </div>
                  ) : (
                    <div className="relative">
                      <p className="text-slate-300 text-sm leading-relaxed pr-8">
                        {aiReplies[post.id].text}
                      </p>
                      <button 
                        onClick={() => speak(aiReplies[post.id].text || '')} 
                        className="absolute top-0 right-0 p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg transition-colors"
                        title="Read aloud"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => handleReaction(post.id, 'likeCount')}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-400 transition-colors group/btn"
                    title="Like"
                  >
                    <ThumbsUp className={`w-4 h-4 ${post.likeCount > 0 ? 'text-indigo-400 fill-indigo-500/20' : 'group-hover/btn:fill-indigo-500/20'}`} />
                    <span className="min-w-[12px]">{post.likeCount > 0 ? post.likeCount : ''}</span>
                  </button>
                  
                  <button 
                    onClick={() => handleReaction(post.id, 'supportCount')}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-rose-400 transition-colors group/btn"
                    title="Support"
                  >
                    <Heart className={`w-4 h-4 ${post.supportCount > 0 ? 'text-rose-400 fill-rose-500/20' : 'group-hover/btn:fill-rose-500/20'}`} />
                    <span className="min-w-[12px]">{post.supportCount > 0 ? post.supportCount : ''}</span>
                  </button>

                  <button 
                    onClick={() => handleReaction(post.id, 'hugCount')}
                    className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-amber-400 transition-colors group/btn"
                    title="Hug"
                  >
                    <Smile className={`w-4 h-4 ${post.hugCount > 0 ? 'text-amber-400 fill-amber-500/20' : 'group-hover/btn:fill-amber-500/20'}`} />
                    <span className="min-w-[12px]">{post.hugCount > 0 ? post.hugCount : ''}</span>
                  </button>
                </div>
                
                <div className="flex items-center gap-3 flex-wrap justify-end mt-2 sm:mt-0">
                  {!aiReplies[post.id] && (
                    <button 
                      onClick={() => handleAskAI(post)}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-bold mr-2"
                    >
                      <Bot className="w-4 h-4" />
                      Get AI Advice
                    </button>
                  )}
                  <div className="relative">
                    <button 
                      onClick={() => setSharingPostId(sharingPostId === post.id ? null : post.id)}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors font-bold"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>

                    {sharingPostId === post.id && (
                      <div className="absolute bottom-full right-0 mb-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 z-20 flex flex-col gap-1 max-h-64 overflow-y-auto">
                        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-700 mb-1">
                          Share to Chat
                        </div>
                        {userRooms.length === 0 ? (
                          <div className="p-2 text-[10px] text-slate-500 text-center">No chats found. Join a trust circle first!</div>
                        ) : (
                          userRooms.map(room => {
                            const otherParticipant = room.participants?.find((p: string) => p !== user.uid);
                            const displayName = room.name === 'Direct Message' && otherParticipant 
                              ? `User ${otherParticipant.substring(0, 4)}` 
                              : room.name;
                            
                            return (
                              <button 
                                key={room.id}
                                onClick={() => handleShareToChat(post, room.id)}
                                className="flex items-center gap-2 p-2 text-xs text-slate-200 hover:bg-slate-700 rounded-lg transition-colors text-left w-full truncate"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="truncate">{displayName}</span>
                              </button>
                            );
                          })
                        )}

                        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-700 my-1">
                          Find Someone
                        </div>
                        <button 
                          onClick={() => setIsSearchingUsers(true)}
                          className="flex items-center gap-2 p-2 text-xs text-indigo-400 hover:bg-slate-700 rounded-lg transition-colors text-left w-full"
                        >
                          <Search className="w-3.5 h-3.5" />
                          <span>Search Users...</span>
                        </button>
                        <button 
                          onClick={() => handleNativeContactShare(post)}
                          className="flex items-center gap-2 p-2 text-xs text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors text-left w-full"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Phone Contacts</span>
                        </button>

                        <div className="px-2 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-700 my-1">
                          Social Media
                        </div>
                        <button onClick={() => {
                          const text = `"${post.content}" - Shared from Safespace`;
                          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
                          setSharingPostId(null);
                        }} className="flex items-center gap-2 p-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg transition-colors text-left w-full">
                           <Twitter className="w-4 h-4 text-blue-400" />
                           Twitter
                        </button>
                        <button onClick={() => {
                          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank');
                          setSharingPostId(null);
                        }} className="flex items-center gap-2 p-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg transition-colors text-left w-full">
                           <Facebook className="w-4 h-4 text-blue-600" />
                           Facebook
                        </button>
                        <button onClick={() => {
                          navigator.clipboard.writeText(`"${post.content}" - Shared from Safespace`);
                          alert('Copied to clipboard!');
                          setSharingPostId(null);
                        }} className="flex items-center gap-2 p-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg transition-colors text-left w-full">
                           <Copy className="w-4 h-4 text-slate-400" />
                           Copy Text
                        </button>
                      </div>
                    )}
                  </div>
                  {!isOwnPost && !post.isAnonymous && (
                    <button 
                      onClick={() => startDirectChat(post.authorId)}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-bold"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Chat
                    </button>
                  )}
                  {post.isAnonymous && (
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <Sparkles className="w-3 h-3" /> Anonymous
                    </div>
                  )}
                </div>
              </div>

              {/* Reply Input */}
              <div className="mt-4 flex gap-2 items-end border-t border-slate-800 pt-4">
                <div className="relative flex-1">
                  <textarea
                    value={replyDrafts[post.id] || ''}
                    onChange={e => setReplyDrafts(prev => ({ ...prev, [post.id]: e.target.value }))}
                    placeholder="Type a response to this post..."
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-3 pr-10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-shadow resize-none"
                    rows={1}
                  />
                  {replySpeechSupported && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isReplyListening && activeListenPostId === post.id) {
                          toggleReplyListen();
                          setActiveListenPostId(null);
                        } else {
                          if (isReplyListening) toggleReplyListen();
                          setActiveListenPostId(post.id);
                          setTimeout(toggleReplyListen, 50);
                        }
                      }}
                      className={`absolute bottom-2 right-2 p-1.5 rounded-full transition-colors ${
                        isReplyListening && activeListenPostId === post.id ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50'
                      }`}
                      title="Dictate response"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleAskAI(post, true)}
                  disabled={!replyDrafts[post.id]?.trim() || aiReplies[post.id]?.loading}
                  className="shrink-0 h-[46px] px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-indigo-900/20 text-sm font-bold flex items-center gap-1.5"
                  title="Have AI process your response"
                >
                  <Bot className="w-4 h-4" />
                  <span className="hidden sm:inline">Ask AI</span>
                </button>

                {isTherapist && (
                  <button
                    onClick={() => handleTherapistAdvice(post.id)}
                    disabled={!replyDrafts[post.id]?.trim()}
                    className="shrink-0 h-[46px] px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl shadow-lg shadow-emerald-900/20 text-sm font-bold flex items-center gap-1.5"
                    title="Provide professional support"
                  >
                    <Activity className="w-4 h-4" />
                    <span className="hidden sm:inline">Professional Advice</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {filteredPosts.length === 0 && posts.length > 0 && (
          <div className="text-center py-12 text-slate-500">
            <p className="text-sm">No posts found matching your search.</p>
          </div>
        )}
        {posts.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p className="text-sm">No posts yet. Be the first to share.</p>
          </div>
        )}
      </div>

      {/* Floating Action Button / Guide */}
      <button
        onClick={() => {
          document.getElementById('scroll-container')?.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(() => {
            contentInputRef.current?.focus();
          }, 300);
        }}
        className="fixed bottom-20 right-6 md:right-[calc(50%-18rem)] lg:right-[calc(50%-20rem)] z-40 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-5 py-3 shadow-xl transition-transform hover:scale-105 active:scale-95"
        title="Click here to post"
      >
        <Edit2 className="w-5 h-5" />
        <span className="font-bold text-sm">Post</span>
      </button>

      {isSearchingUsers && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
            <button 
              onClick={() => setIsSearchingUsers(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              Send to a Person
            </h3>
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text"
                placeholder="Search by username or email..."
                value={userSearchText}
                onChange={(e) => setUserSearchText(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-200"
              />
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {allUsers
                .filter(u => 
                  u.username?.toLowerCase().includes(userSearchText.toLowerCase()) || 
                  u.email?.toLowerCase().includes(userSearchText.toLowerCase())
                )
                .map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      const post = posts.find(p => p.id === sharingPostId);
                      if (post) handleDirectShare(post, u);
                    }}
                    className="w-full flex items-center gap-3 p-3 bg-slate-800/30 hover:bg-slate-800/60 border border-slate-800/50 rounded-xl transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold">
                      {u.username?.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{u.username}</p>
                      <p className="text-[10px] text-slate-500">{u.role === 'therapist' ? 'Qualified Therapist' : 'Member'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {u.phone && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMakeCall(u.phone);
                          }}
                          className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Call"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                      )}
                      <Send className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </button>
                ))}

              {allUsers.length > 0 && userSearchText && allUsers.filter(u => 
                  u.username?.toLowerCase().includes(userSearchText.toLowerCase()) || 
                  u.email?.toLowerCase().includes(userSearchText.toLowerCase())
                ).length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p className="text-sm">No users found matching "{userSearchText}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
