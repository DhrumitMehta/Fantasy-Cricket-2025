import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';

// Load environment variables first
dotenv.config();

// Add console.log to debug environment variables
console.log('Environment variables:', {
  supabaseUrl: process.env.SUPABASE_URL,
  // Don't log the full service key for security
  hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
});

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Missing required environment variables SUPABASE_URL or SUPABASE_SERVICE_KEY');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Define the lookup dictionary
const playerLookup: Record<string, { playerId: string; playerName: string; teamName: string }> = {};

// Load players_with_prices.json and populate the lookup dictionary
async function loadPlayerData() {
    try {
        const playersFilePath = 'public/data/players_with_prices.json'; // Adjust path if needed
        const data = await fs.readFile(playersFilePath, 'utf-8');
        const playersData = JSON.parse(data);

        // Populate lookup dictionary
        playersData.forEach((player: any) => {
          // Store by Player Name (for name lookup)
          playerLookup[player["Player"]] = {
              playerId: player["Player ID"],
              playerName: player["Player"],
              teamName: player["Team Name"]
          };

          // Store by Player ID (for ID-based lookups)
          playerLookup[player["Player ID"]] = {
              playerId: player["Player ID"],
              playerName: player["Player"],
              teamName: player["Team Name"]
          };
        });


        console.log("Player data loaded successfully.");
    } catch (error) {
        console.error("Error loading player data:", error);
    }
}

interface Match {
  id: string;
  teams: string[];
  date: Date;
  venue: string;
  result?: string;
  scorecard_url: string;
}

interface PlayerPoints {
  match_id: string;
  player_id: string;
  batting_points: number;
  bowling_points: number;
  fielding_points: number;
  potm_points: number;
  player_name?: string;
  team_name?: string;
}

// Add these headers to both scraping functions
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
};

// Configure axios with retries
const axiosInstance = axios.create();
axiosInstance.interceptors.response.use(undefined, async (err) => {
  const { config, message } = err;
  if (!config || !config.retry) {
    return Promise.reject(err);
  }
  config.retry -= 1;
  const backoff = new Promise(resolve => setTimeout(resolve, config.retryDelay || 1000));
  await backoff;
  return axiosInstance(config);
});

interface PlayerData {
  playerId: string;
  // Batting stats
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  // Bowling stats
  overs: number;
  maidens: number;
  wickets: number;
  noBalls: number;
  wides: number;
  economy: number;
  runsConceded: number;
  dotBalls: number;
  // Fielding stats
  catches: number;
  stumpings: number;
  runOuts: number;
}

function createPlayerData(playerId: string): PlayerData {
  return {
    playerId,
    // Initialize all stats with 0
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    strikeRate: 0,
    overs: 0,
    maidens: 0,
    wickets: 0,
    noBalls: 0,
    wides: 0,
    economy: 0,
    runsConceded: 0,
    dotBalls: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0
  };
}

function toProperCase(name: string): string {
  return name
      .toLowerCase()
      .split(" ")
      .map(word =>
          word
              .split("-") // Split by hyphen
              .map(part => part.charAt(0).toUpperCase() + part.slice(1)) // Capitalize each part
              .join("-") // Rejoin with hyphen
      )
      .join(" ");
}

function generateNameVariations(fullName: string): string[] {
  const parts = fullName.split(" ");
  const initials = parts.map(word => word.charAt(0).toUpperCase());
  
  const variations = new Set<string>();

  if (parts.length > 1) {
      const lastName = parts[parts.length - 1]; // Last part is usually the surname
      const firstName = parts[0];

      variations.add(fullName); // Full name
      variations.add(`${initials[0]} ${lastName}`); // First initial + Last name
      variations.add(`${firstName} ${lastName}`); // First name + Last name
      variations.add(lastName); // Just the last name
      variations.add(firstName); // Just the first name
      variations.add(initials.join(" ")); // All initials
      variations.add(initials.join("") + lastName); // DWH format
  } else {
      variations.add(fullName); // Single name case
  }

  return Array.from(variations);
}

