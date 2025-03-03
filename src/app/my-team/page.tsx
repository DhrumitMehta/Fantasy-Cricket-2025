"use client";

import { useState, useEffect } from "react";
import { Player } from "@/types/player";
import { supabase } from "@/utils/supabaseClient";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";

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

const transformPlayerKeys = (player: any): Player => ({
  Player: player.Player || player.player,
  Player_ID: player['Player ID'] || player.Player_ID || player.player_id,
  Country: player.Country || player.country,
  Player_Role: player['Player Role'] || player.Player_Role || player.player_role,
  Role_Detail: player['Role Detail'] || player.Role_Detail || player.role_detail,
  Birth_Date: player['Birth Date'] || player.Birth_Date || player.birth_date,
  Birth_Place: player['Birth Place'] || player.Birth_Place || player.birth_place,
  Height: player.Height || player.height,
  Batting_Style: player['Batting Style'] || player.Batting_Style || player.batting_style,
  Bowling_Style: player['Bowling Style'] || player.Bowling_Style || player.bowling_style,
  Team_Name: player['Team Name'] || player.Team_Name || player.team_name,
  Team_ID: player['Team ID'] || player.Team_ID || player.team_id,
  Price: player.Price || player.price,
});

const PitchView = ({ 
  players = [],
  currentMatch, 
  playerPointsByMatch = {}
}: { 
  players: Player[],
  currentMatch: Match,
  playerPointsByMatch: Record<string, PlayerPointsBreakdown>
}) => {
  if (!players || !currentMatch) {
    return (
      <div className="relative w-full h-[40rem] bg-gradient-to-b from-green-600 to-green-700 rounded-2xl overflow-hidden flex items-center justify-center">
        <div className="text-white text-lg">No player data available</div>
      </div>
    );
  }

  const playersByRole = players.reduce((acc, player) => {
    if (!player || !player.Role_Detail) {
      console.warn('Player missing Role_Detail:', player);
      return acc;
    }

    const role = player.Role_Detail.trim();

    if (role.includes('Batsman') && !role.includes('WK')) {
      acc.batsman = [...(acc.batsman || []), player];
    } else if (role.includes('WK')) {
      acc['wicket-keeper'] = [...(acc['wicket-keeper'] || []), player];
    } else if (role.includes('Batting') && role.includes('Allrounder')) {
      acc['batting-all-rounder'] = [...(acc['batting-all-rounder'] || []), player];
    } else if (role.includes('Bowling') && role.includes('Allrounder')) {
      acc['bowling-all-rounder'] = [...(acc['bowling-all-rounder'] || []), player];
    } else if (role.includes('Bowler')) {
      acc.bowler = [...(acc.bowler || []), player];
    }
    return acc;
  }, {} as Record<string, Player[]>);

  const PlayerCard = ({ player }: { player: Player }) => {
    const matchPoints = playerPointsByMatch[player.Player]?.matches[currentMatch.id];
    
    return (
      <div className="w-28 bg-white rounded-lg p-2 shadow-lg border-2 border-blue-500 hover:scale-105 transition-transform">
        <p className="text-sm font-semibold text-center truncate">{player.Player}</p>
        <p className="text-xs text-gray-600 text-center">{player.Role_Detail}</p>
        {matchPoints ? (
          <p className="text-center font-bold mt-1">{matchPoints.total_points} pts</p>
        ) : (
          <p className="text-center text-xs text-gray-500 mt-1">DNP</p>
        )}
      </div>
    );
  };

  const wicketKeepers = playersByRole['wicket-keeper'] || [];
  const hasMultipleWicketKeepers = wicketKeepers.length > 1;

  return (
    <div className="relative w-full h-[40rem] bg-gradient-to-b from-green-600 to-green-700 rounded-2xl overflow-hidden">
      {/* Pitch markings */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[85%] h-[90%] rounded-full border-2 border-white/30" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full border-2 border-white/30" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-[80%] bg-green-800/20 border-2 border-white/30" />
      </div>

      {/* Player Positions */}
      <div className="absolute inset-0">
        {/* Batsmen */}
        <div className="absolute top-[15%] left-0 w-full flex justify-center gap-24">
          {(playersByRole.batsman || []).slice(0, 3).map((player, idx) => (
            <div key={player.Player_ID}>
              <PlayerCard player={player} />
            </div>
          ))}
        </div>

        {/* Middle-order batsmen */}
        <div className="absolute top-[35%] left-0 w-full flex justify-center gap-32">
          {(playersByRole.batsman || []).slice(3, 5).map((player) => (
            <div key={player.Player_ID}>
              <PlayerCard player={player} />
            </div>
          ))}
        </div>

        {/* Wicket-keeper(s) */}
        {hasMultipleWicketKeepers ? (
          <div className="absolute top-[50%] left-0 w-full flex justify-center gap-32">
            {wicketKeepers.slice(0, 2).map((player) => (
              <div key={player.Player_ID}>
                <PlayerCard player={player} />
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute top-[50%] left-1/2 transform -translate-x-1/2">
            {wicketKeepers.slice(0, 1).map((player) => (
              <div key={player.Player_ID}>
                <PlayerCard player={player} />
              </div>
            ))}
          </div>
        )}

        {/* All-rounders */}
        <div className="absolute top-[65%] left-0 w-full flex justify-center gap-32">
          {(playersByRole['batting-all-rounder'] || []).slice(0, 1).map((player) => (
            <div key={player.Player_ID}>
              <PlayerCard player={player} />
            </div>
          ))}
          {(playersByRole['bowling-all-rounder'] || []).slice(0, 1).map((player) => (
            <div key={player.Player_ID}>
              <PlayerCard player={player} />
            </div>
          ))}
        </div>

        {/* Bowlers */}
        <div className="absolute top-[85%] left-0 w-full flex justify-center gap-16">
          {(playersByRole.bowler || []).slice(0, 4).map((player) => (
            <div key={player.Player_ID}>
              <PlayerCard player={player} />
            </div>
          ))}
        </div>
      </div>

      {/* Role distribution overlay */}
      <div className="absolute top-2 left-2 bg-black/70 text-white p-2 text-xs rounded">
        <p>WK: {wicketKeepers.length}</p>
        <p>BAT: {playersByRole.batsman?.length || 0}</p>
        <p>AR: {((playersByRole['batting-all-rounder']?.length || 0) + (playersByRole['bowling-all-rounder']?.length || 0))}</p>
        <p>BOWL: {playersByRole.bowler?.length || 0}</p>
      </div>
    </div>
  );
};

export default function MyTeam() {
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerPointsByMatch, setPlayerPointsByMatch] = useState<Record<string, PlayerPointsBreakdown>>({});
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'pitch' | 'list'>('list');
  const [loading, setLoading] = useState(true);

  // Load selected players from localStorage
  useEffect(() => {
    try {
      const savedTeam = JSON.parse(localStorage.getItem("myTeam") || "[]");
      const transformedTeam = savedTeam.map(transformPlayerKeys);
      setSelectedPlayers(transformedTeam);
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
          .order('match_date', { ascending: true });

        if (matchesError) throw matchesError;
        setMatches(matchesData);

        const playerNames = selectedPlayers.map(player => player.Player);
        const { data: pointsData, error: pointsError } = await supabase
          .from("player_points")
          .select("*")
          .in('player_name', playerNames);

        if (pointsError) throw pointsError;

        const pointsByPlayer: Record<string, PlayerPointsBreakdown> = {};

        playerNames.forEach(playerName => {
          const playerPoints = pointsData.filter(p => p.player_name === playerName);
          const matchPoints: Record<string, PlayerMatchPoints> = {};
          let playerTotal = 0;

          playerPoints.forEach(point => {
            matchPoints[point.match_id] = point;
            playerTotal += point.total_points;
          });

          pointsByPlayer[playerName] = {
            matches: matchPoints,
            totalPoints: playerTotal
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
  
  const getMatchStats = () => {
    if (!currentMatch) return { totalPoints: 0, averagePoints: 0, highestPoints: 0 };
    
    const points = selectedPlayers.map(player => 
      playerPointsByMatch[player.Player]?.matches[currentMatch.id]?.total_points || 0
    );
    
    const totalPoints = points.reduce((sum, p) => sum + p, 0);
    const averagePoints = points.length ? Math.round(totalPoints / points.length) : 0;
    const highestPoints = Math.max(...points);
    
    return { totalPoints, averagePoints, highestPoints };
  };

  const { totalPoints, averagePoints, highestPoints } = getMatchStats();

  return (
    <main className="container mx-auto p-8">
      <div className="bg-white rounded-lg shadow p-6">
        {loading ? (
          <div className="text-center py-8">
            <p>Loading team stats...</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <button
                onClick={() => setCurrentMatchIndex(i => Math.max(0, i - 1))}
                disabled={currentMatchIndex === 0}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
                Previous
              </button>
              
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-1">
                  Matchday {currentMatchIndex + 1}
                </h2>
                {currentMatch && (
                  <p className="text-gray-600">
                    {currentMatch.teams.join(" vs ")}
                  </p>
                )}
              </div>

              <button
                onClick={() => setCurrentMatchIndex(i => Math.min(matches.length - 1, i + 1))}
                disabled={currentMatchIndex === matches.length - 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-lg p-4">
                <p className="text-sm text-purple-600 mb-1">Team Points</p>
                <p className="text-3xl font-bold text-purple-900">{totalPoints}</p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 mb-1">Average Player</p>
                <p className="text-3xl font-bold text-blue-900">{averagePoints}</p>
              </div>
              
              <div className="bg-gradient-to-br from-green-100 to-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 mb-1">Highest Player</p>
                <p className="text-3xl font-bold text-green-900">{highestPoints}</p>
              </div>

              <div className="bg-gradient-to-br from-amber-100 to-amber-50 rounded-lg p-4">
                <p className="text-sm text-amber-600 mb-1">Total Players</p>
                <p className="text-3xl font-bold text-amber-900">{selectedPlayers.length}</p>
              </div>
            </div>

            <div className="mb-6 flex justify-center space-x-4">
              <button
                onClick={() => setViewMode('pitch')}
                className={`px-6 py-2 rounded-full ${
                  viewMode === 'pitch' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Pitch View
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-6 py-2 rounded-full ${
                  viewMode === 'list' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                List View
              </button>
            </div>

            {viewMode === 'list' && currentMatch && (
              <div className="space-y-3">
                {selectedPlayers.map((player) => {
                  const matchPoints = playerPointsByMatch[player.Player]?.matches[currentMatch.id];
                  const isTopScorer = matchPoints?.total_points === highestPoints && highestPoints > 0;
                  
                  return (
                    <div 
                      key={player.Player_ID}
                      className={`flex items-center justify-between p-4 rounded-lg ${
                        isTopScorer ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {isTopScorer && (
                          <Trophy className="w-5 h-5 text-amber-500" />
                        )}
                        <div>
                          <p className="font-medium">{player.Player}</p>
                          <p className="text-sm text-gray-600">
                            {player.Role_Detail} • {player.Team_Name}
                          </p>
                        </div>
                      </div>
                      
                      {matchPoints ? (
                        <div className="text-right">
                          <p className="font-bold text-lg">{matchPoints.total_points} pts</p>
                          <div className="text-sm text-gray-500">
                            Bat: {matchPoints.batting_points} • 
                            Bowl: {matchPoints.bowling_points} • 
                            Field: {matchPoints.fielding_points} • 
                            POTM: {matchPoints.potm_points}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500">Did not play</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {viewMode === 'pitch' && currentMatch && (
              <PitchView 
                players={selectedPlayers}
                currentMatch={currentMatch}
                playerPointsByMatch={playerPointsByMatch}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}