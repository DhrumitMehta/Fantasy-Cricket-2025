"use client"

import Link from "next/link";
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState(''); // Added username state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Sign up with email and password
  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            username: username, // Include username in user metadata
          }
        }
      });
      
      if (error) throw error;
      
      setSuccess(true);
      // Note: Supabase might require email confirmation before fully creating the account
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Sign up with third-party providers
  const handleSocialSignUp = async (provider) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      
      if (error) throw error;
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <Link href="/" className="text-blue-500 hover:underline mb-6 block">
        ← Back to Home
      </Link>
      
      <h1 className="text-2xl font-bold mb-6">Register for Fantasy Cricket</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
          Registration successful! Please check your email to confirm your account.
        </div>
      )}
      
      <form onSubmit={handleSignUp} className="space-y-4 mb-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
          <input 
            type="email" 
            id="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>
        
        {/* New username field */}
        <div>
          <label htmlFor="username" className="block text-sm font-medium mb-1">Username</label>
          <input 
            type="text" 
            id="username" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
          <input 
            type="password" 
            id="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">Confirm Password</label>
          <input 
            type="password" 
            id="confirmPassword" 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>
        
        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-cyan-400 text-black py-2 rounded font-medium disabled:opacity-50"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
      
      <div className="text-center">
        <p className="text-sm mb-4">or register with</p>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => handleSocialSignUp('google')}
            disabled={loading}
            className="bg-white border py-2 rounded flex items-center justify-center disabled:opacity-50"
          >
            <span className="mr-2">G</span> Google
          </button>
          <button 
            onClick={() => handleSocialSignUp('facebook')}
            disabled={loading}
            className="bg-blue-600 text-white py-2 rounded flex items-center justify-center disabled:opacity-50"
          >
            <span className="mr-2">f</span> Facebook
          </button>
        </div>
      </div>
      
      <p className="text-center mt-6">
        Already have an account?{' '}
        <Link href="/" className="text-blue-500 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}