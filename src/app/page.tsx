"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const router = useRouter();
  const [featuredPlayers, setFeaturedPlayers] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // Added username state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  // Check for authenticated user on load
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
    });

    // Get current session
    checkUser();

    // Fetch players data
    fetchPlayers();

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // Check if user is already logged in
  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
    }
  };

  // Fetch player data
  const fetchPlayers = async () => {
    try {
      const response = await fetch("/data/players_with_prices.json");
      const data = await response.json();
      const randomPlayers = getRandomPlayers(data, 3);
      setFeaturedPlayers(randomPlayers);
    } catch (error) {
      console.error("Error loading player data:", error);
    }
  };

  // Get random players
  const getRandomPlayers = (players, count) => {
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Sign in with email and password
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Redirect to dashboard or display success message
      router.push("/my-team");
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Sign in with third-party providers
  const handleSocialSignIn = async (provider) => {
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

  // Sign out
  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4">
      {/* Sign In Section */}
      <div className="py-4 flex justify-between items-center">
        <h2 className="text-xl font-bold">Sign In</h2>
        {user ? (
          <div className="flex items-center space-x-4">
            <span>Welcome, {user.email}</span>
            <button onClick={handleSignOut} className="bg-gray-200 text-black px-4 py-2 rounded">
              Sign Out
            </button>
            <Link href="/my-team" className="bg-cyan-400 text-black px-4 py-2 rounded">
              My Team
            </Link>
          </div>
        ) : (
          <div className="flex space-x-4 w-full max-w-3xl">
            <div className="flex-1">
              <label htmlFor="email" className="block text-sm mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border-b-2 border-gray-300 pb-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="password" className="block text-sm mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border-b-2 border-gray-300 pb-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-end space-x-2">
              <button
                onClick={handleSignIn}
                disabled={loading}
                className="bg-cyan-400 text-black px-4 py-2 rounded disabled:opacity-50"
              >
                {loading ? "Signing In..." : "Sign In"}
              </button>
              <Link href="/forgot-password" className="text-sm text-blue-500 whitespace-nowrap">
                Forgot your password? →
              </Link>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}

      {/* Login with Social Media - only show if not logged in */}
      {!user && (
        <div className="py-4">
          <p className="text-center text-sm mb-2">or login with</p>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => handleSocialSignIn("facebook")}
              disabled={loading}
              className="bg-blue-600 text-white py-2 rounded flex items-center justify-center disabled:opacity-50"
            >
              <span className="mr-2">f</span> Login With Facebook
            </button>
            <button
              onClick={() => handleSocialSignIn("twitter")}
              disabled={loading}
              className="bg-black text-white py-2 rounded flex items-center justify-center disabled:opacity-50"
            >
              <span className="mr-2">𝕏</span> Login With X
            </button>
            <button
              onClick={() => handleSocialSignIn("google")}
              disabled={loading}
              className="bg-white border py-2 rounded flex items-center justify-center disabled:opacity-50"
            >
              <span className="mr-2">G</span> Login With Google
            </button>
            <button
              onClick={() => handleSocialSignIn("apple")}
              disabled={loading}
              className="bg-black text-white py-2 rounded flex items-center justify-center disabled:opacity-50"
            >
              <span className="mr-2">🍎</span> Login With Apple
            </button>
          </div>
        </div>
      )}

      {/* Register Banner - only show if not logged in */}
      {!user && (
        <div className="relative bg-gradient-to-r from-indigo-900 to-purple-700 text-white p-6 my-4 rounded overflow-hidden">
          <div className="z-10 relative flex justify-between items-center">
            <div>
              <div className="flex items-center mb-2">
                <div className="mr-2 font-bold">Fantasy</div>
              </div>
              <h2 className="text-xl font-bold mb-2">Register to Play Fantasy Cricket League</h2>
              <p className="max-w-lg">
                With millions of players worldwide, Fantasy Cricket is the ultimate cricket fantasy
                game. It's FREE to play and you can win great prizes throughout the season!
              </p>
            </div>
            <Link href="/register" className="bg-cyan-400 text-black px-6 py-2 rounded">
              Sign Up Now
            </Link>
          </div>
        </div>
      )}

      {/* Three Column Section */}
      <div className="grid grid-cols-3 gap-4 my-6">
        {/* Pick Your Squad */}
        <div className="bg-gray-100 rounded overflow-hidden">
          <div className="flex justify-center p-4">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="-mx-2 w-16">
                  <div className="h-20 bg-gray-200 rounded-lg transform rotate-3"></div>
                </div>
              ))}
          </div>
          <div className="bg-cyan-400 p-4">
            <h3 className="text-xl font-bold mb-2">Pick Your Squad</h3>
            <p className="text-sm mb-4">
              Use your budget to pick a squad of 11 players from across cricket teams.
            </p>
            <div className="grid grid-cols-3 gap-1 text-center text-xs">
              {featuredPlayers.map((player, index) => (
                <div key={index} className="bg-purple-900 text-white p-2">
                  <div>{player?.Player?.split(" ")[0] || "Player"}</div>
                  <div>{player?.Team_Name || player?.Country || "Team"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Leagues & Cups */}
        <div className="bg-gray-100 rounded overflow-hidden">
          <div className="bg-cyan-400 p-4">
            <h3 className="text-xl font-bold mb-2">Leagues & Cups</h3>
          </div>
          <div className="p-4">
            <div className="tabs flex border-b mb-4">
              <button className="px-4 py-2 font-semibold border-b-2 border-gray-300">
                Leagues
              </button>
              <button className="px-4 py-2">Cups</button>
            </div>
            <button className="w-full bg-purple-900 text-white text-left p-2 mb-4 rounded">
              General Leagues
            </button>
            <div className="flex justify-between items-center text-sm mb-2">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <div>Rank</div>
              </div>
              <div>Leagues</div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <div>32,482</div>
              <div>Mumbai</div>
            </div>
          </div>
        </div>

        {/* Create and Join Leagues */}
        <div className="bg-gradient-to-br from-cyan-400 to-blue-500 rounded p-6 text-black">
          <h3 className="text-xl font-bold mb-2">Create and Join Leagues</h3>
          <p className="mb-6">
            Play against friends and family, colleagues or a web community in invitational leagues
            and tournaments.
          </p>
        </div>
      </div>

      {/* Latest from The Scout */}
      <div className="my-6">
        <h2 className="text-xl font-bold mb-4">Latest from The Scout</h2>
        <div className="flex bg-white rounded overflow-hidden shadow">
          <div className="w-1/2">
            <div className="flex h-48">
              {/* These would be replaced with actual cricket player images */}
              <div className="flex-1 bg-blue-900"></div>
              <div className="flex-1 bg-yellow-600"></div>
              <div className="flex-1 bg-blue-300"></div>
              <div className="flex-1 bg-purple-500"></div>
            </div>
          </div>
          <div className="w-1/2 bg-cyan-400 p-6">
            <h3 className="text-xl font-bold mb-2">
              Who are now the best fantasy batters as popular picks are sidelined?
            </h3>
            <p className="mb-4">
              The Scout analyses the underlying statistics, assesses the upcoming fixtures and
              reveals the standout picks for the next two match days
            </p>
            <p className="text-xs">01/03/2025</p>
          </div>
        </div>
      </div>
    </div>
  );
}
