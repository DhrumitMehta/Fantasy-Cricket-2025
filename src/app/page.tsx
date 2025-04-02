"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, FormEvent } from "react";
import { createClient, User, AuthError, Provider } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Player } from "@/types/player";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function Home() {
  const router = useRouter();
  const [featuredPlayers, setFeaturedPlayers] = useState<Player[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // Added username state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
  const getRandomPlayers = (players: Player[], count: number) => {
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Sign in with email and password
  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      router.push("/");
    } catch (error) {
      if (error instanceof AuthError) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  // Sign in with third-party providers
  const handleSocialSignIn = async (provider: Provider) => {
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
      if (error instanceof AuthError) {
        setError(error.message);
      } else {
        setError("An unexpected error occurred");
      }
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
    <div className="min-h-screen bg-[#1a1c2e]">
      {/* Hero Section with Cricket Stadium Background */}
      <div
        className={`relative ${
          !user ? "min-h-[600px] sm:min-h-[650px]" : "min-h-[300px]"
        } overflow-hidden`}
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1c2e]/90 to-[#1a1c2e] z-10" />

        {/* Content */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            {/* Left Side - Welcome Content */}
            <div className="text-white space-y-4 sm:space-y-6">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
                Your Ultimate <span className="text-[#4ade80]">Cricket Fantasy</span> Experience
              </h1>
              <p className="text-gray-300 text-base sm:text-lg">
                Build your dream team, compete in leagues, and experience the thrill of fantasy
                cricket like never before.
              </p>
              {!user && (
                <div className="flex flex-wrap gap-3 sm:gap-4">
                  <Link
                    href="/register"
                    className="bg-[#4ade80] hover:bg-[#22c55e] text-gray-900 px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg font-semibold transition-all transform hover:scale-105"
                  >
                    Get Started
                  </Link>
                  <a
                    href="#features"
                    className="border border-[#4ade80] text-[#4ade80] px-5 sm:px-8 py-2.5 sm:py-3 rounded-lg font-semibold hover:bg-[#4ade80]/10 transition-all"
                  >
                    Learn More
                  </a>
                </div>
              )}
            </div>

            {/* Right Side - Auth Form */}
            {!user ? (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 sm:p-8 border border-white/10 w-full max-w-md mx-auto md:mx-0">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">
                  Welcome Back
                </h2>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2.5 sm:py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 sm:py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                    />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <Link href="/forgot-password" className="text-[#4ade80] hover:text-[#22c55e]">
                      Forgot password?
                    </Link>
                  </div>
                  <button
                    onClick={handleSignIn}
                    disabled={loading}
                    className="w-full bg-[#4ade80] hover:bg-[#22c55e] text-gray-900 font-medium py-2.5 sm:py-3 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50"
                  >
                    {loading ? "Signing In..." : "Sign In"}
                  </button>

                  <div className="relative my-5 sm:my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-[#1a1c2e]/95 text-gray-400">or continue with</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSocialSignIn("google")}
                    className="w-full flex items-center justify-center px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-white"
                  >
                    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </button>

                  <div className="mt-4 text-center text-sm text-gray-400">
                    Don't have an account?{" "}
                    <Link
                      href="/register"
                      className="text-[#4ade80] hover:text-[#22c55e] font-medium"
                    >
                      Register here
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 sm:p-8 border border-white/10 w-full max-w-lg mx-auto md:mx-0">
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
                    Welcome, {user.email}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <Link
                      href="/my-team"
                      className="bg-[#4ade80] hover:bg-[#22c55e] text-gray-900 px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span className="text-sm sm:text-base">My Team</span>
                    </Link>
                    <Link
                      href="/leaderboard"
                      className="bg-[#4ade80] hover:bg-[#22c55e] text-gray-900 px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                      <span className="text-sm sm:text-base">Leaderboard</span>
                    </Link>
                    <Link
                      href="/leagues"
                      className="bg-[#4ade80] hover:bg-[#22c55e] text-gray-900 px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                      <span className="text-sm sm:text-base">Leagues</span>
                    </Link>
                    <Link
                      href="/transfer-market"
                      className="bg-[#4ade80] hover:bg-[#22c55e] text-gray-900 px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm sm:text-base">Transfer Market</span>
                    </Link>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="mt-4 sm:mt-6 bg-white/5 hover:bg-white/10 text-white px-6 py-2 rounded-lg font-medium transition-all w-full"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-8 sm:mb-10">
          Key Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Pick Your Squad */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-[#4ade80]/50 transition-all group">
            <div className="w-12 h-12 bg-[#4ade80]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#4ade80]/20 transition-all">
              <svg
                className="w-6 h-6 text-[#4ade80]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">
              Pick Your Squad
            </h3>
            <p className="text-gray-400 mb-5 sm:mb-6">
              Build your dream team with a budget of ₹100 Cr. Choose from the world's best
              cricketers.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {featuredPlayers.map((player, index) => (
                <div
                  key={index}
                  className="bg-[#4ade80]/10 text-[#4ade80] p-2 rounded-lg text-center"
                >
                  <div className="font-medium text-xs sm:text-sm truncate">
                    {player?.Player?.split(" ")[0] || "Player"}
                  </div>
                  <div className="text-xs opacity-75 truncate">
                    {player?.Team_Name || player?.Country || "Team"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leagues & Cups */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 sm:p-8 border border-white/10 hover:border-[#4ade80]/50 transition-all group">
            <div className="w-12 h-12 bg-[#4ade80]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#4ade80]/20 transition-all">
              <svg
                className="w-6 h-6 text-[#4ade80]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Leagues & Cups</h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="p-3 sm:p-4 bg-[#4ade80]/10 rounded-lg">
                <div className="font-medium text-[#4ade80]">Global Rankings</div>
                <div className="text-xs sm:text-sm text-gray-400">
                  Compete with players worldwide
                </div>
              </div>
              <div className="p-3 sm:p-4 bg-[#4ade80]/10 rounded-lg">
                <div className="font-medium text-[#4ade80]">Private Leagues</div>
                <div className="text-xs sm:text-sm text-gray-400">Challenge your friends</div>
              </div>
            </div>
          </div>

          {/* Create League */}
          <div className="bg-gradient-to-br from-[#4ade80]/20 to-[#4ade80]/10 backdrop-blur-lg rounded-2xl p-6 sm:p-8 border border-[#4ade80]/20 hover:border-[#4ade80]/50 transition-all group sm:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 bg-[#4ade80]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#4ade80]/20 transition-all">
              <svg
                className="w-6 h-6 text-[#4ade80]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">
              Create Your League
            </h3>
            <p className="text-gray-400 mb-5 sm:mb-6">
              Start your own league and invite friends, family, or colleagues to join. Compete for
              glory and bragging rights!
            </p>
            <button className="w-full bg-[#4ade80]/20 hover:bg-[#4ade80]/30 text-[#4ade80] font-medium py-2.5 sm:py-3 rounded-lg transition-all">
              Create League
            </button>
          </div>
        </div>
      </div>

      {/* Display error if any */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-500/90 text-white px-4 py-3 rounded-lg shadow-lg max-w-xs sm:max-w-sm">
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
