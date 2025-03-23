"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing");
  // Handle this case appropriately
}

type League = {
  id: string;
  name: string;
  description: string;
  max_members: number;
  is_private: boolean;
  join_code: string;
  created_by: string;
  created_at: string;
};

type LeagueWithMemberCount = League & {
  member_count: number;
  is_admin: boolean;
};

// Add animation styles after supabase client initialization
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

export default function Leagues() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [myLeagues, setMyLeagues] = useState<LeagueWithMemberCount[]>([]);
  const [publicLeagues, setPublicLeagues] = useState<LeagueWithMemberCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Add these new state variables for the popup
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchLeagues(session.user.id);
      } else {
        router.push("/"); // Redirect to home if not logged in
      }
    };

    checkUser();
  }, [router]);

  const fetchLeagues = async (userId: string) => {
    setLoading(true);
    setError(null);

    try {
      // Add console logs to track execution
      console.log("Fetching leagues for user:", userId);

      // Fetch leagues the user is a member of
      const userLeaguesResponse = await supabase
        .from("user_leagues")
        .select(
          `
          league_id,
          is_admin,
          leagues:league_id (
            id,
            name,
            description,
            max_members,
            is_private,
            join_code,
            created_by,
            created_at
          )
        `
        )
        .eq("user_id", userId);

      if (userLeaguesResponse.error) {
        console.error("User leagues error:", userLeaguesResponse.error);
        throw userLeaguesResponse.error;
      }

      const userLeagues = userLeaguesResponse.data || [];
      console.log("User leagues fetched:", userLeagues.length);

      // Fetch public leagues
      const publicLeaguesResponse = await supabase
        .from("leagues")
        .select("*")
        .eq("is_private", false)
        .order("created_at", { ascending: false });

      if (publicLeaguesResponse.error) {
        console.error("Public leagues error:", publicLeaguesResponse.error);
        throw publicLeaguesResponse.error;
      }

      const allPublicLeagues = publicLeaguesResponse.data || [];
      console.log("Public leagues fetched:", allPublicLeagues.length);

      // Filter out leagues the user is already a member of
      const userLeagueIds = userLeagues.map((ul) => ul.league_id);
      const filteredPublicLeagues = allPublicLeagues.filter(
        (league) => !userLeagueIds.includes(league.id)
      );

      // Process member counts for each league with better error handling
      const leaguesWithCounts = await Promise.all(
        userLeagues.map(async (userLeague) => {
          const league = userLeague.leagues as any;
          if (!league) {
            console.error("Missing league data for league_id:", userLeague.league_id);
            return null; // Skip this league if data is missing
          }

          const countResponse = await supabase
            .from("user_leagues")
            .select("*", { count: "exact", head: true })
            .eq("league_id", league.id);

          if (countResponse.error) {
            console.error("Count error for league:", league.id, countResponse.error);
          }

          return {
            ...league,
            member_count: countResponse.count || 0,
            is_admin: userLeague.is_admin,
          };
        })
      );

      const publicLeaguesWithCounts = await Promise.all(
        filteredPublicLeagues.map(async (league) => {
          const countResponse = await supabase
            .from("user_leagues")
            .select("*", { count: "exact", head: true })
            .eq("league_id", league.id);

          if (countResponse.error) {
            console.error("Count error for public league:", league.id, countResponse.error);
          }

          return {
            ...league,
            member_count: countResponse.count || 0,
            is_admin: false,
          };
        })
      );

      // Filter out any null values from the arrays
      const validLeaguesWithCounts = leaguesWithCounts.filter((l) => l !== null);

      setMyLeagues(validLeaguesWithCounts as LeagueWithMemberCount[]);
      setPublicLeagues(publicLeaguesWithCounts);

      console.log("Successfully processed leagues");
    } catch (error: any) {
      console.error("Error in fetchLeagues:", error);
      setError(error.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Add this function to show notifications
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

  // Function to copy league code to clipboard
  const copyLeagueCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showNotification("League code copied to clipboard!", "success");
  };

  // Function to join a public league - update to use the notification system
  const joinPublicLeague = async (leagueId: string) => {
    if (!user) return;
    setLoading(true);

    try {
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from("user_leagues")
        .select("*")
        .eq("user_id", user.id)
        .eq("league_id", leagueId)
        .maybeSingle();

      if (existingMember) {
        showNotification("You're already a member of this league", "error");
        setLoading(false);
        return;
      }

      // Add the user to the league
      const { error: joinError } = await supabase.from("user_leagues").insert({
        id: nanoid(),
        user_id: user.id,
        league_id: leagueId,
        is_admin: false,
      });

      if (joinError) throw joinError;

      // Initialize league standings for this user
      const { error: standingsError } = await supabase.from("league_standings").upsert(
        {
          user_id: user.id,
          league_id: leagueId,
          total_points: 0,
          matches_played: 0,
        },
        { onConflict: "league_id,user_id" }
      );

      if (standingsError) {
        console.error("Error initializing standings:", standingsError);
      }

      showNotification("Successfully joined the league!", "success");
      router.push(`/leagues/${leagueId}`);
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
          <h1 className="text-3xl font-bold text-white">Your Leagues</h1>
          <div className="space-x-4">
            <Link
              href="/leagues/join"
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-all"
            >
              Join League
            </Link>
            <Link
              href="/leagues/create"
              className="bg-[#4ade80] hover:bg-[#22c55e] text-gray-900 px-4 py-2 rounded-lg font-medium transition-all"
            >
              Create League
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#4ade80] border-r-transparent"></div>
            <p className="mt-4 text-gray-400">Loading leagues...</p>
          </div>
        ) : (
          <>
            {/* My Leagues Section */}
            <div className="mb-12">
              <h2 className="text-xl font-semibold text-white mb-4">My Leagues</h2>
              {myLeagues.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10 text-center">
                  <p className="text-gray-400">You haven't joined any leagues yet.</p>
                  <div className="mt-4">
                    <Link
                      href="/leagues/create"
                      className="text-[#4ade80] hover:text-[#22c55e] font-medium"
                    >
                      Create your first league
                    </Link>
                    {" or "}
                    <Link
                      href="/leagues/join"
                      className="text-[#4ade80] hover:text-[#22c55e] font-medium"
                    >
                      join an existing one
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myLeagues.map((league) => (
                    <div
                      key={league.id}
                      className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 hover:border-[#4ade80]/50 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold text-white">{league.name}</h3>
                        {league.is_admin && (
                          <span className="bg-[#4ade80]/20 text-[#4ade80] text-xs px-2 py-1 rounded-full">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {league.description || "No description provided."}
                      </p>
                      <div className="flex justify-between items-center text-sm text-gray-400 mb-6">
                        <div>
                          {league.member_count} / {league.max_members} members
                        </div>
                        <div>{league.is_private ? "Private" : "Public"}</div>
                      </div>
                      <div className="flex flex-col space-y-3">
                        <Link
                          href={`/leagues/${league.id}`}
                          className="bg-[#4ade80]/20 hover:bg-[#4ade80]/30 text-[#4ade80] text-center py-2 rounded-lg font-medium transition-all w-full"
                        >
                          View League
                        </Link>
                        {league.is_private && league.is_admin && (
                          <button
                            onClick={() => copyLeagueCode(league.join_code)}
                            className="bg-white/5 hover:bg-white/10 text-white text-center py-2 rounded-lg transition-all w-full"
                          >
                            Copy Join Code
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Public Leagues Section */}
            {publicLeagues.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Public Leagues</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {publicLeagues.map((league) => (
                    <div
                      key={league.id}
                      className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 hover:border-[#4ade80]/50 transition-all group"
                    >
                      <h3 className="text-lg font-semibold text-white mb-2">{league.name}</h3>
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {league.description || "No description provided."}
                      </p>
                      <div className="flex justify-between items-center text-sm text-gray-400 mb-6">
                        <div>
                          {league.member_count} / {league.max_members} members
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          // Implement join public league functionality
                          // This would be similar to join by code but without requiring the code
                          joinPublicLeague(league.id);
                        }}
                        className="bg-[#4ade80]/20 hover:bg-[#4ade80]/30 text-[#4ade80] text-center py-2 rounded-lg font-medium transition-all w-full"
                      >
                        Join League
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
