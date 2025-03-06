"use client";

import { useState, useEffect } from "react";
import { Player } from "@/types/player";
import { useRouter } from "next/navigation";
import "./styles.css";

// Add PlayerModal component within the same file
interface PlayerModalProps {
  player: Player;
  onClose: () => void;
}

// PlayerCard component
const PlayerCard = ({ player, onRemove }: { player: Player; onRemove: () => void }) => {
  return (
    <div className="w-28 bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 hover:border-white/40 transition-colors group">
      <div className="text-center">
        <p className="text-sm font-semibold text-white truncate">
          {player.Player}
          {player.Country !== "India" && <span className="ml-1">✈️</span>}
        </p>
        <p className="text-xs text-white/70 mt-1">{player.Role_Detail}</p>
        <p className="text-xs font-medium bg-white/20 rounded-full px-2 py-0.5 mt-2">
          {player.Price?.toFixed(1)}M
        </p>
      </div>
      <button
        onClick={onRemove}
        className="w-full mt-2 py-1 px-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
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
  const [filters, setFilters] = useState({
    role: "",
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

  // Fetch all players and initialize team on component mount
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        // Fetch players with prices directly from JSON file
        const playersResponse = await fetch("/data/players_with_prices.json");
        if (!playersResponse.ok) throw new Error("Failed to fetch players");
        const playersData = await playersResponse.json();

        // Transform players (prices are already included in the data)
        const transformedPlayers = playersData.map(transformPlayerKeys);

        // Add validation to ensure all players have an ID
        const validPlayers = transformedPlayers.filter((player: Player) => {
          if (!player.Player_ID) {
            console.warn("Player missing ID:", player);
            return false;
          }
          return true;
        });

        setPlayers(validPlayers);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchPlayers();

    // Load existing team from localStorage with transformed keys and validation
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

    // Save to localStorage and update myTeam
    localStorage.setItem("myTeam", JSON.stringify(selectedPlayers));
    setMyTeam(selectedPlayers);
    alert("Team saved successfully!");

    // Navigate to home page
    router.push("/");
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
    <div className="h-screen flex">
      {/* Left Side - Filters and Player List */}
      <div className="w-1/2 h-full overflow-y-auto p-6 bg-gray-50">
        <h1 className="text-2xl font-bold mb-6">Transfer Market</h1>

        {/* Stats Card */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-gray-500">Budget Remaining</div>
              <div className="text-2xl font-bold text-green-600">
                {(100 - totalTeamPrice).toFixed(1)}M
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-500">Players Selected</div>
              <div className="text-2xl font-bold">{selectedPlayers.length}/11</div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="space-y-4 mb-6">
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
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            >
              <option value="">All Roles</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <select
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
            >
              <option value="">All Countries</option>
              <option value="India">India</option>
              <option value="Overseas">Overseas</option>
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
                    className="p-4 border border-gray-100 rounded-lg hover:border-blue-200 transition-colors"
                  >
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
                      </div>
                      <span className="text-sm bg-green-50 px-3 py-1 rounded-full text-green-600 font-medium">
                        {player.Price?.toFixed(1)}M
                      </span>
                    </div>
                    <button
                      onClick={() => togglePlayerSelection(player)}
                      className="w-full mt-2 py-2 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                      disabled={
                        selectedPlayers.filter((p) => p.Country !== "India").length >= 4 &&
                        player.Country !== "India"
                      }
                    >
                      Add to Selection
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Side - Cricket Pitch */}
      <div className="w-1/2 h-full bg-gradient-to-br from-green-600 to-green-700 p-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Selected Squad</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/20 rounded-lg p-3">
              <div className="text-sm text-white/70">Total Value</div>
              <div className="text-2xl font-bold text-white">{totalTeamPrice.toFixed(1)}M</div>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <div className="text-sm text-white/70">Overseas Players</div>
              <div className="text-2xl font-bold text-white">
                {selectedPlayers.filter((p) => p.Country !== "India").length}/4
              </div>
            </div>
          </div>
        </div>

        <div className="relative w-full h-[calc(100%-8rem)] bg-gradient-to-b from-green-600 to-green-700 rounded-2xl overflow-hidden">
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
              {selectedPlayers
                .filter((p) => p.Player_Role === "Batter")
                .slice(0, 3)
                .map((player) => (
                  <div
                    key={player.Player_ID}
                    className="transform hover:scale-105 transition-transform"
                  >
                    <PlayerCard player={player} onRemove={() => togglePlayerSelection(player)} />
                  </div>
                ))}
            </div>

            {/* Middle-order batsmen */}
            <div className="absolute top-[35%] left-0 w-full flex justify-center gap-32">
              {selectedPlayers
                .filter((p) => p.Player_Role === "Batter")
                .slice(3, 5)
                .map((player) => (
                  <div
                    key={player.Player_ID}
                    className="transform hover:scale-105 transition-transform"
                  >
                    <PlayerCard player={player} onRemove={() => togglePlayerSelection(player)} />
                  </div>
                ))}
            </div>

            {/* Wicket-keeper */}
            <div className="absolute top-[50%] left-1/2 transform -translate-x-1/2">
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

            {/* All-rounders */}
            <div className="absolute top-[65%] left-0 w-full flex justify-center gap-32">
              {selectedPlayers
                .filter(
                  (p) =>
                    p.Player_Role === "Batting Allrounder" || p.Player_Role === "Bowling Allrounder"
                )
                .slice(0, 2)
                .map((player) => (
                  <div
                    key={player.Player_ID}
                    className="transform hover:scale-105 transition-transform"
                  >
                    <PlayerCard player={player} onRemove={() => togglePlayerSelection(player)} />
                  </div>
                ))}
            </div>

            {/* Bowlers */}
            <div className="absolute top-[85%] left-0 w-full flex justify-center gap-16">
              {selectedPlayers
                .filter((p) => p.Player_Role === "Bowler")
                .slice(0, 4)
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

          {/* Confirm button */}
          <button
            onClick={confirmTeamSelection}
            className={`absolute bottom-4 right-4 py-2 px-6 rounded-xl ${
              selectedPlayers.length === 11
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-white/20 text-white/50 cursor-not-allowed"
            } transition-colors backdrop-blur-sm`}
            disabled={selectedPlayers.length !== 11}
          >
            Confirm Squad
          </button>
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
