import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, deleteDoc, or, where } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Heart, Send, Sparkles, Trash2, Edit2, Save, MessageCircle, EyeOff, Eye, Share2, Bot, Mic, Volume2, Twitter, Facebook, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { getAIAdvice, AIPersona } from '../lib/gemini';
import { useSpeech } from '../hooks/useSpeech';
import { speak } from '../lib/tts';

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

  const { isListening, toggle: toggleListen, supported: speechSupported } = useSpeech(useCallback((text) => {
    setContent(prev => prev + text);
  }, []));

  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [activeListenPostId, setActiveListenPostId] = useState<string | null>(null);
  const [sharingPostId, setSharingPostId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { isListening: isReplyListening, toggle: toggleReplyListen, supported: replySpeechSupported } = useSpeech(useCallback((text) => {
    if (activeListenPostId) {
      setReplyDrafts(prev => ({ ...prev, [activeListenPostId]: (prev[activeListenPostId] || '') + text }));
    }
  }, [activeListenPostId]));

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
  };

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'posts'), 
      or(where('authorId', '==', user.uid), where('isAnonymous', '==', true))
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
        content: content.trim(),
        emotion: emotion || 'neutral',
        timestamp: serverTimestamp(),
        supportCount: 0,
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

  const handleSupport = async (postId: string) => {
    try {
      await updateDoc(doc(db, 'posts', postId), {
        supportCount: increment(1)
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (err) {
      console.error(err);
      alert('Failed to delete post.');
    }
  };

  const startEdit = (post: any) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setEditEmotion(post.emotion);
    setEditIsAnonymous(post.isAnonymous ?? true);
  };

  const saveEdit = async (e: React.FormEvent, postId: string) => {
    e.preventDefault();
    if (!editContent.trim()) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'posts', postId), {
        content: editContent.trim(),
        emotion: editEmotion,
        isAnonymous: editIsAnonymous
      });
      setEditingPostId(null);
    } catch (err) {
      console.error(err);
      alert('Failed to update post.');
    } finally {
      setIsSaving(false);
    }
  };

  const startDirectChat = async (targetUserId: string) => {
    if (!user) return;
    try {
      const roomRef = collection(db, 'chatRooms');
      const newRoom = await addDoc(roomRef, {
        name: 'Direct Message',
        createdAt: serverTimestamp(),
        isDirect: true,
        participants: [user.uid, targetUserId]
      });
      navigate(`/chat/${newRoom.id}`);
    } catch(err) {
      console.error("Error creating chat", err);
      // Wait for chat rooms list page to show navigation
    }
  };


  const filteredPosts = posts.filter(post => post.content.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-4 space-y-6 relative pb-24">
      
      {/* Create Post */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex justify-between items-end mb-4 border-b border-slate-800/50 pb-4">
          <h2 className="text-lg font-heading font-bold text-slate-100 px-1">Share your thoughts</h2>
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
              <button
                type="button"
                onClick={toggleListen}
                className={`absolute bottom-3 right-3 p-1.5 rounded-full transition-colors ${
                  isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-800/50 text-slate-400 hover:text-indigo-400 hover:bg-slate-800'
                }`}
                title="Dictate message"
              >
                <Mic className="w-4 h-4" />
              </button>
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
              <Button type="submit" disabled={isPosting || !content.trim()} size="sm" className="gap-2 shrink-0">
                Share <Send className="w-3.5 h-3.5" />
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
            <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm transition-all relative overflow-hidden group">
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
                <form onSubmit={(e) => saveEdit(e, post.id)} className="space-y-4 mb-4">
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
                <button 
                  onClick={() => handleSupport(post.id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-400 transition-colors group/btn"
                >
                  <Heart className={`w-4 h-4 ${post.supportCount > 0 ? 'text-rose-400 fill-rose-500/20' : 'group-hover/btn:fill-rose-500/20'}`} />
                  <span>{post.supportCount > 0 ? post.supportCount : 'Send support'}</span>
                </button>
                
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
                      <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 z-10 flex flex-col gap-1">
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

    </div>
  );
}
