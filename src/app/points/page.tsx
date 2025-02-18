'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Points() {
    const [teamPoints, setTeamPoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPoints = async () => {
            try {
                const { data: matches, error } = await supabase
                    .from('matches')
                    .select(`
                        id,
                        match_date,
                        teams,
                        player_points (
                            player_name,
                            team,
                            batting_points,
                            bowling_points,
                            fielding_points,
                            potm_points,
                            total_points
                        )
                    `)
                    .order('match_date', { ascending: false });

                if (error) throw error;

                setTeamPoints(matches.map(match => ({
                    matchId: match.id,
                    date: match.match_date,
                    totalPoints: match.player_points.reduce((sum, p) => sum + p.total_points, 0),
                    players: match.player_points
                })));
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load points');
            } finally {
                setLoading(false);
            }
        };

        fetchPoints();
    }, []);

    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Points</h1>
        <p>This page will display fantasy points for the current matchday.</p>
      </div>
    );
  }
  