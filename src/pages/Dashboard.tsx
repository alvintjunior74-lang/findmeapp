import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Heart, MessageSquare, TrendingUp, ThumbsUp, Smile, User, Settings, Save } from 'lucide-react';

export function Dashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalInteractions: 0,
    favoriteEmotion: '-',
    posts: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (profile) {
      setNewUsername(profile.username || '');
      setNewPhone(profile.phone || '');
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newUsername.trim()) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        username: newUsername.trim(),
        phone: newPhone.trim()
      });
      setIsEditingProfile(false);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error("Error updating profile:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const isTherapist = profile?.role === 'therapist';

  useEffect(() => {
    if (!user) return;

    const postsRef = collection(db, 'posts');
    const q = isTherapist 
      ? query(postsRef) // Fetch all to filter or use a specific query
      : query(postsRef, where('authorId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let postsCount = 0;
      let supportCount = 0;
      const emotionCounts: Record<string, number> = {};
      const recentPosts: any[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        // If therapist, only show "high emotion" posts in the feed part
        if (isTherapist && data.emotion === 'neutral') return;

        postsCount++;
        const interactions = Number(data.supportCount || 0) + Number(data.likeCount || 0) + Number(data.hugCount || 0);
        supportCount += interactions;
        if (data.emotion && data.emotion !== 'neutral') {
          emotionCounts[data.emotion] = (emotionCounts[data.emotion] || 0) + 1;
        }
        recentPosts.push({ id: doc.id, ...data });
      });

      let topEmotion = '-';
      let maxCount = 0;
      Object.entries(emotionCounts).forEach(([emo, count]) => {
        if (count > maxCount) {
          maxCount = count;
          topEmotion = emo;
        }
      });

      // Sort recent posts (client side since we can't orderBy without composite index over authorId & createdAt)
      recentPosts.sort((a, b) => {
        const tA = (a.createdAt || a.timestamp)?.toMillis?.() || 0;
        const tB = (b.createdAt || b.timestamp)?.toMillis?.() || 0;
        return tA - tB; // Sort ascending to detect shifts
      });

      // Detect shifts
      let previousEmotion = null;
      const timelinePosts = recentPosts.map(post => {
        const isShift = previousEmotion && previousEmotion !== post.emotion;
        const shiftFrom = previousEmotion;
        previousEmotion = post.emotion;
        return { ...post, isShift, shiftFrom };
      });

      // Reverse to show newest at the top
      timelinePosts.reverse();

      setStats({
        totalPosts: postsCount,
        totalInteractions: supportCount,
        favoriteEmotion: topEmotion,
        posts: timelinePosts
      });
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'posts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading your dashboard...</div>;
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center shadow-lg">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-heading font-bold text-slate-100">{profile?.username}'s {isTherapist ? 'Therapist Portal' : 'Dashboard'}</h2>
            <p className="text-sm text-slate-500 font-medium tracking-wide">{isTherapist ? 'Reviewing community emotional well-being' : 'Tracking your activity and emotional journey'}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsEditingProfile(!isEditingProfile)}
          className={`p-2 rounded-xl border transition-all ${isEditingProfile ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {isEditingProfile && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
           <div className="flex items-center gap-2 mb-4 text-indigo-400">
              <User className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Profile Settings</h3>
           </div>
           <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Username</label>
                <input 
                  type="text" 
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Your display name"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Phone Number (Optional)</label>
                <input 
                  type="tel" 
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="+1 234 567 890"
                />
                <p className="mt-1.5 text-[10px] text-slate-500 ml-1">Adding your phone number allows friends to call you directly to talk about feelings.</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isUpdating || !newUsername.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isUpdating ? 'Saving...' : 'Update Profile'}
                </button>
              </div>
           </form>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Metric Cards */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm transform transition-all hover:scale-[1.02]">
          <div className="flex items-center gap-2 text-indigo-400 mb-3">
            <MessageSquare className="w-5 h-5" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Total Posts</h3>
          </div>
          <p className="text-3xl font-heading font-bold text-slate-100">{stats.totalPosts}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm transform transition-all hover:scale-[1.02]">
          <div className="flex items-center gap-2 text-rose-400 mb-3">
            <Heart className="w-5 h-5" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Interactions</h3>
          </div>
          <p className="text-3xl font-heading font-bold text-slate-100">{stats.totalInteractions}</p>
        </div>

        <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm transform transition-all hover:scale-[1.02]">
          <div className="flex items-center gap-2 text-emerald-400 mb-3">
            <TrendingUp className="w-5 h-5" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Most Frequent Emotion</h3>
          </div>
          <p className="text-2xl font-heading font-bold text-slate-100 capitalize">{stats.favoriteEmotion || 'None'}</p>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-heading font-bold text-slate-100 mb-6 px-2 tracking-tight">
          {isTherapist ? 'Recent Community Posts' : 'Emotional Timeline'}
        </h3>
        <div className="relative border-l-2 border-slate-800 ml-4 pl-6 space-y-6">
          {stats.posts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              {isTherapist ? 'No community posts found to review.' : 'No activity yet. Start posting to track your journey!'}
            </div>
          ) : (
            stats.posts.map((post, index) => {
              const dateObj = (post.createdAt || post.timestamp)?.toDate?.();
              
              return (
              <div key={post.id} className="relative bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col gap-2 transition-all hover:border-slate-700">
                {/* Timeline Dot */}
                <div className={`absolute w-3 h-3 rounded-full -left-[29px] top-5 border-[3px] border-slate-950 ${
                  post.emotion === 'happy' ? 'bg-emerald-400' :
                  post.emotion === 'sad' ? 'bg-blue-400' :
                  post.emotion === 'angry' ? 'bg-rose-400' :
                  post.emotion === 'anxious' ? 'bg-amber-400' :
                  'bg-slate-400'
                }`} />
                
                {post.isShift && (
                  <div className="flex items-center gap-2 mb-1 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    <TrendingUp className="w-3 h-3 text-indigo-400" />
                    <span>Shifted from {post.shiftFrom}</span>
                  </div>
                )}

                <div className="flex justify-between items-start">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                    post.emotion === 'happy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    post.emotion === 'sad' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                    post.emotion === 'angry' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                    post.emotion === 'anxious' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                  }`}>
                    {post.emotion}
                  </span>
                  {dateObj && (
                    <span className="text-xs text-slate-500 font-medium">
                      {formatDistanceToNow(dateObj, { addSuffix: true })}
                    </span>
                  )}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mt-1">
                  "{post.content}"
                </p>
                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mt-2">
                  <div className="flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3 text-indigo-400" />
                    {post.likeCount || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-rose-400" />
                    {post.supportCount || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <Smile className="w-3 h-3 text-amber-400" />
                    {post.hugCount || 0}
                  </div>
                </div>
              </div>
            )})
          )}
        </div>
      </div>
    </div>
  );
}
