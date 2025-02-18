"use client";

import { useState, useEffect } from "react";
import { Player } from "@/types/player";

export default function MyTeam() {
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);

  // Updated transform function to handle both formats
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
    Team_ID: player['Team ID'] || player.Team_ID || player.team_id
  });

  useEffect(() => {
    try {
      const savedTeam = JSON.parse(localStorage.getItem("myTeam") || "[]");
      console.log("Loaded team:", savedTeam); // Debug log
      const transformedTeam = savedTeam.map(transformPlayerKeys);
      console.log("Transformed team:", transformedTeam); // Debug log
      setSelectedPlayers(transformedTeam);
    } catch (error) {
      console.error("Error loading team:", error);
      setSelectedPlayers([]);
    }

    const handleStorageChange = () => {
      try {
        const updatedTeam = JSON.parse(localStorage.getItem("myTeam") || "[]");
        const transformedTeam = updatedTeam.map(transformPlayerKeys);
        setSelectedPlayers(transformedTeam);
      } catch (error) {
        console.error("Error handling storage change:", error);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <main className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">My Team</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Squad Overview</h2>
          <span className="px-4 py-2 bg-gray-100 rounded-full">
            {selectedPlayers.length}/11 Players
          </span>
        </div>

        {selectedPlayers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-lg">
              Your team is empty. Visit the Transfer Market to add players!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedPlayers.map((player) => (
              <div 
                key={player.Player_ID}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{player.Player}</h3>
                  <p className="text-gray-600">
                    {player.Role_Detail} • {player.Team_Name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
