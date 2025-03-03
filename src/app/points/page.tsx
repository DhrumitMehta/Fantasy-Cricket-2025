"use client";

import { supabase } from "@/utils/supabaseClient";
import { useEffect, useState } from "react";

type PlayerPoints = {
  id: string;
  player_name: string;
  team: string;
  batting_points: number;
  bowling_points: number;
  fielding_points: number;  
  potm_points: number;
  total_points: number;     
  match_id?: string;
};

export default function Points() {
  const [playerPoints, setPlayerPoints] = useState<PlayerPoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlayerPoints() {
      try {
        const { data, error } = await supabase
          .from("player_points")
          .select("*")
          .order("total_points", { ascending: false });

        if (error) {
          console.error("Supabase error:", error);
          setError(error.message);
        } else {
          setPlayerPoints(data || []);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchPlayerPoints();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Player Points</h1>

      {loading ? (
        <p>Loading player points...</p>
      ) : error ? (
        <div className="text-red-500">Error: {error}</div>
      ) : (
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2">Player Name</th>
              <th className="border border-gray-300 p-2">Team</th>
              <th className="border border-gray-300 p-2">Batting Points</th>
              <th className="border border-gray-300 p-2">Bowling Points</th>
              <th className="border border-gray-300 p-2">Fielding Points</th>
              <th className="border border-gray-300 p-2">POTM Points</th>
              <th className="border border-gray-300 p-2">Total Points</th>
              <th className="border border-gray-300 p-2">Match ID</th>
            </tr>
          </thead>
          <tbody>
            {playerPoints.map((player) => (
              <tr key={player.id} className="border border-gray-300">
                <td className="border border-gray-300 p-2">{player.player_name}</td>
                <td className="border border-gray-300 p-2">{player.team}</td>
                <td className="border border-gray-300 p-2">{player.batting_points}</td>
                <td className="border border-gray-300 p-2">{player.bowling_points}</td>
                <td className="border border-gray-300 p-2">{player.fielding_points}</td>
                <td className="border border-gray-300 p-2">{player.potm_points}</td>
                <td className="border border-gray-300 p-2 font-bold">{player.total_points}</td>
                <td className="border border-gray-300 p-2">{player.match_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}