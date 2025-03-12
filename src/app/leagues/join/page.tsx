"use client";

import { useState, FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function JoinLeague() {
  const router = useRouter();
  const [leagueCode, setLeagueCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoinPublicLeague = async (leagueId: string) => {
    try {
      if (!user) return;
      
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('user_leagues')
        .select('*')
        .eq('user_id', user.id)
        .eq('league_id', leagueId)
        .maybeSingle();
        
      if (existingMember) {
        alert("You're already a member of this league");
        return;
      }
      
      // Add the user to the league
      const { error: joinError } = await supabase
        .from('user_leagues')
        .insert({
          user_id: user.id,
          league_id: leagueId,
          is_admin: false
        });
        
      if (joinError) throw joinError;
      
      // Refresh the leagues data
      fetchLeagues(user.id);
      alert("Successfully joined the league!");
    } catch (error: any) {
      console.error("Error joining league:", error);
      alert(error.message || "Failed to join the league");
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1c2e] py-12">
      <div className="max-w-md mx-auto px-4">
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          <h1 className="text-3xl font-bold text-white mb-6">Join a League</h1>
          
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          <form onSubmit={handleJoinLeague} className="space-y-6">
            <div>
              <label htmlFor="leagueCode" className="block text-sm font-medium text-gray-300 mb-1">
                League Code
              </label>
              <input
                id="leagueCode"
                type="text"
                required
                value={leagueCode}
                onChange={(e) => setLeagueCode(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                placeholder="Enter league code"
              />
            </div>
            
            // Then update the button's onClick handler:
            <button
            onClick={() => handleJoinPublicLeague(league.id)}
            className="bg-[#4ade80]/20 hover:bg-[#4ade80]/30 text-[#4ade80] text-center py-2 rounded-lg font-medium transition-all w-full"
            >
            Join League
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}