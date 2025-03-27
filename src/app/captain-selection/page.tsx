"use client";

import { useState, useEffect } from "react";
import { Player } from "@/types/player";
import { useRouter } from "next/navigation";
import { createClient, User } from "@supabase/supabase-js";

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function CaptainSelection() {
  const router = useRouter();
  const [team, setTeam] = useState<Player[]>([]);
  const [captain, setCaptain] = useState<string | null>(null);
  const [viceCaptain, setViceCaptain] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper function to transform player keys
  const transformPlayerKeys = (player: any): Player => {
    return {
      Player: player.Player || "Unknown Player",
      Player_ID:
        player["Player ID"] ||
        player.Player_ID ||
        player.player_id ||
        `temp-${Date.now()}-${Math.random()}`,
      Country: player.Country || "",
      Player_Role: player["Player Role"] || player.Player_Role || "",
      Role_Detail: player["Role Detail"] || player.Role_Detail || "",
      Birth_Date: player["Birth Date"] || player.Birth_Date || "",
      Birth_Place: player["Birth Place"] || player.Birth_Place || "",
      Height: player.Height || "",
      Batting_Style: player["Batting Style"] || player.Batting_Style || "",
      Bowling_Style: player["Bowling Style"] || player.Bowling_Style || "",
      Team_Name: player["Team Name"] || player.Team_Name || "",
      Team_ID: player["Team ID"] || player.Team_ID || "",
      Price: player.Price || 5.0, // Default price of 5M
    };
  };

  // Check for authenticated user
  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        // Redirect to login if no user is authenticated
        router.push("/");
      }
    };

    checkUser();
  }, [router]);

  // Load team from Supabase once we have the user
  useEffect(() => {
    const fetchUserTeam = async () => {
      if (!user) return;

      setIsLoading(true);

      try {
        // First try to get team from Supabase
        const { data, error } = await supabase
          .from("user_teams")
          .select("team_data")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching user team:", error);
          throw error;
        }

        if (data && data.team_data) {
          // We found a team in Supabase
          const processedTeam = data.team_data.map(transformPlayerKeys).filter((player: Player) => {
            if (!player.Player_ID) {
              console.warn("Team player missing ID:", player);
              return false;
            }
            return true;
          });

          setTeam(processedTeam);

          // Check for captain info in Supabase (this would need a separate table or column)
          // For now, check localStorage as fallback
          const savedCaptain = localStorage.getItem("teamCaptain");
          const savedViceCaptain = localStorage.getItem("teamViceCaptain");

          if (savedCaptain) setCaptain(savedCaptain);
          if (savedViceCaptain) setViceCaptain(savedViceCaptain);
        } else {
          // Fallback to localStorage if no team in Supabase
          const savedTeam = localStorage.getItem("myTeam");
          if (savedTeam) {
            try {
              const parsedTeam = JSON.parse(savedTeam)
                .map(transformPlayerKeys)
                .filter((player: Player) => {
                  if (!player.Player_ID) {
                    console.warn("Saved team player missing ID:", player);
                    return false;
                  }
                  return true;
                });
              setTeam(parsedTeam);

              // Check if captain/vice-captain was previously selected
              const savedCaptain = localStorage.getItem("teamCaptain");
              const savedViceCaptain = localStorage.getItem("teamViceCaptain");

              if (savedCaptain) setCaptain(savedCaptain);
              if (savedViceCaptain) setViceCaptain(savedViceCaptain);
            } catch (error) {
              console.error("Error parsing saved team:", error);
              router.push("/transfer-market");
            }
          } else {
            // If no team is found anywhere, redirect to transfer market
            router.push("/transfer-market");
          }
        }
      } catch (error) {
        console.error("Error loading team:", error);
        router.push("/transfer-market");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserTeam();
  }, [user, router]);

  const selectCaptain = (playerId: string) => {
    // Can't be the same as vice-captain
    if (playerId === viceCaptain) {
      setViceCaptain(null);
    }
    setCaptain(playerId);
  };

  const selectViceCaptain = (playerId: string) => {
    // Can't be the same as captain
    if (playerId === captain) {
      return; // Don't allow selecting the same player as both C and VC
    }
    setViceCaptain(playerId);
  };

  const saveCaptainsToSupabase = async () => {
    if (!user || !captain || !viceCaptain) return false;

    try {
      // Save captain info to Supabase (ideally in a separate column or table)
      // This is a simplified version - you might want a more complex structure
      const { error } = await supabase
        .from("user_teams")
        .update({
          captain_id: captain,
          vice_captain_id: viceCaptain,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Error saving captains to Supabase:", error);
      return false;
    }
  };

  const confirmSelection = async () => {
    if (!captain || !viceCaptain) {
      alert("Please select both a Captain and Vice-Captain!");
      return;
    }

    setIsLoading(true);

    try {
      // Save selections to localStorage (for backward compatibility)
      localStorage.setItem("teamCaptain", captain);
      localStorage.setItem("teamViceCaptain", viceCaptain);

      // Also save to Supabase if user is logged in
      if (user) {
        await saveCaptainsToSupabase();
      }

      // Navigate to home page
      router.push("/");
    } catch (error) {
      console.error("Error saving captain selections:", error);
      alert("Failed to save your selections. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Group players by role
  const groupPlayersByRole = (players: Player[]) => {
    const roleOrder = ["WK-Batter", "Batter", "Batting Allrounder", "Bowling Allrounder", "Bowler"];

    const groups = players.reduce((groups: { [key: string]: Player[] }, player) => {
      const role = player.Player_Role || "Unknown";
      if (!groups[role]) {
        groups[role] = [];
      }
      groups[role].push(player);
      return groups;
    }, {});

    // Return entries sorted according to roleOrder
    return Object.entries(groups).sort(([roleA], [roleB]) => {
      const indexA = roleOrder.indexOf(roleA);
      const indexB = roleOrder.indexOf(roleB);
      // If role is not in roleOrder, put it at the end
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 to-green-600 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-center mb-2">Select Captain & Vice-Captain</h1>
          <p className="text-center text-gray-600 mb-6">Choose the leaders for your team</p>

          {/* Selection indicators */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="font-bold text-lg mb-2">Captain (2x points)</h3>
              <div className="h-12 flex items-center">
                {captain ? (
                  <div className="font-medium text-green-700">
                    {team.find((p) => p.Player_ID === captain)?.Player}
                  </div>
                ) : (
                  <div className="text-gray-400 italic">Not selected</div>
                )}
              </div>
            </div>
            <div className="bg-gray-100 p-4 rounded-lg">
              <h3 className="font-bold text-lg mb-2">Vice-Captain (1.5x points)</h3>
              <div className="h-12 flex items-center">
                {viceCaptain ? (
                  <div className="font-medium text-green-700">
                    {team.find((p) => p.Player_ID === viceCaptain)?.Player}
                  </div>
                ) : (
                  <div className="text-gray-400 italic">Not selected</div>
                )}
              </div>
            </div>
          </div>

          {/* Player list */}
          <div className="space-y-6">
            {groupPlayersByRole(team).map(([role, players]) => (
              <div key={role}>
                <h2 className="font-semibold text-lg border-b border-gray-200 pb-2 mb-3">{role}</h2>
                <div className="space-y-3">
                  {players.map((player) => (
                    <div
                      key={player.Player_ID}
                      className="flex items-center justify-between p-3 border border-gray-100 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                          {player.Player.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium">
                            {player.Player}
                            {player.Country !== "India" && <span className="ml-2">✈️</span>}
                          </div>
                          <div className="text-sm text-gray-500">{player.Role_Detail}</div>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => selectCaptain(player.Player_ID)}
                          className={`w-10 h-10 rounded-full font-bold ${
                            captain === player.Player_ID
                              ? "bg-blue-500 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-blue-100"
                          }`}
                        >
                          C
                        </button>
                        <button
                          onClick={() => selectViceCaptain(player.Player_ID)}
                          className={`w-10 h-10 rounded-full font-bold ${
                            viceCaptain === player.Player_ID
                              ? "bg-blue-500 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-blue-100"
                          } ${captain === player.Player_ID ? "opacity-50 cursor-not-allowed" : ""}`}
                          disabled={captain === player.Player_ID}
                        >
                          VC
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex justify-between">
            <button
              onClick={() => router.push("/transfer-market")}
              className="px-5 py-3 bg-gray-200 hover:bg-gray-300 font-medium rounded-lg"
            >
              Back to Squad
            </button>
            <button
              onClick={confirmSelection}
              className={`px-5 py-3 rounded-lg font-medium ${
                captain && viceCaptain
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!captain || !viceCaptain}
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
