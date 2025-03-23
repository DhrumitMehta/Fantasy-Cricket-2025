"use client";
import { useState, useEffect } from "react";
import { createClient, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { use } from "react";
import PageLoadingIndicator from "@/components/PageLoadingIndicator";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

type LeagueMember = {
  id: string;
  user_id: string;
  league_id: string;
  is_admin: boolean;
  joined_at: string;
  profiles: {
    username: string;
    full_name: string | null;
    country: string | null;
  };
  fantasy_points?: number;
  matches_played?: number;
  avg_points?: number;
};

type UserPoints = {
  user_id: string;
  total_points: number;
};

export default function LeagueDetails({ params }: { params: { id: string } }) {
  // Use the params directly as recommended by Next.js
  const unwrappedParams = use(params);
  const leagueId = unwrappedParams.id;

  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          setUser(session.user);
          fetchLeagueDetails();
        } else {
          router.push("/"); // Redirect to home if not logged in
        }
      } catch (err) {
        console.error("Error checking user session:", err);
        setError("Failed to authenticate. Please sign in again.");
        router.push("/");
      }
    };
    checkUser();
  }, [leagueId, router]);

  const fetchLeagueDetails = async () => {
    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("No user logged in");

      // Fetch league details
      const { data: leagueData, error: leagueError } = await supabase
        .from("leagues")
        .select("*")
        .eq("id", leagueId)
        .single();

      if (leagueError) {
        console.error("League error:", leagueError);
        throw leagueError;
      }
      setLeague(leagueData);

      // Fetch league members
      const { data: membersData, error: membersError } = await supabase
        .from("user_leagues")
        .select("user_id")
        .eq("league_id", leagueId);

      if (membersError) {
        console.error("Members error:", membersError);
        throw membersError;
      }

      // Calculate total points for each member
      for (const member of membersData) {
        const { data: matchdayPoints, error: matchdayError } = await supabase
          .from("matchday_teams")
          .select("points")
          .eq("user_id", member.user_id);

        if (matchdayError) {
          console.error("Matchday points error:", matchdayError);
          throw matchdayError;
        }

        const totalPoints = matchdayPoints.reduce((sum, matchday) => sum + matchday.points, 0);
        const matchesPlayed = matchdayPoints.length; // Count matches played

        // Check if an entry exists in league_standings
        const { data: standingsData, error: standingsError } = await supabase
          .from("league_standings")
          .select("id")
          .eq("user_id", member.user_id)
          .eq("league_id", leagueId)
          .single();

        if (standingsError && standingsError.code !== "PGRST116") {
          // PGRST116 is the code for no rows found
          console.error("Standings error:", standingsError);
          throw standingsError;
        }

        // Insert a new entry if it doesn't exist
        if (!standingsData) {
          console.log("Inserting into league_standings:", {
            user_id: member.user_id,
            league_id: leagueId,
            total_points: 0,
            matches_played: 0,
          });
          const { error: insertError } = await supabase.from("league_standings").insert({
            user_id: member.user_id,
            league_id: leagueId,
            total_points: 0, // Initialize with 0
            matches_played: 0, // Initialize with 0
          });

          if (insertError) {
            console.error("Insert standings error:", insertError.message || insertError);
            throw insertError;
          }
        }

        // Update the total_points in league_standings
        const { error: updateError } = await supabase
          .from("league_standings")
          .update({
            total_points: totalPoints,
            matches_played: matchesPlayed,
          })
          .eq("user_id", member.user_id)
          .eq("league_id", leagueId);

        if (updateError) {
          console.error("Update total points error:", updateError);
          throw updateError;
        }
      }

      // Fetch league members with their standings using LEFT JOIN
      const { data: membersDataWithStandings, error: membersStandingsError } = await supabase
        .from("user_leagues")
        .select(
          `
          id,
          user_id,
          league_id,
          is_admin,
          joined_at,
          profiles!user_id (
            username,
            full_name,
            country
          ),
          league_standings (
            total_points,
            matches_played
          )
        `
        )
        .eq("league_id", leagueId);

      if (membersStandingsError) {
        console.error(
          "Members standings error:",
          membersStandingsError.message || membersStandingsError
        );
        throw membersStandingsError;
      }

      console.log(
        "Member profiles:",
        membersDataWithStandings.map((member) => member.profiles)
      );

      // Transform the data to include calculated fields, handling null standings
      const membersWithStats = membersDataWithStandings.map((member) => {
        const standings = member.league_standings?.[0] || { total_points: 0, matches_played: 0 };
        // The issue appears to be that profiles might be an array in the response
        // Get the first profile if it's an array or use the object directly
        const profileData = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;

        return {
          ...member,
          fantasy_points: standings.total_points,
          matches_played: standings.matches_played,
          avg_points:
            standings.matches_played > 0
              ? Math.round(standings.total_points / standings.matches_played)
              : 0,
          profiles: {
            username: profileData?.username || "",
            full_name: profileData?.full_name || null,
            country: profileData?.country || null,
          },
        };
      });

      // The error occurs because the type of membersWithStats doesn't match the LeagueMember[] type
      // We need to transform the data to match the expected type structure
      setMembers(
        membersWithStats.map((member) => ({
          id: member.id,
          user_id: member.user_id,
          league_id: member.league_id,
          is_admin: member.is_admin,
          joined_at: member.joined_at,
          fantasy_points: member.fantasy_points,
          matches_played: member.matches_played,
          avg_points: member.avg_points,
          profiles: {
            username: member.profiles.username,
            full_name: member.profiles.full_name,
            country: member.profiles.country,
          },
        }))
      );
      setIsAdmin(!!membersWithStats.find((m) => m.user_id === user.id)?.is_admin);
      setIsMember(!!membersWithStats.find((m) => m.user_id === user.id));
    } catch (err) {
      console.error("Full error object:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLeague = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.from("user_leagues").insert({
        user_id: user.id,
        league_id: leagueId,
        is_admin: false,
      });

      if (error) throw error;

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

      // Refresh the data
      fetchLeagueDetails();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error joining league:", err);
      setError(`Failed to join the league: ${errorMessage}`);
    }
  };

  const initiateLeaveLeague = () => {
    if (!user || isAdmin) return; // Admins can't leave directly
    setShowLeaveConfirmation(true);
  };

  const confirmLeaveLeague = async () => {
    if (!user || isAdmin) return;

    try {
      const { error } = await supabase
        .from("user_leagues")
        .delete()
        .eq("user_id", user.id)
        .eq("league_id", leagueId);

      if (error) throw error;

      router.push("/"); // Redirect to home after leaving
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error leaving league:", err);
      setError(`Failed to leave the league: ${errorMessage}`);
    } finally {
      setShowLeaveConfirmation(false);
    }
  };

  const handleDeleteLeague = async () => {
    if (!isAdmin) return;

    if (!confirm("Are you sure you want to delete this league? This action cannot be undone.")) {
      return;
    }

    try {
      // First delete all user_leagues entries
      const { error: membershipError } = await supabase
        .from("user_leagues")
        .delete()
        .eq("league_id", leagueId);

      if (membershipError) throw membershipError;

      // Then delete the league itself
      const { error: leagueError } = await supabase.from("leagues").delete().eq("id", leagueId);

      if (leagueError) throw leagueError;

      router.push("/"); // Redirect to home after deletion
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      console.error("Error deleting league:", err);
      setError(`Failed to delete the league: ${errorMessage}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1c2e] py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <div className="h-10 w-48 bg-white/5 rounded-lg animate-pulse"></div>
            <div className="flex gap-2">
              <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse"></div>
            </div>
          </div>

          {/* League info skeleton */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 mb-8">
            <div className="flex justify-between items-start">
              <div className="w-full">
                <div className="h-4 bg-white/5 rounded w-3/4 mb-4 animate-pulse"></div>
                <div className="h-4 bg-white/5 rounded w-full mb-2 animate-pulse"></div>
                <div className="h-4 bg-white/5 rounded w-2/3 mb-6 animate-pulse"></div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="h-16 bg-white/5 rounded-lg animate-pulse"></div>
                  <div className="h-16 bg-white/5 rounded-lg animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Leaderboard skeleton */}
          <div className="mb-8">
            <div className="h-8 w-40 bg-white/5 rounded mb-4 animate-pulse"></div>
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-4">
              <div className="space-y-4">
                <div className="h-8 bg-white/5 rounded w-full animate-pulse"></div>
                <div className="h-8 bg-white/5 rounded w-full animate-pulse"></div>
                <div className="h-8 bg-white/5 rounded w-full animate-pulse"></div>
                <div className="h-8 bg-white/5 rounded w-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <p className="text-xl text-red-500">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Return to Home
        </button>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen">
        <p className="text-xl">League not found</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1c2e] py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">{league.name}</h1>
          <div className="flex gap-2">
            <Link
              href="/leagues"
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-all"
            >
              Back to Leagues
            </Link>
            {isAdmin && (
              <Link
                href={`/leagues/${leagueId}/manage`}
                className="bg-[#4ade80] hover:bg-[#22c55e] text-gray-900 px-4 py-2 rounded-lg font-medium transition-all"
              >
                Manage League
              </Link>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-300 mb-4">{league.description}</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-sm text-gray-400">Members</p>
                  <p className="text-lg text-white font-medium">
                    {members.length}/{league.max_members}
                  </p>
                </div>
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-sm text-gray-400">Privacy</p>
                  <p className="text-lg text-white font-medium">
                    {league.is_private ? "Private" : "Public"}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <div className="mt-4">
                  <button
                    onClick={() => setShowJoinCode(!showJoinCode)}
                    className="bg-[#4ade80]/20 hover:bg-[#4ade80]/30 text-[#4ade80] px-4 py-2 rounded-lg transition-all font-medium"
                  >
                    {showJoinCode ? "Hide Join Code" : "Show Join Code"}
                  </button>
                  {showJoinCode && (
                    <div className="mt-2 p-3 bg-white/5 border border-white/10 rounded-lg">
                      <p className="font-mono text-[#4ade80]">{league.join_code}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              {!isMember && (
                <button
                  onClick={handleJoinLeague}
                  className="bg-[#4ade80] hover:bg-[#22c55e] text-gray-900 px-4 py-2 rounded-lg font-medium transition-all"
                >
                  Join League
                </button>
              )}
              {isMember && !isAdmin && (
                <button
                  onClick={initiateLeaveLeague}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg font-medium transition-all"
                >
                  Leave League
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleDeleteLeague}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg font-medium transition-all"
                >
                  Delete League
                </button>
              )}
            </div>
          </div>
        </div>

        {isMember && (
          <>
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">Leaderboard</h2>
              <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="py-3 px-4 text-left text-gray-300 font-medium">Rank</th>
                      <th className="py-3 px-4 text-left text-gray-300 font-medium">User</th>
                      <th className="py-3 px-4 text-right text-gray-300 font-medium">
                        Total Points
                      </th>
                      <th className="py-3 px-4 text-right text-gray-300 font-medium">
                        Avg Points/Match
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {members
                      .sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0))
                      .map((member, index) => {
                        const matchesPlayed = member.matches_played || 0;
                        const avgPoints =
                          matchesPlayed > 0
                            ? Math.round((member.fantasy_points || 0) / matchesPlayed)
                            : 0;

                        return (
                          <tr
                            key={member.id}
                            className={`border-t border-white/5 ${
                              member.user_id === user?.id ? "bg-[#4ade80]/5" : ""
                            }`}
                          >
                            <td className="py-3 px-4 text-left text-white">{index + 1}</td>
                            <td className="py-3 px-4 text-left text-white">
                              <div className="flex items-center">
                                <span>{member.profiles?.username || "User"}</span>
                                {member.is_admin && (
                                  <span className="ml-2 px-2 py-1 text-xs bg-[#4ade80]/20 text-[#4ade80] rounded-full">
                                    Admin
                                  </span>
                                )}
                                {member.user_id === user?.id && (
                                  <span className="ml-2 px-2 py-1 text-xs bg-white/10 text-white rounded-full">
                                    You
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-[#4ade80]">
                              {member.fantasy_points || 0}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-300">{avgPoints}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-white mb-4">My Team</h2>
              <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                {/* Team management section */}
                <Link
                  href={`/leagues/${leagueId}/team`}
                  className="bg-[#4ade80]/20 hover:bg-[#4ade80]/30 text-[#4ade80] px-4 py-2 rounded-lg font-medium transition-all inline-block"
                >
                  Manage My Team
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {showLeaveConfirmation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1a1c2e] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">Leave League</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to leave this league? You will lose your position in the
              leaderboard.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLeaveConfirmation(false)}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmLeaveLeague}
                className="bg-red-500/80 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-medium transition-all"
              >
                Leave League
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
