import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Heart, MessageSquare, TrendingUp } from 'lucide-react';

export function Dashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalSupportReceived: 0,
    favoriteEmotion: '-',
    posts: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'posts'),
      where('authorId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let postsCount = 0;
      let supportCount = 0;
      const emotionCounts: Record<string, number> = {};
      const recentPosts: any[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        postsCount++;
        supportCount += data.supportCount || 0;
        emotionCounts[data.emotion] = (emotionCounts[data.emotion] || 0) + 1;
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
        totalSupportReceived: supportCount,
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
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center shadow-lg">
          <Activity className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-heading font-bold text-slate-100">{profile?.username}'s Dashboard</h2>
          <p className="text-sm text-slate-500 font-medium tracking-wide">Tracking your activity and emotional journey</p>
        </div>
      </div>

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
            <h3 className="text-xs font-bold uppercase tracking-wider">Support Received</h3>
          </div>
          <p className="text-3xl font-heading font-bold text-slate-100">{stats.totalSupportReceived}</p>
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
        <h3 className="text-lg font-heading font-bold text-slate-100 mb-6 px-2 tracking-tight">Emotional Timeline</h3>
        <div className="relative border-l-2 border-slate-800 ml-4 pl-6 space-y-6">
          {stats.posts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              No activity yet. Start posting to track your journey!
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
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold mt-2">
                  <Heart className="w-3.5 h-3.5" />
                  {post.supportCount || 0} support
                </div>
              </div>
            )})
          )}
        </div>
      </div>
    </div>
  );
}
