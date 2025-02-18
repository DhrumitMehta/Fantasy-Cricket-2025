import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface Match {
  id: string;
  teams: string[];
  date: Date;
  venue: string;
  result?: string;
  scorecard_url: string;
}

interface PlayerPoints {
  matchId: string;
  playerName: string;
  team: string;
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
  potmPoints: number;
}

async function scrapeMatches(): Promise<Match[]> {
  const url = 'https://www.cricbuzz.com/cricket-series/9351/womens-premier-league-2025/matches';
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const matches: Match[] = [];

  // Similar to your existing scraping logic, but simplified for this example
  $('.cb-col-60.cb-col.cb-srs-mtchs-tm').each((_, elem) => {
    const matchId = $(elem).find('a').attr('href')?.split('/').pop() || '';
    const teams = $(elem).find('.text-hvr-underline').text().split(' vs ');
    // Add other match details extraction
    matches.push({
      id: matchId,
      teams,
      // ... other fields
    });
  });

  return matches;
}

async function calculatePlayerPoints(match: Match): Promise<PlayerPoints[]> {
  const { data } = await axios.get(match.scorecard_url);
  const $ = cheerio.load(data);
  const points: PlayerPoints[] = [];

  // Calculate points based on your scoring system
  // This is where you'll implement your fantasy points calculation logic
  
  return points;
}

async function main() {
  try {
    // 1. Scrape matches
    const matches = await scrapeMatches();

    // 2. Process each unprocessed match
    for (const match of matches) {
      // Check if match exists and is unprocessed
      const { data: existingMatch } = await supabase
        .from('matches')
        .select()
        .eq('id', match.id)
        .single();

      if (!existingMatch || !existingMatch.processed) {
        // Calculate points
        const playerPoints = await calculatePlayerPoints(match);

        // Insert/update match
        await supabase.from('matches').upsert({
          id: match.id,
          match_date: match.date,
          teams: match.teams,
          venue: match.venue,
          result: match.result,
          processed: true
        });

        // Insert player points
        if (playerPoints.length > 0) {
          await supabase.from('player_points').insert(
            playerPoints.map(p => ({
              match_id: match.id,
              player_name: p.playerName,
              team: p.team,
              batting_points: p.battingPoints,
              bowling_points: p.bowlingPoints,
              fielding_points: p.fieldingPoints,
              potm_points: p.potmPoints
            }))
          );
        }
      }
    }

    console.log('Scraping completed successfully');
  } catch (error) {
    console.error('Scraping failed:', error);
    process.exit(1);
  }
}

main(); 