async function fetchWithRetry(url: string, maxRetries = 5, initialDelay = 1000): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'Host': 'www.cricbuzz.com'
  };

  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const delay = initialDelay * Math.pow(2, i); // Exponential backoff
      if (i > 0) {
        console.log(`Retry attempt ${i + 1} for ${url} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response received');
      }

      return text;
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${i + 1} failed:`, error.message);
      
      // If it's a DNS error, try with IP address as fallback
      if (error.code === 'ENOTFOUND') {
        try {
          const altUrl = url.replace('www.cricbuzz.com', '13.234.66.76');
          console.log(`Trying alternate URL: ${altUrl}`);
          const response = await fetch(altUrl, { headers });
          if (response.ok) {
            return await response.text();
          }
        } catch (altError: any) {
          console.error('Alternate URL failed:', altError.message);
        }
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

async function getBowlerDotBalls(matchId: string, playerId: string, inningsNo: string): Promise<number> {
  try {
    const url = `https://www.cricbuzz.com/player-match-highlights/${matchId}/${inningsNo}/${playerId}/bowling`;
    console.log(`Fetching dot balls from: ${url}`);
    
    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);
    
    let dotBallCount = 0;
    
    // Process each ball commentary
    $('.cb-com-ln').each((index, elem) => {
      const commentary = $(elem).text().trim();
      
      // Split the commentary at the first comma
      const [before, afterComma] = commentary.split(',');
      
      if (afterComma) {
        const nextWords = afterComma.trim().toLowerCase();
        // Check for dot ball conditions
        if (
          nextWords.startsWith('no run') ||
          nextWords.startsWith('out') ||
          nextWords.startsWith('byes') ||
          nextWords.startsWith('leg byes')
        ) {
          dotBallCount++;
          console.log(`Found dot ball: "${commentary}"`);
        }
      }
    });
    
    console.log(`Found ${dotBallCount} dot balls for player ${playerId}`);
    return dotBallCount;
  } catch (error) {
    console.error(`Error fetching dot balls for player ${playerId}:`, error);
    return 0;
  }
}

async function parseScorecard(matchId: string): Promise<{
  battingData: PlayerData[],
  bowlingData: PlayerData[],
  fieldingData: PlayerData[],
  dnbData: PlayerData[]
}> {
  try {
    const $ = cheerio.load(await fetchWithRetry(`https://www.cricbuzz.com/api/html/cricket-scorecard/${matchId}`));
    
    const battingData: PlayerData[] = [];
    const bowlingData: PlayerData[] = [];
    const fieldingData: PlayerData[] = [];
    const dnbData: PlayerData[] = [];
    let currentInnings = 0;

    // Process each innings
    for (const inningsElem of $('.cb-col.cb-col-100.cb-ltst-wgt-hdr').toArray()) {
      const inningsText = $(inningsElem).text();
      
      // Process batting data
      if (inningsText.includes('Batter') || inningsText.includes('Batsman')) {
        currentInnings++;

        $(inningsElem).find('.cb-col.cb-col-100.cb-scrd-itms').each((_, row) => {
          const cols = $(row).find('.cb-col');
          if (cols.length >= 7) {
            const playerLink = cols.eq(0).find('a').attr('href');
            if (!playerLink) return;
            
            const playerId = playerLink.split('/')[2];
            const runs = parseInt(cols.eq(2).text().trim()) || 0;
            const balls = parseInt(cols.eq(3).text().trim()) || 0;
            const fours = parseInt(cols.eq(4).text().trim()) || 0;
            const sixes = parseInt(cols.eq(5).text().trim()) || 0;
            const strikeRate = parseFloat(cols.eq(6).text().trim()) || 0;

            let player = battingData.find(p => p.playerId === playerId);

            if (player) {
              player.runs = runs;
              player.balls = balls;
              player.fours = fours;
              player.sixes = sixes;
              player.strikeRate = strikeRate;
            } else {
              player = createPlayerData(playerId);
              player.runs = runs;
              player.balls = balls;
              player.fours = fours;
              player.sixes = sixes;
              player.strikeRate = strikeRate;
              battingData.push(player);
            }
          }
        });
      }

      // Process bowling data
      if ($(inningsElem).find('.cb-scrd-sub-hdr').text().includes('Bowler')) {
        for (const row of $(inningsElem).find('.cb-col.cb-col-100.cb-scrd-itms').toArray()) {
          const cols = $(row).find('.cb-col');
          if (cols.length >= 8) {
            const playerLink = cols.eq(0).find('a').attr('href');
            if (!playerLink) continue;
            
            const playerId = playerLink.split('/')[2];
            const overs = parseFloat(cols.eq(1).text().trim()) || 0;
            const maidens = parseInt(cols.eq(2).text().trim()) || 0;
            const runs = parseInt(cols.eq(3).text().trim()) || 0;
            const wickets = parseInt(cols.eq(4).text().trim()) || 0;
            const noBalls = parseInt(cols.eq(5).text().trim()) || 0;
            const wides = parseInt(cols.eq(6).text().trim()) || 0;
            const economy = parseFloat(cols.eq(7).text().trim()) || 0;

            let player = bowlingData.find(p => p.playerId === playerId);

            if (!player) {
              player = createPlayerData(playerId);
              bowlingData.push(player);
            }
            
            player.overs = overs;
            player.maidens = maidens;
            player.wickets = wickets;
            player.noBalls = noBalls;
            player.wides = wides;
            player.economy = economy;
            player.runsConceded = runs;
            
            // Get dot balls
            const dotBalls = await getBowlerDotBalls(matchId, playerId, currentInnings.toString());
            player.dotBalls = dotBalls;
          }
        }
      }

      // Process fielding data
      $(inningsElem).find('.cb-col.cb-col-100.cb-scrd-itms').each((_, row) => {
        const cols = $(row).find('.cb-col');
        const dismissalText = cols.eq(1).text().trim().toLowerCase();
        
        if (!dismissalText || dismissalText === 'batter' || dismissalText === 'batsman') return;
        
        // Extract fielder name from dismissal text
        let fielderName = '';
        
        if (dismissalText.includes('c & b') || dismissalText.includes('c and b')) {
          // Caught and bowled - the bowler is the fielder
          fielderName = cols.eq(0).find('a').text().trim();
        } else if (dismissalText.includes('c ')) {
          // Regular catch - extract name after 'c '
          const match = dismissalText.match(/c\s+([\w\s-]+?)(?:\s+b|$)/);
          fielderName = match ? match[1].trim() : '';
        } else if (dismissalText.includes('st ')) {
          // Stumping - extract name after 'st '
          const match = dismissalText.match(/st\s+([\w\s]+?)(?:\s+b|$)/);
          fielderName = match ? match[1].trim() : '';
        } else if (dismissalText.includes('run out')) {
          // Run out - extract name in parentheses if present
          const match = dismissalText.match(/run out\s*\(([^)]+)\)/); 
          fielderName = match ? match[1].trim() : '';
        }

        if (!fielderName) {
          console.log(`Could not extract fielder name from dismissal: "${dismissalText}"`);
          return;
        }

        console.log(`Extracted fielder name: "${fielderName}" from dismissal: "${dismissalText}"`);

        // Convert fielder name to proper case
        fielderName = toProperCase(fielderName);

        // Generate possible name variations
        const nameVariations = generateNameVariations(fielderName);

        // Try to find a matching player ID
        let playerId = nameVariations
            .map(name => playerLookup[name]?.playerId)
            .find(id => id !== undefined) || fielderName; // If no match, keep name

        console.log(`Mapped fielder name: "${fielderName}" → Player ID: "${playerId}"`);

        // Find or create the fielder entry
        let player = fieldingData.find(p => p.playerId === playerId);
        if (!player) {
            player = createPlayerData(playerId);
            fieldingData.push(player);
        }
        
        // Process catches
        if (dismissalText.includes('c ') || dismissalText.includes('c&b')) {
          player.catches++;
          console.log(`Added catch for ${fielderName}`);
        }
        
        // Process stumpings
        if (dismissalText.includes('st ')) {
          player.stumpings++;
          console.log(`Added stumping for ${fielderName}`);
        }
        
        // Process run outs
        if (dismissalText.includes('run out')) {
          player.runOuts++;
          console.log(`Added run out for ${fielderName}`);
        }
      });
    }

    return {
      battingData,
      bowlingData,
      fieldingData,
      dnbData
    };
  } catch (error) {
    console.error('Error parsing scorecard:', error);
    return {
      battingData: [],
      bowlingData: [],
      fieldingData: [],
      dnbData: []
    };
  }
}

