"use client";

import { useState, useEffect } from "react";
import { Player } from "@/types/player";
import { supabase } from "@/utils/supabaseClient";
import { ChevronLeft, ChevronRight, Trophy, Home, Layout } from "lucide-react";
import Link from "next/link";

type Match = {
  id: string;
  match_date: string;
  teams: string[];
  venue: string;
};

type PlayerMatchPoints = {
  match_id: string;
  player_name: string;
  batting_points: number;
  bowling_points: number;
  fielding_points: number;
  potm_points: number;
  total_points: number;
};

type PlayerPointsBreakdown = {
  matches: Record<string, PlayerMatchPoints>;
  totalPoints: number;
};

type MatchdayTeam = {
  id: string;
  user_id: string;
  match_id: string;
  players: Record<string, Player>;
  points: number;
  captain_id?: string;
  vice_captain_id?: string;
};

const transformPlayerKeys = (player: any): Player => ({
  Player: player.Player || player.player,
  Player_ID: player["Player ID"] || player.Player_ID || player.player_id,
  Country: player.Country || player.country,
  Player_Role: player["Player Role"] || player.Player_Role || player.player_role,
  Role_Detail: player["Role Detail"] || player.Role_Detail || player.role_detail,
  Birth_Date: player["Birth Date"] || player.Birth_Date || player.birth_date,
  Birth_Place: player["Birth Place"] || player.Birth_Place || player.birth_place,
  Height: player.Height || player.height,
  Batting_Style: player["Batting Style"] || player.Batting_Style || player.batting_style,
  Bowling_Style: player["Bowling Style"] || player.Bowling_Style || player.bowling_style,
  Team_Name: player["Team Name"] || player.Team_Name || player.team_name,
  Team_ID: player["Team ID"] || player.Team_ID || player.team_id,
  Price: player.Price || player.price,
});

