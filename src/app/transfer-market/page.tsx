"use client";

import { useState, useEffect } from "react";
import { Player } from "@/types/player";
import { useRouter } from "next/navigation";
import "./styles.css";
import { createClient } from '@supabase/supabase-js';

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Updated Match type definition to match your Supabase table structure
interface Match {
  id: number;
  match_date: string;  // Changed from date to match_date
  teams: string[];     // Array of teams instead of team1/team2
  venue: string;       // Changed from location to venue
  result: string;      // Result as a string instead of score1/score2
}

// Updated Match Card Component
const MatchCard = ({ match }: { match: Match }) => {
  const formatDate = (dateString: string) => {
    // Parse the ISO date format from your database
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Extract team names from the teams array
  const team1 = match.teams[0] || '';
  const team2 = match.teams[1] || '';

  return (
    <div className="min-w-[250px] bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 hover:border-white/40 transition-colors">
      <div className="text-sm font-medium text-white/90">{formatDate(match.match_date)}</div>
      <div className="flex justify-between items-center mt-2">
        <div className="flex-1 text-[8px] font-semibold text-white text-center line-clamp-2 min-h-[20px]">{team1}</div>
        <div className="text-xs px-2 py-0.5 rounded bg-white/20 mx-1">VS</div>
        <div className="flex-1 text-[8px] font-semibold text-white text-center line-clamp-2 min-h-[20px]">{team2}</div>
      </div>
      <div className="text-[10px] text-white/50 mt-1 text-center truncate">{match.venue}</div>
      <div className="text-[11px] text-white/90 mt-2 text-center font-medium bg-black/30 rounded-full py-1">
        {match.result}
      </div>
    </div>
  );
};

// Add PlayerModal component within the same file
interface PlayerModalProps {
  player: Player;
  onClose: () => void;
}

// PlayerCard component
const PlayerCard = ({ player, onRemove }: { player: Player; onRemove: () => void }) => {
  return (
    <div className="w-24 bg-white/10 backdrop-blur-sm rounded-lg p-2 border border-white/20 hover:border-white/40 transition-colors group">
      <div className="text-center">
        <p className="text-xs font-semibold text-white truncate">
          {player.Player}
          {player.Country !== "India" && <span className="ml-1">✈️</span>}
        </p>
        <p className="text-[10px] text-white/70 mt-0.5">{player.Role_Detail}</p>
        <p className="text-[10px] font-medium bg-white/20 rounded-full px-1.5 py-0.5 mt-1">
          {player.Price?.toFixed(1)}M
        </p>
      </div>
      <button
        onClick={onRemove}
        className="w-full mt-1 py-0.5 px-1.5 rounded-md bg-red-500/20 hover:bg-red-500/40 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        Remove
      </button>
    </div>
  );
};

const PlayerModal = ({ player, onClose }: PlayerModalProps) => {
  // Helper function to calculate age
  const calculateAge = (birthDate: string) => {
    if (!birthDate) return "N/A";

    const dob = new Date(birthDate);
    const today = new Date();

    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return age;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">
              {player.Player}
              {player.Country !== "India" && <span className="ml-2">✈️</span>}
            </h2>
            <span className="text-sm bg-green-100 px-2 py-1 rounded mt-1 inline-block">
              {player.Price?.toFixed(1)}M
            </span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <span className="font-semibold">Role:</span>
            <span>{player.Player_Role}</span>

            <span className="font-semibold">Role Detail:</span>
            <span>{player.Role_Detail}</span>

            <span className="font-semibold">Country:</span>
            <span>{player.Country}</span>

            <span className="font-semibold">Team:</span>
            <span>{player.Team_Name}</span>

            <span className="font-semibold">Birth Date:</span>
            <span>{player.Birth_Date}</span>

            <span className="font-semibold">Age:</span>
            <span>{calculateAge(player.Birth_Date)} years</span>

            <span className="font-semibold">Birth Place:</span>
            <span>{player.Birth_Place}</span>

            <span className="font-semibold">Height:</span>
            <span>{player.Height}</span>

            <span className="font-semibold">Batting Style:</span>
            <span>{player.Batting_Style}</span>

            <span className="font-semibold">Bowling Style:</span>
            <span>{player.Bowling_Style}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function TransferMarket() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [myTeam, setMyTeam] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [filters, setFilters] = useState({
    role: "WK-Batter",
    country: "",
    team: "",
    searchQuery: "",
    minPrice: 0,
    maxPrice: 15, // Set default max to 15M
  });
  const [selectedPlayerForModal, setSelectedPlayerForModal] = useState<Player | null>(null);
  const [totalTeamPrice, setTotalTeamPrice] = useState<number>(0);
  const [priceStats, setPriceStats] = useState({
    min: 0,
    max: 15,
    avg: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Helper function to transform player keys
  const transformPlayerKeys = (player: any): Player => {
    if (!player["Player ID"] && !player.Player_ID && !player.player_id) {
      console.warn("Missing Player ID in data:", player);
    }

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

  // Get unique values for filters
  const roles = [...new Set(players.map((p) => p.Player_Role))];
  const teams = [...new Set(players.map((p) => p.Team_Name))];

  // Calculate price statistics when players data loads
  useEffect(() => {
    if (players.length > 0) {
      const prices = players.map((p) => p.Price || 0);
      setPriceStats({
        min: Math.floor(Math.min(...prices)),
        max: Math.ceil(Math.max(...prices)),
        avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      });
      // Update max price filter to match actual max price
      setFilters((prev) => ({ ...prev, maxPrice: Math.ceil(Math.max(...prices)) }));
    }
  }, [players]);

  // Update the fetch query to order matches in descending order (newest first)
  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('id, match_date, teams, venue, result')
          .order('match_date', { ascending: false });  // Changed back to descending order for newest first
        
        if (error) throw error;
        setMatches(data || []);
      } catch (error) {
        console.error('Error fetching matches:', error);
      }
    };

    fetchMatches();
  }, []);

  // Update the fetchPlayers function in the useEffect
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('players')
          .select('*');
        
        if (error) {
          console.error("Supabase error:", error);
          throw error;
        }
        
        if (!data) {
          console.warn("No data returned from Supabase");
          setPlayers([]);
          return;
        }

        // Transform the data to match the Player interface
        const transformedPlayers = data.map(player => ({
          Player: player.player_name || player.Player || "Unknown Player",
          Player_ID: player.player_id || player.id || `temp-${Date.now()}`,
          Country: player.country || player.Country || "",
          Player_Role: player.player_role || player.Player_Role || "",
          Role_Detail: player.role_detail || player.Role_Detail || "",
          Birth_Date: player.birth_date || player.Birth_Date || "",
          Birth_Place: player.birth_place || player.Birth_Place || "",
          Height: player.height || player.Height || "",
          Batting_Style: player.batting_style || player.Batting_Style || "",
          Bowling_Style: player.bowling_style || player.Bowling_Style || "",
          Team_Name: player.team_name || player.Team_Name || "",
          Team_ID: player.team_id || player.Team_ID || "",
          Price: parseFloat(player.price) || player.Price || 5.0,
        }));

        console.log("Fetched players:", transformedPlayers); // Debug log
        setPlayers(transformedPlayers);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();

    // Load existing team from localStorage
    const savedTeam = localStorage.getItem("myTeam");
    if (savedTeam) {
      try {
        const parsedTeam = JSON.parse(savedTeam);
        setMyTeam(parsedTeam);
        setSelectedPlayers(parsedTeam);
      } catch (error) {
        console.error("Error parsing saved team:", error);
      }
    }
  }, []);

  // Update useEffect to calculate total price when selectedPlayers changes
  useEffect(() => {
    const total = selectedPlayers.reduce((sum, player) => sum + (player.Price || 0), 0);
    setTotalTeamPrice(total);
  }, [selectedPlayers]);

  // Filter players based on selected criteria and exclude already selected players
  const filteredPlayers = players.filter((player: Player) => {
    const roleMatch = !filters.role || player.Player_Role === filters.role;
    const countryMatch =
      !filters.country ||
      (filters.country === "India" ? player.Country === "India" : player.Country !== "India");
    const teamMatch = !filters.team || player.Team_Name === filters.team;
    const notSelected = !selectedPlayers.some((p) => p.Player_ID === player.Player_ID);
    const nameMatch =
      !filters.searchQuery ||
      player.Player.toLowerCase().includes(filters.searchQuery.toLowerCase());
    const priceMatch =
      (player.Price || 0) >= filters.minPrice && (player.Price || 0) <= filters.maxPrice;

    return roleMatch && countryMatch && teamMatch && notSelected && nameMatch && priceMatch;
  });

  const togglePlayerSelection = (player: Player) => {
    setSelectedPlayers((prevSelected) => {
      if (prevSelected.some((p) => p.Player_ID === player.Player_ID)) {
        // Remove player
        return prevSelected.filter((p) => p.Player_ID !== player.Player_ID);
      } else {
        // Add player
        if (prevSelected.length >= 11) {
          alert("You can't select more than 11 players!");
          return prevSelected;
        }

        // Calculate new total price
        const newTotalPrice =
          prevSelected.reduce((sum, p) => sum + (p.Price || 0), 0) + (player.Price || 0);
        if (newTotalPrice > 100) {
          alert("Team budget cannot exceed 100M!");
          return prevSelected;
        }

        return [...prevSelected, player];
      }
    });
  };

  const validateTeamComposition = (players: Player[]) => {
    const roleCounts = players.reduce((counts: { [key: string]: number }, player) => {
      const role = player.Player_Role;
      counts[role] = (counts[role] || 0) + 1;
      return counts;
    }, {});

    // Count overseas players
    const overseasCount = players.filter((player) => player.Country !== "India").length;

    const validationErrors = [];

    // Check overseas players limit
    if (overseasCount > 4) {
      validationErrors.push(`Too many overseas players (${overseasCount}/4)`);
    }

    const minimumRequirements = {
      Batter: 3,
      Bowler: 3,
      "WK-Batter": 1,
      "Batting Allrounder": 1,
      "Bowling Allrounder": 1,
    };

    for (const [role, minCount] of Object.entries(minimumRequirements)) {
      const currentCount = roleCounts[role] || 0;
      if (currentCount < minCount) {
        validationErrors.push(
          `Need at least ${minCount} ${role}(s) (currently have ${currentCount})`
        );
      }
    }

    return validationErrors;
  };

  const confirmTeamSelection = () => {
    if (selectedPlayers.length !== 11) {
      alert("Please select exactly 11 players!");
      return;
    }

    const validationErrors = validateTeamComposition(selectedPlayers);
    if (validationErrors.length > 0) {
      alert("Team composition invalid:\n" + validationErrors.join("\n"));
      return;
    }

    // Set loading state to true
    setIsLoading(true);

    // Save to localStorage and update myTeam
    localStorage.setItem("myTeam", JSON.stringify(selectedPlayers));
    setMyTeam(selectedPlayers);

    // Navigate to captain selection page with a slight delay to show loading state
    setTimeout(() => {
      router.push("/captain-selection");
    }, 800);
  };

  // Helper function to group players by role with specific order
  const groupPlayersByRole = (players: Player[]) => {
    const roleOrder = [
      "Batter", // For players with "Player Role": "Batter"
      "WK-Batter", // For players with "Player Role": "WK-Batter"
      "Batting Allrounder", // For players with "Player Role": "Batting Allrounder"
      "Bowling Allrounder", // For players with "Player Role": "Bowling Allrounder"
      "Bowler", // For players with "Player Role": "Bowler"
    ];

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
    <div className="h-screen flex flex-col">
      {/* Matches Ribbon */}
      <div className="w-full bg-gradient-to-r from-green-800 to-green-700 p-2 overflow-hidden relative">
        <div className="relative">
          {/* Left scroll button */}
          <button 
            onClick={() => {
              const container = document.getElementById('matches-container');
              if (container) {
                container.scrollLeft -= 300;
              }
            }}
            className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-r-lg p-2 z-10"
            aria-label="Scroll left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          
          {/* Matches container */}
          <div 
            id="matches-container"
            className="flex gap-3 overflow-x-hidden pb-1 scroll-smooth px-8"
          >
            {matches.length > 0 ? (
              matches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))
            ) : (
              <div className="text-white/70 text-sm">Loading matches...</div>
            )}
          </div>
      
          {/* Right scroll button */}
          <button
            onClick={() => {
              const container = document.getElementById('matches-container');
              if (container) {
                container.scrollLeft += 300;
              }
            }}
            className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-l-lg p-2 z-10"
            aria-label="Scroll right"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-y-auto">
      {/* Left Side - Filters and Player List */}
      <div className="w-1/2 h-full overflow-y-auto p-6 bg-gray-50">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Transfer Market</h1>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <span>←</span> Back to Home
          </button>
        </div>

        {/* Stats Card - More Compact */}
        <div className="bg-white rounded-lg shadow-sm p-3 mb-4 flex justify-between">
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500">Budget Remaining</div>
            <div className="text-lg font-bold text-green-600">
              {(100 - totalTeamPrice).toFixed(1)}M
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500">Players Selected</div>
            <div className="text-lg font-bold">{selectedPlayers.length}/11</div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="space-y-4 mb-4">
          <input
            type="text"
            placeholder="Search player name..."
            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={filters.searchQuery}
            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <select
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
            >
              <option value="">All Countries</option>
              <option value="India">India</option>
              <option value="Overseas">Overseas</option>
            </select>

            <select
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.team}
              onChange={(e) => setFilters({ ...filters, team: e.target.value })}
            >
              <option value="">All Teams</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          {/* Price Range Filter */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">
                Price Range: {filters.minPrice}M - {filters.maxPrice}M
              </span>
              <span className="text-sm text-gray-500">Avg: {priceStats.avg.toFixed(1)}M</span>
            </div>
            <div className="relative h-2 bg-gray-200 rounded-full">
              <div
                className="absolute h-full bg-blue-100 rounded-full"
                style={{
                  left: `${(filters.minPrice / priceStats.max) * 100}%`,
                  right: `${100 - (filters.maxPrice / priceStats.max) * 100}%`,
                }}
              />
              <input
                type="range"
                min={priceStats.min}
                max={priceStats.max}
                value={filters.minPrice}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (value <= filters.maxPrice) {
                    setFilters((prev) => ({ ...prev, minPrice: value }));
                  }
                }}
                className="absolute w-full h-2 appearance-none bg-transparent pointer-events-auto z-20"
                style={{ WebkitAppearance: "none" }}
              />
              <input
                type="range"
                min={priceStats.min}
                max={priceStats.max}
                value={filters.maxPrice}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (value >= filters.minPrice) {
                    setFilters((prev) => ({ ...prev, maxPrice: value }));
                  }
                }}
                className="absolute w-full h-2 appearance-none bg-transparent pointer-events-auto z-10"
                style={{ WebkitAppearance: "none" }}
              />
            </div>
          </div>

          {/* Role Selection Tabs */}
          <div className="mt-4">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setFilters({ ...filters, role: "WK-Batter" })}
                className={`flex-1 py-2 px-4 text-center border-b-2 ${
                  filters.role === "WK-Batter"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent"
                }`}
              >
                <div className="font-medium">
                  WK ({selectedPlayers.filter((p) => p.Player_Role === "WK-Batter").length})
                </div>
              </button>
              <button
                onClick={() => setFilters({ ...filters, role: "Batter" })}
                className={`flex-1 py-2 px-4 text-center border-b-2 ${
                  filters.role === "Batter" ? "border-blue-500 text-blue-600" : "border-transparent"
                }`}
              >
                <div className="font-medium">
                  BAT ({selectedPlayers.filter((p) => p.Player_Role === "Batter").length})
                </div>
              </button>
              <button
                onClick={() => setFilters({ ...filters, role: "Batting Allrounder" })}
                className={`flex-1 py-2 px-4 text-center border-b-2 ${
                  filters.role === "Batting Allrounder"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent"
                }`}
              >
                <div className="font-medium">
                  BAT-AR (
                  {selectedPlayers.filter((p) => p.Player_Role === "Batting Allrounder").length})
                </div>
              </button>
              <button
                onClick={() => setFilters({ ...filters, role: "Bowling Allrounder" })}
                className={`flex-1 py-2 px-4 text-center border-b-2 ${
                  filters.role === "Bowling Allrounder"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent"
                }`}
              >
                <div className="font-medium">
                  BOWL-AR (
                  {selectedPlayers.filter((p) => p.Player_Role === "Bowling Allrounder").length})
                </div>
              </button>
              <button
                onClick={() => setFilters({ ...filters, role: "Bowler" })}
                className={`flex-1 py-2 px-4 text-center border-b-2 ${
                  filters.role === "Bowler" ? "border-blue-500 text-blue-600" : "border-transparent"
                }`}
              >
                <div className="font-medium">
                  BOWL ({selectedPlayers.filter((p) => p.Player_Role === "Bowler").length})
                </div>
              </button>
            </div>

            {/* Role Selection Rules */}
            <div className="bg-gray-50 p-3 mt-2 rounded-lg text-sm text-gray-600 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {filters.role === "WK-Batter" && "Pick 1-4 Wicket-Keepers"}
              {filters.role === "Batter" && "Pick 3-6 Batters"}
              {filters.role === "Batting Allrounder" && "Pick 1-4 Batting All-rounders"}
              {filters.role === "Bowling Allrounder" && "Pick 1-4 Bowling All-rounders"}
              {filters.role === "Bowler" && "Pick 3-6 Bowlers"}
              {!filters.role && "Select a role tab to see selection rules"}
            </div>
          </div>
        </div>

        {/* Available Players List */}
        <div className="space-y-6">
          {groupPlayersByRole(filteredPlayers).map(([role, players]) => (
            <div key={role} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">{role}</h3>
                <span className="text-sm bg-blue-50 px-3 py-1 rounded-full text-blue-600">
                  {players.length} available
                </span>
              </div>
              <div className="grid gap-4">
                {players.map((player) => (
                  <div
                    key={`available-${player.Player_ID}`}
                    className="p-4 border border-gray-100 rounded-lg hover:border-blue-200 transition-colors flex items-center"
                  >
                    {/* Profile Image */}
                    <img
                      src="/profile-placeholder.png"
                      alt={`${player.Player} profile`}
                      className="w-10 h-10 rounded-full mr-4"
                    />

                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3
                            className="font-bold cursor-pointer hover:text-blue-600"
                            onClick={() => setSelectedPlayerForModal(player)}
                          >
                            {player.Player}
                            {player.Country !== "India" && <span className="ml-2">✈️</span>}
                          </h3>
                          <div className="text-sm text-gray-500 mt-1">{player.Team_Name}</div>
                          {/* Player Position */}
                          <div className="text-sm text-gray-500">{player.Player_Role}</div>
                        </div>
                      </div>
                    </div>

                    {/* Price and "+" Icon */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm bg-green-50 px-3 py-1 mt-1 rounded-full text-green-600 font-medium mx-2">
                        {player.Price?.toFixed(1)}M
                      </span>
                      <button
                        onClick={() => togglePlayerSelection(player)}
                        className="text-blue-500 hover:text-blue-600 transition-colors text-2xl"
                        disabled={
                          selectedPlayers.filter((p) => p.Country !== "India").length >= 4 &&
                          player.Country !== "India"
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - Cricket Pitch */}
      <div className="w-1/2 h-full bg-gradient-to-br from-green-600 to-green-700 p-4">
        {/* Smaller Selected Squad section */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 mb-3 flex justify-between items-center">
          <h2 className="text-base font-bold text-white">Selected Squad</h2>
          <div className="flex gap-4">
            <div className="bg-white/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <div className="text-xs text-white/70">Value:</div>
              <div className="text-sm font-bold text-white">{totalTeamPrice.toFixed(1)}M</div>
            </div>
            <div className="bg-white/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <div className="text-xs text-white/70">Overseas:</div>
              <div className="text-sm font-bold text-white">
                {selectedPlayers.filter((p) => p.Country !== "India").length}/4
              </div>
            </div>
          </div>
        </div>

        {/* Enlarged Pitch View */}
        <div className="relative w-full h-[calc(100%-3.5rem)] bg-gradient-to-b from-green-600 to-green-700 rounded-xl overflow-hidden">
          {/* Pitch markings */}
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[85%] h-[90%] rounded-full border-2 border-white/30" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] rounded-full border-2 border-white/30" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-[80%] bg-green-800/20 border-2 border-white/30" />
          </div>

          {/* Player Positions */}
          <div className="absolute inset-0">
            {/* All batters in a single row */}
            <div className="absolute top-[15%] left-0 w-full flex justify-center">
              <div className="flex flex-wrap justify-center gap-3 max-w-[90%]">
              {selectedPlayers
                .filter((p) => p.Player_Role === "Batter")
                .map((player) => (
                  <div
                    key={player.Player_ID}
                    className="transform hover:scale-105 transition-transform"
                  >
                    <PlayerCard player={player} onRemove={() => togglePlayerSelection(player)} />
                  </div>
                ))}
            </div>
            </div>

            {/* Wicket-keeper - closer to batters */}
            <div className="absolute top-[36%] left-1/2 transform -translate-x-1/2">
              {selectedPlayers
                .filter((p) => p.Player_Role === "WK-Batter")
                .slice(0, 1)
                .map((player) => (
                  <div
                    key={player.Player_ID}
                    className="transform hover:scale-105 transition-transform"
                  >
                    <PlayerCard player={player} onRemove={() => togglePlayerSelection(player)} />
                  </div>
                ))}
            </div>

            {/* All-rounders row */}
            <div className="absolute top-[57%] left-0 w-full">
              <div className="flex justify-center gap-4 max-w-full mx-auto">
              {selectedPlayers
                .filter(
                  (p) =>
                    p.Player_Role === "Batting Allrounder" || p.Player_Role === "Bowling Allrounder"
                )
                .map((player) => (
                  <div
                    key={player.Player_ID}
                    className="transform hover:scale-105 transition-transform"
                  >
                    <PlayerCard player={player} onRemove={() => togglePlayerSelection(player)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Bowlers row */}
            <div className="absolute top-[78%] left-0 w-full">
              <div className="flex justify-center flex-wrap gap-3 max-w-[90%] mx-auto">
              {selectedPlayers
                .filter((p) => p.Player_Role === "Bowler")
                .map((player) => (
                  <div
                    key={player.Player_ID}
                    className="transform hover:scale-105 transition-transform"
                  >
                    <PlayerCard player={player} onRemove={() => togglePlayerSelection(player)} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Role distribution overlay */}
          <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm text-white p-4 rounded-xl text-sm space-y-1">
            <p>WK: {selectedPlayers.filter((p) => p.Player_Role === "WK-Batter").length}</p>
            <p>BAT: {selectedPlayers.filter((p) => p.Player_Role === "Batter").length}</p>
            <p>
              AR:{" "}
              {
                selectedPlayers.filter(
                  (p) =>
                    p.Player_Role === "Batting Allrounder" || p.Player_Role === "Bowling Allrounder"
                ).length
              }
            </p>
            <p>BOWL: {selectedPlayers.filter((p) => p.Player_Role === "Bowler").length}</p>
          </div>

          {/* Confirm button - with red transparent background */}
          <button
            onClick={confirmTeamSelection}
            className={`absolute top-4 right-4 py-2 px-6 rounded-xl ${
              selectedPlayers.length === 11
                ? "bg-red-600/70 hover:bg-red-700/80 text-white"
                : "bg-red-500/30 text-white/50 cursor-not-allowed"
            } transition-colors backdrop-blur-sm flex items-center gap-2`}
            disabled={selectedPlayers.length !== 11 || isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              "Confirm Squad"
            )}
          </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedPlayerForModal && (
        <PlayerModal
          player={selectedPlayerForModal}
          onClose={() => setSelectedPlayerForModal(null)}
        />
      )}
    </div>
  );
}