// Add this interface
interface POTM {
  match_id: string;
  player_id: string;
}

async function extractPOTM(matchUrl: string): Promise<POTM | null> {
  try {
    const matchIdMatch = matchUrl.match(/\/(?:live-cricket-scorecard|cricket-scores)\/(\d+)\//);
    const matchId = matchIdMatch ? matchIdMatch[1] : null;

    if (!matchId) {
      console.error('Could not extract match ID from URL:', matchUrl);
      return null;
    }

    const url = `https://www.cricbuzz.com/cricket-scores/${matchId}`;
    console.log('Fetching POTM from:', url);
    
    const response = await fetch(url, { headers });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Select the POTM container
    const potmDiv = $('.cb-mom-itm, .cb-mom-item, .cb-mat-mop-itm');
    
    if (potmDiv.length) {
      const playerLink = potmDiv.find('a'); // Select the <a> tag
      if (playerLink.length) {
        const playerHref = playerLink.attr('href') || '';
        
        // Extract the numeric player ID from the href (e.g., "/profiles/16208/richa-ghosh")
        const playerIdMatch = playerHref.match(/\/profiles\/(\d+)\//);
        const playerId = playerIdMatch ? playerIdMatch[1] : '';

        if (playerId) {
          return {
            match_id: matchId,
            player_id: playerId
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching POTM data from ${matchUrl}:`, error);
    return null;
  }
}

function mergePlayerStats(battingData: PlayerData[], bowlingData: PlayerData[], fieldingData: PlayerData[], dnbData: PlayerData[]): PlayerData[] {
  const mergedPlayers: { [key: string]: PlayerData } = {};

  const mergePlayer = (player: PlayerData) => {
    if (!mergedPlayers[player.playerId]) {
      mergedPlayers[player.playerId] = createPlayerData(player.playerId);
    }

    const existing = mergedPlayers[player.playerId];

    // Merge batting stats (only if they exist)
    if (player.runs > 0 || player.balls > 0) {
      existing.runs = player.runs;
      existing.balls = player.balls;
      existing.fours = player.fours;
      existing.sixes = player.sixes;
      existing.strikeRate = player.strikeRate;
    }

    // Merge bowling stats (only if they exist)
    if (player.overs > 0) {
      existing.overs = player.overs;
      existing.maidens = player.maidens;
      existing.wickets = player.wickets;
      existing.runsConceded = player.runsConceded;
      existing.economy = player.economy;
      existing.wides = player.wides;
      existing.noBalls = player.noBalls;
      existing.dotBalls = player.dotBalls;
    }

    // Merge fielding stats
    if (player.catches > 0 || player.stumpings > 0 || player.runOuts > 0) {
      existing.catches = player.catches;
      existing.stumpings = player.stumpings;
      existing.runOuts = player.runOuts;
    }
  };

  [...battingData, ...bowlingData, ...fieldingData, ...dnbData].forEach(mergePlayer);

  return Object.values(mergedPlayers);
}

function calculatePoints(playerData: PlayerData): {
  battingPoints: number;
  bowlingPoints: number;
  fieldingPoints: number;
} {
  const points = {
    battingPoints: 0,
    bowlingPoints: 0,
    fieldingPoints: 0
  };

  // Batting Points
  if (playerData.runs !== undefined) {
    // Base points (1 point per run)
    points.battingPoints += playerData.runs;
    
    // Boundary bonus
    points.battingPoints += (playerData.fours || 0);
    points.battingPoints += (playerData.sixes || 0) * 2;
    
    // Milestone bonus (10 points for every 25 runs)
    points.battingPoints += Math.floor(playerData.runs / 25) * 10;
    
    // Strike Rate bonus/penalty
    if (playerData.balls && playerData.balls >= 10) {
      const strikeRate = (playerData.runs / playerData.balls) * 100;
      if (strikeRate < 50) points.battingPoints -= 15;
      else if (strikeRate < 75) points.battingPoints -= 10;
      else if (strikeRate < 100) points.battingPoints -= 5;
      else if (strikeRate >= 125 && strikeRate < 150) points.battingPoints += 5;
      else if (strikeRate >= 150 && strikeRate < 200) points.battingPoints += 10;
      else if (strikeRate >= 200) points.battingPoints += 15;
    }
  }

  // Bowling Points
  if (playerData.wickets !== undefined) {
    // Base points (20 points per wicket)
    points.bowlingPoints += playerData.wickets * 20;
    
    // Wicket bonus (10 points for each wicket after first)
    if (playerData.wickets > 1) {
      points.bowlingPoints += (playerData.wickets - 1) * 10;
    }
    
    // Maiden over points (20 points per maiden)
    points.bowlingPoints += (playerData.maidens || 0) * 20;
    
    // Dot ball points (2 points per dot ball)
    points.bowlingPoints += (playerData.dotBalls || 0) * 2;
    
    // Economy rate bonus/penalty
    if (playerData.overs && playerData.overs >= 1) {
      const economy = playerData.runsConceded / playerData.overs;
      if (economy < 5.01) points.bowlingPoints += 20;
      else if (economy < 6.01) points.bowlingPoints += 15;
      else if (economy < 7.01) points.bowlingPoints += 10;
      else if (economy < 8.01) points.bowlingPoints += 5;
      else if (economy >= 9.01 && economy < 10.01) points.bowlingPoints -= 5;
      else if (economy >= 10.01 && economy < 12.01) points.bowlingPoints -= 10;
      else if (economy >= 12.01) points.bowlingPoints -= 20;
    }
    
    // Penalties for extras
    points.bowlingPoints -= Math.floor((playerData.wides || 0) / 2);
    points.bowlingPoints -= (playerData.noBalls || 0) * 2;
  }

  // Fielding Points
  points.fieldingPoints = (playerData.catches || 0) * 10 +
                         (playerData.stumpings || 0) * 10 +
                         (playerData.runOuts || 0) * 10;

  return points;
}

function calculateAllPlayerPoints(players: PlayerData[], potm: POTM | null): PlayerPoints[] {
  return players.map(player => {
    const points = calculatePoints(player);
    return {
      match_id: potm?.match_id || '',
      player_id: player.playerId,
      batting_points: points.battingPoints,
      bowling_points: points.bowlingPoints,
      fielding_points: points.fieldingPoints,
      potm_points: potm?.player_id === player.playerId ? 50 : 0
    };
  });
}

async function scrapeMatches(): Promise<Match[]> {
  console.log('Starting to scrape matches...');
  const url = 'https://www.cricbuzz.com/cricket-series/9351/womens-premier-league-2025/matches';
  console.log('Fetching from URL:', url);
  
  const response = await fetch(url, { headers });
  const html = await response.text();
  console.log('Successfully fetched page');
  
  const $ = cheerio.load(html);
  const matches: Match[] = [];
  
  // Find all match elements
  const matchElements = $('.cb-col-100.cb-col.cb-series-matches');
  console.log(`Found ${matchElements.length} match elements\n`);
  
  matchElements.each((index, element) => {
    console.log(`Processing match ${index + 1}`);
    
    // Get the match URL - look for the link in the correct location
    const matchUrl = $(element).find('a.text-hvr-underline').attr('href');
    console.log('Match URL:', matchUrl);
    
    if (!matchUrl) {
      console.log('Skipping match - no URL found');
      return;
    }

    // Extract match ID from URL
    const matchId = matchUrl.split('/')[2];
    
    // Get teams
    const teamsText = $(element).find('a.text-hvr-underline span').text();
    const teams = teamsText.split(' vs ');
    
    // Get venue
    const venue = $(element).find('.text-gray').first().text();
    
    // Get result
    const result = $(element).find('.cb-text-complete').text();
    
    // Get the date from the timestamp in the HTML
    const scheduleDate = $(element).closest('.cb-col-100').find('.schedule-date[timestamp]');
    const timestampAttr = scheduleDate.attr('timestamp');
    const timeText = scheduleDate.text().trim();

    let date = new Date();

    if (timestampAttr) {
      try {
        // Convert timestamp to number and create Date object
        const timestamp = parseInt(timestampAttr);
        date = new Date(timestamp);
        
        console.log('Date parsing details:', {
          rawTimestamp: timestampAttr,
          parsedTimestamp: timestamp,
          dateText: timeText,
          resultDate: date.toISOString(),
          resultLocal: date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
        });

      } catch (error) {
        console.error('Error parsing date:', error);
        console.error('Raw timestamp:', timestampAttr);
        console.error('Time text:', timeText);
      }
    }
    
    const match: Match = {
      id: matchId,
      teams,
      date,
      venue,
      result,
      scorecard_url: `https://www.cricbuzz.com${matchUrl}`
    };
    
    console.log(match);
    console.log();  // Empty line for readability
    
    matches.push(match);
  });

  console.log(`Total matches found: ${matches.length}`);
  return matches;
}

async function updatePlayerData(playerPoints: PlayerPoints[]): Promise<PlayerPoints[]> {
  return playerPoints.map(player => {
      const playerIdStr = String(player.player_id); // Convert ID to string
      const lookupData = playerLookup[playerIdStr] || playerLookup[player.player_id] || null;

      return {
          ...player,
          player_name: lookupData ? lookupData.playerName : "Unknown",
          team_name: lookupData ? lookupData.teamName : "Unknown"
      };
  });
}

// Example function to process match data and apply player name mapping
async function processMatchData(matchData: PlayerPoints[]) {
  const updatedData = await updatePlayerData(matchData);
  console.log("Updated Match Data:", updatedData);
  return updatedData;
}

// Update displayPointsTable function to include POTM points
function displayPointsTable(playerPoints: PlayerPoints[]): void {
  console.log('\n=== FINAL POINTS TABLE ===');
  console.log('╔════╤══════════════════════════════╤══════════════════════════════╤════════╤════════╤════════╤════════╤═════════╗');
  console.log('║ #  │ Player                       │ Team                         │   Bat  │  Bowl  │ Field  │  POTM  │  Total  ║');
  console.log('╟────┼──────────────────────────────┼──────────────────────────────┼────────┼────────┼────────┼────────┼─────────╢');

  const sortedPoints = playerPoints
    .filter(p => p.batting_points + p.bowling_points + p.fielding_points + (p.potm_points || 0) > 0)
    .sort((a, b) => {
      const totalA = a.batting_points + a.bowling_points + a.fielding_points + (a.potm_points || 0);
      const totalB = b.batting_points + b.bowling_points + b.fielding_points + (b.potm_points || 0);
      return totalB - totalA;
    });

  sortedPoints.forEach((player, index) => {
    const rank = (index + 1).toString().padStart(2);
    const id = player.player_id.padEnd(26);
    const batting = player.batting_points.toString().padStart(6);
    const bowling = player.bowling_points.toString().padStart(6);
    const fielding = player.fielding_points.toString().padStart(6);
    const potm = (player.potm_points || 0).toString().padStart(6);
    const total = (player.batting_points + player.bowling_points + player.fielding_points + (player.potm_points || 0)).toString().padStart(7);

    console.log(`║ ${rank} │ ${id} │ │ ${batting} │ ${bowling} │ ${fielding} │ ${potm} │ ${total} ║`);
  });
}

async function exportPointsTable(points: PlayerPoints[]): Promise<void> {
  try {
    // Filter out non-player entries and include only players with actual points
    const tablePoints = points
      .filter(player => {
        // Exclude special rows like "Extras", "Total", "Did Not Bat"
        const excludedNames = ["Extras", "Total", "Did Not Bat"];
        return !excludedNames.includes(player.player_id);
      })
      .map(player => ({
        match_id: player.match_id,
        player_id: player.player_id,
        batting_points: player.batting_points,
        bowling_points: player.bowling_points,
        fielding_points: player.fielding_points,
        potm_points: player.potm_points || 0
      }));

    // Log points for verification
    console.log('\nPoints to be saved to database:');
    tablePoints.forEach(player => {
      const total = player.batting_points + player.bowling_points + 
                   player.fielding_points + player.potm_points;
      console.log(
        `${player.player_id}: ` +
        `Match ID: ${player.match_id}, ` +
        `Bat=${player.batting_points} Bowl=${player.bowling_points} ` +
        `Field=${player.fielding_points} POTM=${player.potm_points} ` +
        `Total=${total}`
      );
    });

    // Save to database
    console.log('\nSaving points table to database...');
    const { data, error } = await supabase
      .from('player_points')
      .insert(tablePoints)
      .select();

    if (error) {
      throw error;
    }

    console.log(`Successfully saved ${tablePoints.length} player points records to database`);
  } catch (error) {
    console.error('Error saving points table:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('Starting scraper...');

    // Call the function to populate the lookup
    loadPlayerData();
    
    const matches = await scrapeMatches();
    console.log(`Found ${matches.length} matches to process`);

    const matchesToProcess = matches.slice(0, 1);

    for (const match of matchesToProcess) {
      console.log(`\n=== Processing match ID: ${match.id} ===`);
      console.log(`${match.teams[0]} vs ${match.teams[1]}`);
      
      const potm = await extractPOTM(match.scorecard_url);

      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        console.log(`Processing scorecard for match ${match.id}...`);
        const {
          battingData,
          bowlingData,
          fieldingData,
          dnbData
        } = await parseScorecard(match.id);

        const mergedPlayers = mergePlayerStats(battingData, bowlingData, fieldingData, dnbData);
        const playerPoints = calculateAllPlayerPoints(mergedPlayers, potm);
        processMatchData(playerPoints);

        console.log(`Successfully processed match ${match.id}`);
        //await exportPointsTable(playerPoints);
        displayPointsTable(playerPoints);

      } catch (error) {
        console.error(`Error processing match ${match.id}:`, error);
        continue;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\nFinished processing all matches');
  } catch (error) {
    console.error('Error in main process:', error);
    throw error;
  }
}

main();