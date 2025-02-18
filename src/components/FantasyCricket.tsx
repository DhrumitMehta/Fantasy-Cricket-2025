import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AlertCircle, Check, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/src/components/ui/alert";

const FantasyCricket = () => {
  const [players, setPlayers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [budget, setBudget] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [teamFilter, setTeamFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Team composition rules
  const TEAM_RULES = {
    maxPlayers: 11,
    minBatsmen: 3,
    maxBatsmen: 6,
    minBowlers: 3,
    maxBowlers: 6,
    minWicketkeepers: 1,
    maxWicketkeepers: 2,
    minAllrounders: 1,
    maxAllrounders: 4,
    maxPerTeam: 4,
  };

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await fetch("/data/players.json");
        if (!response.ok) throw new Error("Failed to fetch players");
        const data = await response.json();
        const playersWithPrices = data.map((player) => ({
          ...player,
          price: calculatePlayerPrice(player),
        }));
        setPlayers(playersWithPrices);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, []);

  const calculatePlayerPrice = (player) => {
    const basePrice = {
      Batsman: 8.0,
      "Batting Allrounder": 9.0,
      "Bowling Allrounder": 8.5,
      Bowler: 8.0,
      "WK-Batsman": 8.5,
    };

    const countryPremium = {
      Australia: 1.5,
      England: 1.5,
      India: 1.2,
      "South Africa": 1.2,
      "New Zealand": 1.2,
      "West Indies": 1.0,
      "Sri Lanka": 1.0,
    };

    const base = basePrice[player.Role_Detail] || 7.5;
    const premium = countryPremium[player.Country] || 1.0;
    return Number((base * premium).toFixed(1));
  };

  const getTeamStats = () => {
    return selectedPlayers.reduce(
      (acc, player) => {
        const teamCount = acc.teamCounts[player.Team_Name] || 0;
        acc.teamCounts[player.Team_Name] = teamCount + 1;

        switch (player.Role_Detail) {
          case "Batsman":
            acc.batsmen += 1;
            break;
          case "Bowler":
            acc.bowlers += 1;
            break;
          case "WK-Batsman":
            acc.wicketkeepers += 1;
            break;
          case "Batting Allrounder":
          case "Bowling Allrounder":
            acc.allrounders += 1;
            break;
        }
        return acc;
      },
      { batsmen: 0, bowlers: 0, wicketkeepers: 0, allrounders: 0, teamCounts: {} }
    );
  };

  const validateSelection = (player) => {
    const stats = getTeamStats();
    const teamCount = (stats.teamCounts[player.Team_Name] || 0) + 1;

    if (selectedPlayers.length >= TEAM_RULES.maxPlayers)
      return "Team is full (11 players maximum)";
    
    if (budget < player.price)
      return "Not enough budget";

    if (teamCount > TEAM_RULES.maxPerTeam)
      return `Maximum ${TEAM_RULES.maxPerTeam} players allowed from same team`;

    switch (player.Role_Detail) {
      case "Batsman":
        if (stats.batsmen >= TEAM_RULES.maxBatsmen)
          return `Maximum ${TEAM_RULES.maxBatsmen} batsmen allowed`;
        break;
      case "Bowler":
        if (stats.bowlers >= TEAM_RULES.maxBowlers)
          return `Maximum ${TEAM_RULES.maxBowlers} bowlers allowed`;
        break;
      case "WK-Batsman":
        if (stats.wicketkeepers >= TEAM_RULES.maxWicketkeepers)
          return `Maximum ${TEAM_RULES.maxWicketkeepers} wicketkeepers allowed`;
        break;
      case "Batting Allrounder":
      case "Bowling Allrounder":
        if (stats.allrounders >= TEAM_RULES.maxAllrounders)
          return `Maximum ${TEAM_RULES.maxAllrounders} all-rounders allowed`;
        break;
    }

    return null;
  };

  const handlePlayerSelect = (player) => {
    const validationError = validateSelection(player);
    if (validationError) {
      alert(validationError);
      return;
    }

    setSelectedPlayers([...selectedPlayers, player]);
    setBudget((prev) => Number((prev - player.price).toFixed(1)));
  };

  const handlePlayerRemove = (player) => {
    setSelectedPlayers(selectedPlayers.filter((p) => p.Player_ID !== player.Player_ID));
    setBudget((prev) => Number((prev + player.price).toFixed(1)));
  };

  const getTeamValidationStatus = () => {
    const stats = getTeamStats();
    const validations = [];

    if (selectedPlayers.length < TEAM_RULES.maxPlayers)
      validations.push(`Need ${TEAM_RULES.maxPlayers - selectedPlayers.length} more players`);
    if (stats.wicketkeepers < TEAM_RULES.minWicketkeepers)
      validations.push(`Need ${TEAM_RULES.minWicketkeepers - stats.wicketkeepers} more wicketkeeper`);
    if (stats.batsmen < TEAM_RULES.minBatsmen)
      validations.push(`Need ${TEAM_RULES.minBatsmen - stats.batsmen} more batsmen`);
    if (stats.bowlers < TEAM_RULES.minBowlers)
      validations.push(`Need ${TEAM_RULES.minBowlers - stats.bowlers} more bowlers`);
    if (stats.allrounders < TEAM_RULES.minAllrounders)
      validations.push(`Need ${TEAM_RULES.minAllrounders - stats.allrounders} more all-rounders`);

    return validations;
  };

  const filteredPlayers = players.filter((player) => {
    const isNotSelected = !selectedPlayers.find((p) => p.Player_ID === player.Player_ID);
    const matchesSearch = 
      player.Player.toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.Team_Name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "All" || player.Role_Detail === roleFilter;
    const matchesTeam = teamFilter === "All" || player.Team_Name === teamFilter;
    
    return isNotSelected && matchesSearch && matchesRole && matchesTeam;
  });

  if (loading) return <div className="p-4">Loading players...</div>;
  if (error) return <div className="p-4">Error: {error}</div>;

  const teamStats = getTeamStats();
  const validations = getTeamValidationStatus();
  const uniqueTeams = [...new Set(players.map(player => player.Team_Name))];

  return (
    <div className="p-4 space-y-4">
      {/* Header Stats */}
      <Card>
        <CardHeader>
          <CardTitle>WPL Fantasy Cricket</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>Budget: {budget.toFixed(1)} credits</span>
              </div>
              <div>Selected: {selectedPlayers.length}/11</div>
              <div>Batsmen: {teamStats.batsmen}/{TEAM_RULES.maxBatsmen}</div>
              <div>Bowlers: {teamStats.bowlers}/{TEAM_RULES.maxBowlers}</div>
              <div>Wicketkeepers: {teamStats.wicketkeepers}/{TEAM_RULES.maxWicketkeepers}</div>
              <div>All-rounders: {teamStats.allrounders}/{TEAM_RULES.maxAllrounders}</div>
            </div>

            {validations.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {validations.map((validation, index) => (
                      <li key={index}>{validation}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Search players..."
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="All">All Roles</option>
              <option value="Batsman">Batsman</option>
              <option value="Bowler">Bowler</option>
              <option value="WK-Batsman">Wicketkeeper</option>
              <option value="Batting Allrounder">Batting Allrounder</option>
              <option value="Bowling Allrounder">Bowling Allrounder</option>
            </select>
            <select
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
            >
              <option value="All">All Teams</option>
              {uniqueTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Available Players */}
        <Card>
          <CardHeader>
            <CardTitle>Available Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredPlayers.map((player) => (
                <div
                  key={player.Player_ID}
                  onClick={() => handlePlayerSelect(player)}
                  className="flex justify-between p-2 border border-gray-700 rounded cursor-pointer hover:bg-gray-800"
                >
                  <div>
                    <div className="font-medium">{player.Player}</div>
                    <div className="text-sm text-gray-400">
                      {player.Role_Detail} • {player.Team_Name}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium">{player.price} credits</span>
                  </div>
                </div>
              ))}
              {filteredPlayers.length === 0 && (
                <div className="text-center text-gray-500 py-4">No players found</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Selected Team */}
        <Card>
          <CardHeader>
            <CardTitle>Your Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedPlayers.map((player) => (
                <div
                  key={player.Player_ID}
                  onClick={() => handlePlayerRemove(player)}
                  className="flex justify-between p-2 border border-gray-700 rounded cursor-pointer hover:bg-gray-800"
                >
                  <div>
                    <div className="font-medium">{player.Player}</div>
                    <div className="text-sm text-gray-400">
                      {player.Role_Detail} • {player.Team_Name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{player.price} credits</span>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                </div>
              ))}
              {selectedPlayers.length === 0 && (
                <div className="text-center text-gray-500 py-4">No players selected</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FantasyCricket;