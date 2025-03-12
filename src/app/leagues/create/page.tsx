"use client";

import { useState, FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function CreateLeague() {
  const router = useRouter();
  const [leagueName, setLeagueName] = useState("");
  const [description, setDescription] = useState("");
  const [maxMembers, setMaxMembers] = useState(10);
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateLeague = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Check if the user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("You must be logged in to create a league");
      }

      // Generate a unique code for the league
      const leagueCode = nanoid(8);
      
      // Generate a unique ID for the league
      const leagueId = nanoid();
      
      // Insert the league into the database
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .insert({
          id: leagueId, // Add the generated ID
          name: leagueName,
          description,
          max_members: maxMembers,
          is_private: isPrivate,
          join_code: leagueCode,
          created_by: session.user.id
        })
        .select()
        .single();

      if (leagueError) throw leagueError;

      // Add the creator as a member of the league
      const { error: memberError } = await supabase
        .from('user_leagues')
        .insert({
          id: nanoid(),
          user_id: session.user.id,
          league_id: league.id,
          is_admin: true
        });

      if (memberError) throw memberError;

      // Redirect to the league page
      router.push(`/leagues/${league.id}`);
    } catch (error: any) {
      setError(error.message || "An error occurred while creating the league");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1c2e] py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/10">
          <h1 className="text-3xl font-bold text-white mb-6">Create Your League</h1>
          
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          <form onSubmit={handleCreateLeague} className="space-y-6">
            <div>
              <label htmlFor="leagueName" className="block text-sm font-medium text-gray-300 mb-1">
                League Name
              </label>
              <input
                id="leagueName"
                type="text"
                required
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                placeholder="Enter league name"
              />
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
                placeholder="Describe your league"
              />
            </div>
            
            <div>
              <label htmlFor="maxMembers" className="block text-sm font-medium text-gray-300 mb-1">
                Maximum Members
              </label>
              <input
                id="maxMembers"
                type="number"
                min={2}
                max={100}
                value={maxMembers}
                onChange={(e) => setMaxMembers(parseInt(e.target.value))}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#4ade80] focus:border-transparent transition-all"
              />
            </div>
            
            <div className="flex items-center">
              <input
                id="isPrivate"
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 text-[#4ade80] focus:ring-[#4ade80] border-gray-300 rounded"
              />
              <label htmlFor="isPrivate" className="ml-2 block text-sm text-gray-300">
                Private League (requires join code)
              </label>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4ade80] hover:bg-[#22c55e] text-gray-900 font-medium py-3 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create League"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}