const PitchView = ({
  players = [],
  currentMatch,
  playerPointsByMatch = {},
  captainId,
  viceCaptainId,
  onSetCaptain,
  onSetViceCaptain
}: {
  players: Player[];
  currentMatch: Match;
  playerPointsByMatch: Record<string, PlayerPointsBreakdown>;
  captainId?: string | null;
  viceCaptainId?: string | null;
  onSetCaptain?: (playerId: string) => void;
  onSetViceCaptain?: (playerId: string) => void;
}) => {
  if (!players || !currentMatch) {
    return (
      <div className="relative w-full h-[40rem] bg-gradient-to-b from-green-800/40 to-green-900/40 rounded-xl overflow-hidden flex items-center justify-center">
        <div className="text-white text-lg">No player data available</div>
      </div>
    );
  }

  const playersByRole = players.reduce((acc, player) => {
    if (!player || !player.Role_Detail) {
      console.warn("Player missing Role_Detail:", player);
      return acc;
    }

    const role = player.Role_Detail.trim();

    if (role.includes("Batsman") && !role.includes("WK")) {
      acc.batsman = [...(acc.batsman || []), player];
    } else if (role.includes("WK")) {
      acc["wicket-keeper"] = [...(acc["wicket-keeper"] || []), player];
    } else if (role.includes("Batting") && role.includes("Allrounder")) {
      acc["batting-all-rounder"] = [...(acc["batting-all-rounder"] || []), player];
    } else if (role.includes("Bowling") && role.includes("Allrounder")) {
      acc["bowling-all-rounder"] = [...(acc["bowling-all-rounder"] || []), player];
    } else if (role.includes("Bowler")) {
      acc.bowler = [...(acc.bowler || []), player];
    }
    return acc;
  }, {} as Record<string, Player[]>);

  const PlayerCard = ({ player, isCaptain, isViceCaptain, onSetCaptain, onSetViceCaptain, disableSelection }: { player: Player, isCaptain?: boolean, isViceCaptain?: boolean, onSetCaptain?: (playerId: string) => void, onSetViceCaptain?: (playerId: string) => void, disableSelection?: boolean }) => {
    const matchPoints = playerPointsByMatch[player.Player]?.matches[currentMatch.id];
    const adjustedPoints = matchPoints ? 
      (isCaptain ? matchPoints.total_points * 2 : 
       isViceCaptain ? matchPoints.total_points * 1.5 : 
       matchPoints.total_points) : 0;

    return (
      <div className="w-28 bg-white/10 backdrop-blur-lg rounded-lg p-2 shadow-lg border border-white/20 hover:border-[#4ade80]/50 hover:scale-105 transition-transform">
        <p className="text-sm font-semibold text-center truncate text-white">
          {player.Player}
          {isCaptain && <span className="ml-1 text-yellow-400">(C)</span>}
          {isViceCaptain && <span className="ml-1 text-yellow-400">(VC)</span>}
        </p>
        <p className="text-xs text-gray-400 text-center">{player.Role_Detail}</p>
        
        {!disableSelection && (
          <div className="flex justify-center gap-1 mt-1">
            <button 
              onClick={() => onSetCaptain?.(player.Player_ID)}
              className={`text-xs px-1 rounded ${isCaptain ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white'}`}
            >
              C
            </button>
            <button 
              onClick={() => onSetViceCaptain?.(player.Player_ID)}
              className={`text-xs px-1 rounded ${isViceCaptain ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white'}`}
            >
              VC
            </button>
          </div>
        )}
        
        {matchPoints ? (
          <p className="text-center font-bold mt-1 text-[#4ade80]">
            {adjustedPoints.toFixed(1)} pts
          </p>
        ) : (
          <p className="text-center text-xs text-gray-500 mt-1">DNP</p>
        )}
      </div>
    );
  };

  const wicketKeepers = playersByRole["wicket-keeper"] || [];
  const hasMultipleWicketKeepers = wicketKeepers.length > 1;

  return (
    <div className="relative w-full h-[40rem] bg-gradient-to-b from-green-800/40 to-green-900/40 rounded-xl overflow-hidden">
      {/* Pitch markings */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[85%] h-[90%] rounded-full border-2 border-white/20" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full border-2 border-white/20" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-[80%] bg-white/5 border-2 border-white/20" />
      </div>

      {/* Player Positions */}
      <div className="absolute inset-0">
        {/* Batsmen */}
        <div className="absolute top-[15%] left-0 w-full flex justify-center gap-12 flex-wrap px-8">
          {(playersByRole.batsman || []).map((player, idx) => (
            <div key={player.Player_ID} className="mb-4">
              <PlayerCard
                player={player}
                isCaptain={player.Player_ID === captainId}
                isViceCaptain={player.Player_ID === viceCaptainId}
                onSetCaptain={onSetCaptain}
                onSetViceCaptain={onSetViceCaptain}
              />
            </div>
          ))}
        </div>

        {/* Wicket-keeper(s) */}
        {hasMultipleWicketKeepers ? (
          <div className="absolute top-[50%] left-0 w-full flex justify-center gap-32">
            {wicketKeepers.slice(0, 2).map((player) => (
              <div key={player.Player_ID}>
                <PlayerCard
                  player={player}
                  isCaptain={player.Player_ID === captainId}
                  isViceCaptain={player.Player_ID === viceCaptainId}
                  onSetCaptain={onSetCaptain}
                  onSetViceCaptain={onSetViceCaptain}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute top-[50%] left-1/2 transform -translate-x-1/2">
            {wicketKeepers.slice(0, 1).map((player) => (
              <div key={player.Player_ID}>
                <PlayerCard
                  player={player}
                  isCaptain={player.Player_ID === captainId}
                  isViceCaptain={player.Player_ID === viceCaptainId}
                  onSetCaptain={onSetCaptain}
                  onSetViceCaptain={onSetViceCaptain}
                />
              </div>
            ))}
          </div>
        )}

        {/* All-rounders */}
        <div className="absolute top-[65%] left-0 w-full flex justify-center gap-12 flex-wrap px-8">
          {[...(playersByRole["batting-all-rounder"] || []), ...(playersByRole["bowling-all-rounder"] || [])].map((player) => (
            <div key={player.Player_ID}>
              <PlayerCard
                player={player}
                isCaptain={player.Player_ID === captainId}
                isViceCaptain={player.Player_ID === viceCaptainId}
                onSetCaptain={onSetCaptain}
                onSetViceCaptain={onSetViceCaptain}
              />
            </div>
          ))}
        </div>

        {/* Bowlers */}
        <div className="absolute top-[85%] left-0 w-full flex justify-center gap-8 flex-wrap px-8">
          {(playersByRole.bowler || []).map((player) => (
            <div key={player.Player_ID}>
              <PlayerCard
                player={player}
                isCaptain={player.Player_ID === captainId}
                isViceCaptain={player.Player_ID === viceCaptainId}
                onSetCaptain={onSetCaptain}
                onSetViceCaptain={onSetViceCaptain}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Role distribution overlay */}
      <div className="absolute top-2 left-2 bg-black/70 text-white p-3 text-xs rounded-lg border border-white/10">
        <p className="flex justify-between">
          <span>WK:</span>{" "}
          <span className="text-[#4ade80] font-medium ml-2">{wicketKeepers.length}</span>
        </p>
        <p className="flex justify-between">
          <span>BAT:</span>{" "}
          <span className="text-[#4ade80] font-medium ml-2">
            {playersByRole.batsman?.length || 0}
          </span>
        </p>
        <p className="flex justify-between">
          <span>AR:</span>
          <span className="text-[#4ade80] font-medium ml-2">
            {(playersByRole["batting-all-rounder"]?.length || 0) +
              (playersByRole["bowling-all-rounder"]?.length || 0)}
          </span>
        </p>
        <p className="flex justify-between">
          <span>BOWL:</span>{" "}
          <span className="text-[#4ade80] font-medium ml-2">
            {playersByRole.bowler?.length || 0}
          </span>
        </p>
      </div>

      {/* Debug display */}
      <div className="absolute bottom-2 right-2 bg-black/70 text-white p-2 text-xs rounded-lg border border-white/10">
        <p>Total Players: {players.length}</p>
        <p>Displayed: {(playersByRole.batsman?.length || 0) + 
                      (playersByRole["wicket-keeper"]?.length || 0) + 
                      (playersByRole["batting-all-rounder"]?.length || 0) +
                      (playersByRole["bowling-all-rounder"]?.length || 0) +
                      (playersByRole.bowler?.length || 0)}</p>
      </div>
    </div>
  );
};

export default function MyTeam() {
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchdayTeams, setMatchdayTeams] = useState<Record<string, MatchdayTeam>>({});
  const [playerPointsByMatch, setPlayerPointsByMatch] = useState<
    Record<string, PlayerPointsBreakdown>
  >({});
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"pitch" | "list">("pitch");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);

  // Modify the useEffect that loads the team
  useEffect(() => {
    try {
      // Load default team from localStorage for future matches
      const savedTeam = JSON.parse(localStorage.getItem("myTeam") || "[]");
      const transformedTeam = savedTeam.map(transformPlayerKeys);
      setSelectedPlayers(transformedTeam);

      // Load saved matchday teams
      async function fetchMatchdayTeams() {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error('User error:', userError);
          return;
        }

        const { data: matchdayTeamsData, error: matchdayError } = await supabase
          .from('matchday_teams')
          .select('*')
          .eq('user_id', user.id);

        if (matchdayError) {
          console.error('Error fetching matchday teams:', matchdayError);
          return;
        }

        // Transform the data into a record of match_id -> matchday team
        const teamsRecord: Record<string, MatchdayTeam> = {};
        matchdayTeamsData.forEach(team => {
          teamsRecord[team.match_id] = team;
        });

        setMatchdayTeams(teamsRecord);
      }

      fetchMatchdayTeams();
    } catch (error) {
      console.error("Error loading team:", error);
      setSelectedPlayers([]);
    }
  }, []);

  // Fetch matches and points data
  useEffect(() => {
    async function fetchMatchesAndPoints() {
      if (selectedPlayers.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const { data: matchesData, error: matchesError } = await supabase
          .from("matches")
          .select("*")
          .order("match_date", { ascending: true });

        if (matchesError) throw matchesError;
        setMatches(matchesData);

        const playerNames = selectedPlayers.map((player) => player.Player);
        const { data: pointsData, error: pointsError } = await supabase
          .from("player_points")
          .select("*")
          .in("player_name", playerNames);

        if (pointsError) throw pointsError;

        const pointsByPlayer: Record<string, PlayerPointsBreakdown> = {};

        playerNames.forEach((playerName) => {
          const playerPoints = pointsData.filter((p) => p.player_name === playerName);
          const matchPoints: Record<string, PlayerMatchPoints> = {};
          let playerTotal = 0;

          playerPoints.forEach((point) => {
            matchPoints[point.match_id] = point;
            playerTotal += point.total_points;
          });

          pointsByPlayer[playerName] = {
            matches: matchPoints,
            totalPoints: playerTotal,
          };
        });

        setPlayerPointsByMatch(pointsByPlayer);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchMatchesAndPoints();
  }, [selectedPlayers]);

  const currentMatch = matches[currentMatchIndex];

  // Update the getTeamForMatch function
  const getTeamForMatch = (matchId: string): Player[] => {
    // If the match has a saved team, use it
    if (matchdayTeams[matchId]) {
      const team = matchdayTeams[matchId];
      const players = Object.values(team.players).map(p => ({
        Player: p.player_name,
        Player_ID: p.player_id,
        Role_Detail: p.role,
        Team_Name: p.team,
        // Add other required fields with default values
        Country: "",
        Player_Role: "",
        Birth_Date: "",
        Birth_Place: "",
        Height: "",
        Batting_Style: "",
        Bowling_Style: "",
        Team_ID: "",
        Price: 0,
      }));
      
      return players;
    }
    
    const matchDate = matches.find(m => m.id === matchId)?.match_date;
    
    if (matchDate && new Date(matchDate) < new Date('2025-02-17T00:00:00Z')) {
      // For past tournament matches without a saved team, find the last saved team before this match
      const lastSavedTeam = matches
        .filter(m => {
          // Get matches before the current match
          return new Date(m.match_date) < new Date(matchDate);
        })
        .sort((a, b) => {
          // Sort by date descending to get the most recent first
          return new Date(b.match_date).getTime() - new Date(a.match_date).getTime();
        })
        .find(m => matchdayTeams[m.id]); // Find the first match that has a saved team

      if (lastSavedTeam) {
        const team = matchdayTeams[lastSavedTeam.id];
        
        return Object.values(team.players).map(p => ({
          Player: p.player_name,
          Player_ID: p.player_id,
          Role_Detail: p.role,
          Team_Name: p.team,
          Country: "",
          Player_Role: "",
          Birth_Date: "",
          Birth_Place: "",
          Height: "",
          Batting_Style: "",
          Bowling_Style: "",
          Team_ID: "",
          Price: 0,
        }));
      }
      
      return [];
    }
    
    return selectedPlayers;
  };

  // Add a new useEffect to handle captain/vice-captain updates
  useEffect(() => {
    if (currentMatch && matchdayTeams[currentMatch.id]) {
      const team = matchdayTeams[currentMatch.id];
      setCaptainId(team.captain_id || null);
      setViceCaptainId(team.vice_captain_id || null);
    }
  }, [currentMatch, matchdayTeams]);

  // Update the getMatchStats function to adjust points for captain and vice-captain
  const getMatchStats = () => {
    if (!currentMatch) return { totalPoints: 0, averagePoints: 0, highestPoints: 0 };

    // Get the team for this specific match
    const teamForMatch = getTeamForMatch(currentMatch.id);
    
    // Calculate points based on the players who were in the team for this match
    const points = teamForMatch.map(player => {
      const basePoints = playerPointsByMatch[player.Player]?.matches[currentMatch.id]?.total_points || 0;
      
      if (player.Player_ID === captainId) {
        return basePoints * 2; // Captain gets 2x points
      } else if (player.Player_ID === viceCaptainId) {
        return basePoints * 1.5; // Vice-captain gets 1.5x points
      }
      
      return basePoints;
    });

    const totalPoints = points.reduce((sum, p) => sum + p, 0);
    const averagePoints = points.length ? Math.round(totalPoints / points.length) : 0;
    const highestPoints = points.length ? Math.max(...points) : 0;

    return { totalPoints, averagePoints, highestPoints };
  };

  const { totalPoints, averagePoints, highestPoints } = getMatchStats();

  // Add this validation function
  const validateTeam = (players: Player[]) => {
    // Count players by role
    const roleCounts = players.reduce((acc, player) => {
      const role = player.Role_Detail.trim();
      if (role.includes("WK")) acc.wicketKeeper++;
      else if (role.includes("Batsman")) acc.batsmen++;
      else if (role.includes("Allrounder")) acc.allRounders++;
      else if (role.includes("Bowler")) acc.bowlers++;
      return acc;
    }, { wicketKeeper: 0, batsmen: 0, allRounders: 0, bowlers: 0 });

    const errors = [];
    
    // Team size
    if (players.length !== 11) {
      errors.push(`Team must have exactly 11 players (currently has ${players.length})`);
    }

    // Wicket-keeper
    if (roleCounts.wicketKeeper === 0) {
      errors.push("Team must have at least 1 wicket-keeper");
    } else if (roleCounts.wicketKeeper > 2) {
      errors.push("Team cannot have more than 2 wicket-keepers");
    }

    // Batsmen
    if (roleCounts.batsmen < 3) {
      errors.push("Team must have at least 3 batsmen");
    }

    // All-rounders
    if (roleCounts.allRounders < 1) {
      errors.push("Team must have at least 1 all-rounder");
    }

    // Bowlers
    if (roleCounts.bowlers < 3) {
      errors.push("Team must have at least 3 bowlers");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Update the hasMatchStarted function
  const hasMatchStarted = (match: Match) => {
    const matchDate = new Date(match.match_date);
    const cutoffDate = new Date('2025-02-17T00:00:00Z');

    // Consider matches before the cutoff date as completed
    if (matchDate < cutoffDate) {
      return true; // Completed Match
    }

    // Allow saving for matches after the cutoff date
    return false; // Match can be saved
  };

  // Update the saveTeamForMatchday function
  const saveTeamForMatchday = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('User error:', userError);
        throw userError;
      }
      if (!user) {
        throw new Error('No user logged in');
      }

      if (!currentMatch) {
        throw new Error('No match selected');
      }

      // Check if match has started
      if (hasMatchStarted(currentMatch)) {
        throw new Error('Cannot modify team after match has started');
      }

      // Validate team composition
      const validation = validateTeam(selectedPlayers);
      if (!validation.isValid) {
        throw new Error(`Team composition invalid:\n${validation.errors.join('\n')}`);
      }
      
      // Validate captain and vice-captain
      if (!captainId) {
        throw new Error('You must select a captain');
      }
      
      if (!viceCaptainId) {
        throw new Error('You must select a vice-captain');
      }
      
      if (captainId === viceCaptainId) {
        throw new Error('Captain and vice-captain must be different players');
      }

      // Calculate points for the current match (with captain and vice-captain multipliers)
      const matchPoints = selectedPlayers.reduce((total, player) => {
        const basePoints = playerPointsByMatch[player.Player]?.matches[currentMatch.id]?.total_points || 0;
        
        if (player.Player_ID === captainId) {
          return total + (basePoints * 2);
        } else if (player.Player_ID === viceCaptainId) {
          return total + (basePoints * 1.5);
        }
        
        return total + basePoints;
      }, 0);

      // Create players dictionary
      const playersDict = selectedPlayers.reduce((acc, player) => {
        acc[player.Player_ID] = {
          player_name: player.Player,
          player_id: player.Player_ID,
          role: player.Role_Detail,
          team: player.Team_Name
        };
        return acc;
      }, {} as Record<string, any>);

      const teamData = {
        user_id: user.id,
        match_id: currentMatch.id,
        players: playersDict,
        points: matchPoints,
        captain_id: captainId,
        vice_captain_id: viceCaptainId
      };

      // First, check if a record exists
      const { data: existingTeam, error: checkError } = await supabase
        .from('matchday_teams')
        .select('*')
        .eq('user_id', user.id)
        .eq('match_id', currentMatch.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing team:', checkError);
        throw checkError;
      }

      // If team exists, ask for confirmation
      if (existingTeam) {
        const confirmed = window.confirm(
          'You already have a team saved for this match. Do you want to overwrite it?'
        );
        if (!confirmed) {
          return;
        }
      }

      setIsSaving(true);

      let result;
      if (existingTeam) {
        result = await supabase
          .from('matchday_teams')
          .update(teamData)
          .eq('user_id', user.id)
          .eq('match_id', currentMatch.id)
          .select();
      } else {
        result = await supabase
          .from('matchday_teams')
          .insert(teamData)
          .select();
      }

      if (result.error) {
        console.error('Database operation error:', result.error);
        throw result.error;
      }

      alert('Team saved successfully!');

    } catch (error: any) {
      console.error('Full error object:', error);
      alert(`Failed to save team: ${error?.message || 'Unknown error occurred'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Add functions to handle captain and vice-captain selection
  const handleSetCaptain = (playerId: string) => {
    // If selecting current vice-captain as captain, swap them
    if (playerId === viceCaptainId) {
      setViceCaptainId(captainId);
    }
    setCaptainId(playerId);
  };

  const handleSetViceCaptain = (playerId: string) => {
    // If selecting current captain as vice-captain, swap them
    if (playerId === captainId) {
      setCaptainId(viceCaptainId);
    }
    setViceCaptainId(playerId);
  };

  return (
    <main className="min-h-screen bg-[#1a1c2e] text-white">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Header with back button */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#4ade80] hover:text-[#22c55e] transition-colors"
          >
            <Home className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-[#4ade80] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-300">Loading team stats...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Match navigation */}
            <div className="flex items-center justify-between mb-8 bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
              <button
                onClick={() => setCurrentMatchIndex((i) => Math.max(0, i - 1))}
                disabled={currentMatchIndex === 0}
                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <div className="text-center">
                <h2 className="text-2xl font-bold mb-1 text-white">
                  Matchday {currentMatchIndex + 1}
                </h2>
                {currentMatch && (
                  <>
                    <p className="text-[#4ade80]">{currentMatch.teams.join(" vs ")}</p>
                    <button
                      onClick={saveTeamForMatchday}
                      disabled={isSaving || hasMatchStarted(currentMatch)}
                      className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                        ${hasMatchStarted(currentMatch)
                          ? 'bg-gray-500 cursor-not-allowed'
                          : isSaving
                          ? 'bg-[#22c55e] cursor-wait'
                          : 'bg-[#4ade80] hover:bg-[#22c55e]'}
                        text-gray-900`}
                    >
                      {isSaving ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                          Saving...
                        </span>
                      ) : hasMatchStarted(currentMatch) ? (
                        new Date(currentMatch.match_date) < new Date('2025-02-17T00:00:00Z')
                          ? 'Past Tournament Match'
                          : 'Match Started'
                      ) : (
                        'Save Team for this Match'
                      )}
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => setCurrentMatchIndex((i) => Math.min(matches.length - 1, i + 1))}
                disabled={currentMatchIndex === matches.length - 1}
                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-transparent transition-all"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10 hover:border-[#4ade80]/50 transition-all">
                <p className="text-sm text-[#4ade80] mb-1">Team Points</p>
                <p className="text-3xl font-bold text-white">{totalPoints}</p>
              </div>

              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10 hover:border-[#4ade80]/50 transition-all">
                <p className="text-sm text-[#4ade80] mb-1">Average Player</p>
                <p className="text-3xl font-bold text-white">{averagePoints}</p>
              </div>

              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10 hover:border-[#4ade80]/50 transition-all">
                <p className="text-sm text-[#4ade80] mb-1">Highest Player</p>
                <p className="text-3xl font-bold text-white">{highestPoints}</p>
              </div>

              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-5 border border-white/10 hover:border-[#4ade80]/50 transition-all">
                <p className="text-sm text-[#4ade80] mb-1">Total Players</p>
                <p className="text-3xl font-bold text-white">{selectedPlayers.length}</p>
              </div>
            </div>

            {/* View mode toggle */}
            <div className="mb-6 flex justify-center">
              <div className="bg-[#2a2c3e] rounded-full p-1 flex items-center">
                <button
                  onClick={() => setViewMode("pitch")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    viewMode === "pitch" ? "bg-[#4ade80] text-gray-900" : "text-white"
                  }`}
                >
                  Pitch View
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                    viewMode === "list" ? "bg-[#4ade80] text-gray-900" : "text-white"
                  }`}
                >
                  <Layout className="w-4 h-4" />
                  List View
                </button>
              </div>
            </div>

            {/* List view */}
            {viewMode === "list" && currentMatch && (
              <div className="space-y-3">
                {getTeamForMatch(currentMatch.id).map((player) => {
                  const matchPoints = playerPointsByMatch[player.Player]?.matches[currentMatch.id];
                  const isCaptain = player.Player_ID === captainId;
                  const isViceCaptain = player.Player_ID === viceCaptainId;
                  const adjustedPoints = matchPoints ? 
                    (isCaptain ? matchPoints.total_points * 2 : 
                     isViceCaptain ? matchPoints.total_points * 1.5 : 
                     matchPoints.total_points) : 0;
                  const isTopScorer = adjustedPoints === Math.max(...getTeamForMatch(currentMatch.id).map(p => {
                    const pts = playerPointsByMatch[p.Player]?.matches[currentMatch.id]?.total_points || 0;
                    if (p.Player_ID === captainId) return pts * 2;
                    if (p.Player_ID === viceCaptainId) return pts * 1.5;
                    return pts;
                  })) && adjustedPoints > 0;

                  return (
                    <div
                      key={player.Player_ID}
                      className={`flex items-center justify-between p-5 rounded-xl backdrop-blur-lg transition-all ${
                        isTopScorer
                          ? "bg-[#4ade80]/10 border border-[#4ade80]/30"
                          : "bg-white/5 border border-white/10 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        {isTopScorer && <Trophy className="w-5 h-5 text-[#4ade80]" />}
                        <div>
                          <p className="font-medium text-white flex items-center gap-1">
                            {player.Player}
                            {isCaptain && <span className="text-yellow-400 font-bold">(C)</span>}
                            {isViceCaptain && <span className="text-yellow-400 font-bold">(VC)</span>}
                          </p>
                          <p className="text-sm text-gray-400">
                            {player.Role_Detail} • {player.Team_Name}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {!hasMatchStarted(currentMatch) && (
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleSetCaptain(player.Player_ID)}
                              className={`px-2 py-1 rounded text-xs ${
                                isCaptain ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white hover:bg-gray-600'
                              }`}
                            >
                              Captain
                            </button>
                            <button 
                              onClick={() => handleSetViceCaptain(player.Player_ID)}
                              className={`px-2 py-1 rounded text-xs ${
                                isViceCaptain ? 'bg-yellow-400 text-black' : 'bg-gray-700 text-white hover:bg-gray-600'
                              }`}
                            >
                              Vice Captain
                            </button>
                          </div>
                        )}

                        {matchPoints ? (
                          <div className="text-right">
                            <p className="font-bold text-lg text-white">
                              {adjustedPoints.toFixed(1)} pts
                              {(isCaptain || isViceCaptain) && (
                                <span className="text-xs text-gray-400 ml-1">
                                  ({matchPoints.total_points}×{isCaptain ? '2' : '1.5'})
                                </span>
                              )}
                            </p>
                            <div className="text-sm text-gray-400 flex gap-3">
                              <span>
                                Bat:{" "}
                                <span className="text-[#4ade80]">{matchPoints.batting_points}</span>
                              </span>
                              <span>
                                Bowl:{" "}
                                <span className="text-[#4ade80]">{matchPoints.bowling_points}</span>
                              </span>
                              <span>
                                Field:{" "}
                                <span className="text-[#4ade80]">{matchPoints.fielding_points}</span>
                              </span>
                              <span>
                                POTM:{" "}
                                <span className="text-[#4ade80]">{matchPoints.potm_points}</span>
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-400 bg-white/5 px-3 py-1 rounded-lg text-sm">
                            Did not play
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pitch view */}
            {viewMode === "pitch" && currentMatch && (
              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
                <PitchView
                  players={getTeamForMatch(currentMatch.id)}
                  currentMatch={currentMatch}
                  playerPointsByMatch={playerPointsByMatch}
                  captainId={captainId}
                  viceCaptainId={viceCaptainId}
                  onSetCaptain={hasMatchStarted(currentMatch) ? undefined : handleSetCaptain}
                  onSetViceCaptain={hasMatchStarted(currentMatch) ? undefined : handleSetViceCaptain}
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
