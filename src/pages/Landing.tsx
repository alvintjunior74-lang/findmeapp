import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Shield, MessageSquare, Heart, Users, Activity, Phone, ArrowRight, Star, Quote } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

export function LandingPage() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to="/" />;
  }

  return (
    <div className="bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full -z-10" />
        
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-bold uppercase tracking-widest"
          >
            <Star className="w-3 h-3 fill-indigo-400" />
            Empowering Emotional Connection
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-heading font-black tracking-tighter leading-[0.9]"
          >
            THE CIRCLE OF <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-300 to-indigo-500">RADICAL TRUST</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl mx-auto text-lg text-slate-400 font-medium leading-relaxed"
          >
            FindMe is a secure emotional-sharing platform where your feelings matter. 
            Connect with a community that understands, backed by professional guidance.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Link to="/login">
              <Button size="lg" className="h-14 px-10 text-lg font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-900/40 gap-3 group">
                Join the Circle <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/login">
            <Button size="lg" variant="ghost" className="h-14 px-10 text-lg font-bold text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800">
              I am a Therapist
            </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats / Proof */}
      <section className="py-12 border-y border-slate-900 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center space-y-1">
            <p className="text-3xl font-black text-slate-100 italic tracking-tighter">12K+</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lives Touched</p>
          </div>
          <div className="text-center space-y-1">
            <p className="text-3xl font-black text-slate-100 italic tracking-tighter">450+</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Verified Therapists</p>
          </div>
          <div className="text-center space-y-1">
            <p className="text-3xl font-black text-slate-100 italic tracking-tighter">98%</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trust Rating</p>
          </div>
          <div className="text-center space-y-1">
            <p className="text-3xl font-black text-slate-100 italic tracking-tighter">∞ </p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Safe Conversations</p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-12 items-end mb-16">
          <div className="flex-1 space-y-4">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-[0.2em]">Our Architecture</h3>
            <h2 className="text-4xl md:text-5xl font-heading font-black tracking-tighter leading-none">BUILT FOR <br />SECURITY.</h2>
          </div>
          <p className="flex-1 text-slate-400 font-medium leading-relaxed">
            We've redesigned emotional support from the ground up, combining standard social interaction with professional oversight and strict identity verification.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Shield,
              title: "Identity Protection",
              desc: "Verified emotional updates. Share anonymously or publically while maintaining your circle of trust.",
              color: "indigo"
            },
            {
              icon: MessageSquare,
              title: "Deep Conversations",
              desc: "Direct messaging with E2EE-like privacy filters. Connect with people who actually care about your journey.",
              color: "emerald"
            },
            {
              icon: Phone,
              title: "Voice First",
              desc: "Sometimes text is not enough. Connect via voice calls directly with contacts who understand you.",
              color: "rose"
            },
            {
              icon: Activity,
              title: "Emotional Tracking",
              desc: "A personal dashboard to view your progress, trust scores, and engagement over time.",
              color: "indigo"
            },
            {
              icon: Users,
              title: "Therapist Circles",
              desc: "Professional therapists can join posts to provide guidance and advice to the community.",
              color: "amber"
            },
            {
              icon: Heart,
              title: "Supportive Echo",
              desc: "A reaction system focused on empathy—hugs, supports, and likes replace hollow metrics.",
              color: "pink"
            }
          ].map((feat, i) => (
            <div key={i} className="group p-8 bg-slate-900/30 border border-slate-800 rounded-3xl hover:bg-slate-900/50 transition-all hover:border-slate-700">
              <div className={`w-12 h-12 mb-6 rounded-2xl flex items-center justify-center bg-${feat.color}-500/10 text-${feat.color}-400 group-hover:scale-110 transition-transform`}>
                <feat.icon className="w-6 h-6" />
              </div>
              <h4 className="text-xl font-bold text-slate-100 mb-2">{feat.title}</h4>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-24 bg-indigo-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
        <div className="max-w-5xl mx-auto px-6 text-center space-y-12 relative z-10">
          <Quote className="w-16 h-16 text-indigo-400 mx-auto opacity-50" />
          <h2 className="text-3xl md:text-5xl font-heading font-black italic tracking-tighter text-white leading-tight">
            "FindMe shifted how I view online support. It's not just another app—it's a digital lifeline when everything feels heavy."
          </h2>
          <div className="space-y-1">
            <p className="text-white font-bold">Sarah J.</p>
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">Early Adopter</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-slate-900">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12">
          <div className="col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-indigo-400" />
              <span className="text-2xl font-black tracking-tighter">FindMe</span>
            </div>
            <p className="max-w-xs text-slate-500 font-medium text-sm">
              Creating a world where emotional honesty is rewarded with trust and genuine human connection.
            </p>
          </div>
          <div className="space-y-4">
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Platform</h5>
            <ul className="space-y-2 text-sm font-medium text-slate-500">
              <li><Link to="/login" className="hover:text-indigo-400 transition-colors">Shared Feed</Link></li>
              <li><Link to="/login" className="hover:text-indigo-400 transition-colors">Therapist Portal</Link></li>
              <li><Link to="/login" className="hover:text-indigo-400 transition-colors">Private Circles</Link></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Company</h5>
            <ul className="space-y-2 text-sm font-medium text-slate-500">
              <li><a href="#" className="hover:text-indigo-400 transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-indigo-400 transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-16 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-slate-900 mt-16">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">© 2026 FindMe Technologies. All Rights Reserved.</p>
          <div className="flex gap-6">
             <a href="#" className="text-slate-600 hover:text-indigo-400 transition-colors text-xs font-bold uppercase tracking-widest">Twitter</a>
             <a href="#" className="text-slate-600 hover:text-indigo-400 transition-colors text-xs font-bold uppercase tracking-widest">LinkedIn</a>
             <a href="#" className="text-slate-600 hover:text-indigo-400 transition-colors text-xs font-bold uppercase tracking-widest">Instagram</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
