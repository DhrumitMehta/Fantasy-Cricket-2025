"use client";

import { useState, FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { nanoid } from "nanoid";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function JoinLeague() {
  const router = useRouter();
  const [leagueCode, setLeagueCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  // Add animation styles
  const animationStyles = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    .animate-slideIn {
      animation: slideIn 0.3s ease-out forwards;
    }
  `;

  const showNotification = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);

    // Auto-hide the popup after 5 seconds
    setTimeout(() => {
      setShowPopup(false);
    }, 5000);
  };

  // Helper function to close the popup
  const closePopup = () => {
    setShowPopup(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get user session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setError("Please login to join a league");
        showNotification("Please login to join a league", "error");
        return;
      }

      // First, get the league ID using the league code
      const { data: league, error: leagueError } = await supabase
        .from("leagues")
        .select("id")
        .eq("join_code", leagueCode)
        .single();

      if (leagueError || !league) {
        setError("Invalid league code");
        showNotification("Invalid league code", "error");
        return;
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from("user_leagues")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("league_id", league.id)
        .maybeSingle();

      if (existingMember) {
        setError("You're already a member of this league");
        showNotification("You're already a member of this league", "error");
        return;
      }

      const unique_user_id = nanoid();

      // Add the user to the league
      const { error: joinError } = await supabase.from("user_leagues").insert({
        id: unique_user_id,
        user_id: session.user.id,
        league_id: league.id,
        is_admin: false,
      });

      if (joinError) throw joinError;

      // Initialize or update league standings for this user
      const { error: standingsError } = await supabase.from("league_standings").upsert(
        {
          user_id: session.user.id,
          league_id: league.id,
          total_points: 0,
          matches_played: 0,
        },
        { onConflict: "league_id,user_id" }
      );

      if (standingsError) {
        console.error("Error updating standings:", standingsError);
      }

      // Show success notification instead of alert
      showNotification("Successfully joined the league!", "success");

      // Navigate after a short delay to allow the notification to be seen
      setTimeout(() => {
        router.push(`/leagues/${league.id}`);
      }, 2000);
    } catch (error: any) {
      console.error("Error joining league:", error);
      setError(error.message || "Failed to join the league");
      showNotification(error.message || "Failed to join the league", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1c2e] py-12">
      <style jsx global>
        {animationStyles}
      </style>

      {/* Popup notification */}
      {showPopup && (
        <div className="fixed top-5 right-5 z-50 max-w-md animate-slideIn">
          <div
            className={`rounded-lg shadow-lg p-4 flex items-start space-x-4 ${
              popupType === "success"
                ? "bg-[#4ade80]/20 border border-[#4ade80]/40 text-[#4ade80]"
                : "bg-red-500/20 border border-red-500/40 text-red-400"
            }`}
          >
            <div className="flex-shrink-0">
              {popupType === "success" ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{popupMessage}</p>
            </div>
            <button
              onClick={closePopup}
              className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Join a League</h1>
          <Link
            href="/leagues"
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-all"
          >
            Back to Leagues
          </Link>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
            <div>
              <label htmlFor="leagueCode" className="block text-sm font-medium text-gray-300 mb-2">
                League Code
              </label>
              <input
                id="leagueCode"
                type="text"
                required
                value={leagueCode}
                onChange={(e) => setLeagueCode(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                placeholder="Enter league code"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-[#4ade80]/20 hover:bg-[#4ade80]/30 text-[#4ade80] text-sm md:text-base text-center py-3 rounded-lg font-medium transition-all w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#4ade80] border-r-transparent mr-2"></div>
                  Joining...
                </div>
              ) : (
                "Join League"
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm md:text-base text-gray-400">
              Don't have a league code?{" "}
              <Link
                href="/leagues/create"
                className="text-[#4ade80] hover:text-[#22c55e] font-medium"
              >
                Create a new league
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
