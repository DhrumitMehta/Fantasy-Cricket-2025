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
  player_name: string;
  team: string;
  batting_points: number;
  bowling_points: number;
  fielding_points: number;
  potm_points: number;
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
  fullName: string;
  shortName: string;
  playerId?: string | null; 
  team: string;
  matchId: string;
  innings: number;
  // Batting stats
  battingRuns?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  strikeRate?: number;
  // Bowling stats
  overs?: number;
  maidens?: number;
  wickets?: number;
  runsConceded?: number;
  noBalls?: number;
  wides?: number;
  economy?: number;
  // Fielding stats
  catches: number;
  stumpings: number;
  runOuts: number;
  dotBalls?: number;
}

interface NameMapping {
  [key: string]: string;
}

function createNameVariations(name: string): Set<string> {
  const variations = new Set<string>();
  name = name.trim();
  variations.add(name);  // Original name
  
  const parts = name.split(' ');
  
  if (parts.length > 1) {
    // Last name only
    variations.add(parts[parts.length - 1]);
    
    // First letter of first name + last name
    variations.add(`${parts[0][0]} ${parts[parts.length - 1]}`);
    
    // First name + last name (for cases with middle names)
    variations.add(`${parts[0]} ${parts[parts.length - 1]}`);
    
    // Handle initials
    if (parts.some(part => part.includes('.'))) {
      // Remove dots from initials
      const noDots = parts.map(part => part.replace('.', '')).join(' ');
      variations.add(noDots);
    }
  }
  
  return variations;
}

function cleanPlayerName(name: string): string {
  return name
    // Remove content in brackets and parentheses
    .replace(/[\(\[].*?[\)\]]/g, '')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Trim spaces from start and end
    .trim()
    // Apply proper case
    .split(' ')
    .map(word => {
      // Handle hyphenated names
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function createNameMapping(players: PlayerData[]): NameMapping {
  const mapping: NameMapping = {};
  
  players.forEach(player => {
    const cleanedName = cleanPlayerName(player.shortName);
    const shortNameVariations = createNameVariations(cleanedName);
    const fullNameVariations = createNameVariations(cleanPlayerName(player.fullName));
    
    // Combine all variations
    const allVariations = new Set([...shortNameVariations, ...fullNameVariations]);
    
    // Add all variations to mapping
    allVariations.forEach(variation => {
      mapping[variation.toLowerCase()] = cleanedName;
    });
  });

  return mapping;
}

async function fetchWithRetry(matchId: string): Promise<string> {
  const apiUrl = `https://www.cricbuzz.com/api/html/cricket-scorecard/${matchId}`;
  const config = {
    retry: 5,
    retryDelay: 2000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  };
  
  try {
    console.log(`Fetching scorecard from: ${apiUrl}`);
    const response = await axiosInstance.get(apiUrl, config);
    return response.data;
  } catch (error) {
    console.error(`Error fetching scorecard for match ${matchId}:`, error);
    throw error;
  }
}

async function fetchPlayerFullName(playerUrl: string): Promise<string> {
  try {
    const html = await fetchWithRetry(`https://www.cricbuzz.com${playerUrl}`);
    const $ = cheerio.load(html);
    const nameElement = $('h1.cb-font-40');
    return nameElement.text().trim() || 'N/A';
  } catch (error) {
    console.error(`Error fetching player name from ${playerUrl}:`, error);
    return 'N/A';
  }
}

async function parseScorecard(html: string, matchId: string): Promise<{
  battingData: PlayerData[],
  bowlingData: PlayerData[],
  fieldingData: PlayerData[],
  dnbData: PlayerData[]
}> {
  // Load players data from JSON file
  let playersData = JSON.parse(await fs.readFile('public/data/players_with_prices.json', 'utf8'));
  const playerMap = new Map(playersData.map((p: PlayerWithPrice) => [p['Player ID'], p.Player]));
  const newPlayers = new Set(); // To track new players we find

  const $ = cheerio.load(html);
  const battingData: PlayerData[] = [];
  const bowlingData: PlayerData[] = [];
  const fieldingData: PlayerData[] = [];
  const dnbData: PlayerData[] = [];
  let currentInnings = 0;

  // Get team names first
  const teamNames: string[] = [];
  $('.cb-col.cb-col-100.cb-scrd-hdr-rw').each((_, elem) => {
    const teamName = $(elem).text().split('Innings')[0].trim();
    if (teamName) teamNames.push(teamName);
  });

  // First pass: Collect batting and bowling data
  $('.cb-col.cb-col-100.cb-ltst-wgt-hdr').each((_, inningsElem) => {
    const inningsText = $(inningsElem).text();
    
    if (inningsText.includes('Batter') || inningsText.includes('Batsman')) {
      currentInnings++;
      const currentBattingTeam = teamNames[currentInnings - 1];
      const currentBowlingTeam = teamNames[currentInnings % 2];

      // Process batting data
      $(inningsElem).find('.cb-col.cb-col-100.cb-scrd-itms').each((_, row) => {
        const cols = $(row).find('.cb-col');
        const playerLink = cols.eq(0).find('a');
        const shortName = playerLink.text().trim();
        
        if (!shortName || shortName === 'Batter' || shortName === 'Batsman') return;

        // Extract player ID from hyperlink
        const href = playerLink.attr('href');
        const playerId = href ? href.split('/')[2] : null;
        
        // Get full name from our JSON data
        const fullName = playerId ? (playerMap.get(playerId) || shortName) : shortName;
        
        console.log(`Batting - ID: ${playerId}, Short: ${shortName}, Full: ${fullName}`);
        
        battingData.push({
            fullName: cleanPlayerName(fullName as string),
            shortName: cleanPlayerName(shortName),
            playerId,
            team: currentBattingTeam,
            matchId,
            innings: currentInnings,
            battingRuns: parseInt(cols.eq(2).text()) || 0,
            balls: parseInt(cols.eq(3).text()) || 0,
            fours: parseInt(cols.eq(4).text()) || 0,
            sixes: parseInt(cols.eq(5).text()) || 0,
            strikeRate: parseFloat(cols.eq(6).text()) || 0,
            catches: 0,
            stumpings: 0,
            runOuts: 0
        });
      });

      // Process bowling data
      if (inningsText.includes('Bowler')) {
        $(inningsElem).find('.cb-col.cb-col-100.cb-scrd-itms').each((_, row) => {
          const cols = $(row).find('.cb-col');
          const playerLink = cols.eq(0).find('a');
          const shortName = playerLink.text().trim();
          
          if (!shortName || shortName === 'Bowler' || cols.length < 8) return;
          
          const overs = cols.eq(1).text().trim();
          if (!overs) return;

          // Extract player ID from hyperlink
          const href = playerLink.attr('href');
          const playerId = href ? href.split('/')[2] : null;
          
          // Get full name from our JSON data or use short name
          const fullName = playerId ? (playerMap.get(playerId) || shortName) : shortName;
          
          // If this is a new player (has ID but not in our map), add to new players set
          if (playerId && !playerMap.has(playerId)) {
            newPlayers.add({
              'Player ID': playerId,
              'Player': shortName,
              // Add other required fields from your players_with_prices.json structure
            });
          }

          console.log(`Processing bowler - ID: ${playerId}, Short: ${shortName}, Full: ${fullName}`);
          console.log('Raw bowling stats:', {
            overs: cols.eq(1).text(),
            maidens: cols.eq(2).text(),
            runs: cols.eq(3).text(),
            wickets: cols.eq(4).text(),
            noBalls: cols.eq(5).text(),
            wides: cols.eq(6).text(),
            economy: cols.eq(7).text()
          });

          bowlingData.push({
            fullName: cleanPlayerName(fullName as string),
            shortName: cleanPlayerName(shortName),
            team: currentBowlingTeam,
            matchId,
            innings: currentInnings,
            overs: parseFloat(cols.eq(1).text()) || 0,
            maidens: parseInt(cols.eq(2).text()) || 0,
            runsConceded: parseInt(cols.eq(3).text()) || 0,
            wickets: parseInt(cols.eq(4).text()) || 0,
            noBalls: parseInt(cols.eq(5).text()) || 0,
            wides: parseInt(cols.eq(6).text()) || 0,
            economy: parseFloat(cols.eq(7).text()) || 0,
            catches: 0,
            stumpings: 0,
            runOuts: 0,
            playerId: playerId
          });
        });
      }

      // Process DNB players
      $(inningsElem).find('div:contains("Did not Bat")').each((_, dnbElem) => {
        const dnbText = $(dnbElem).text().replace('Did not Bat:', '').trim();
        dnbText.split(',').map(name => name.trim()).forEach(playerName => {
          if (playerName) {
            dnbData.push({
              fullName: cleanPlayerName(playerName),
              shortName: cleanPlayerName(playerName),
              team: currentBattingTeam,
              matchId,
              innings: currentInnings,
              catches: 0,
              stumpings: 0,
              runOuts: 0
            });
          }
        });
      });
    }
  });

  // Create name mapping
  const allPlayers = [...battingData, ...bowlingData, ...dnbData];
  const nameMapping = createNameMapping(allPlayers);

  // Second pass: Process fielding data
  currentInnings = 0;
  $('.cb-col.cb-col-100.cb-ltst-wgt-hdr').each((_, inningsElem) => {
    if ($(inningsElem).text().includes('Batter') || $(inningsElem).text().includes('Batsman')) {
      currentInnings++;
      const currentBowlingTeam = teamNames[currentInnings % 2];

      $(inningsElem).find('.cb-col.cb-col-100.cb-scrd-itms').each((_, row) => {
        const dismissalInfo = $(row).find('.cb-col').eq(1).text().trim();
        if (dismissalInfo) {
          updateFieldingStats(dismissalInfo, fieldingData, matchId, currentBowlingTeam, nameMapping);
        }
      });
    }
  });

  // At the end of the function, save any new players we found
  if (newPlayers.size > 0) {
    console.log('Found new players:', newPlayers);
    playersData = [...playersData, ...Array.from(newPlayers)];
    await fs.writeFile(
      'public/data/players_with_prices.json',
      JSON.stringify(playersData, null, 2)
    );
  }

  return {
    battingData,
    bowlingData,
    fieldingData,
    dnbData
  };
}

function properCase(name: string): string {
  return name
    .split(' ')
    .map(word => {
      // Handle hyphenated names
      if (word.includes('-')) {
        return word
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join('-');
      }
      // Handle regular names
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function updateFieldingStats(dismissalInfo: string, fieldingData: PlayerData[], matchId: string, team: string, nameMapping: NameMapping): void {
  dismissalInfo = dismissalInfo.toLowerCase();
  
  // Handle caught & bowled
  if (dismissalInfo.includes('c & b')) {
    const fielder = dismissalInfo.split('c & b')[1].trim();
    const mappedName = nameMapping[fielder.toLowerCase()] || properCase(fielder);
    addFieldingContribution(fieldingData, mappedName, 'catch', matchId, team);
  } else {
    // Handle regular catches
    const catchMatch = dismissalInfo.match(/c (.*?)\s+(?=b\s+)/);
    if (catchMatch) {
      const fielder = catchMatch[1].trim();
      const mappedName = nameMapping[fielder.toLowerCase()] || properCase(fielder);
      addFieldingContribution(fieldingData, mappedName, 'catch', matchId, team);
    }
  }

  // Handle stumpings
  const stumpMatch = dismissalInfo.match(/st (\w+ \w+)/);
  if (stumpMatch) {
    const fielder = stumpMatch[1].trim();
    const mappedName = nameMapping[fielder.toLowerCase()] || properCase(fielder);
    addFieldingContribution(fieldingData, mappedName, 'stumping', matchId, team);
  }

  // Handle run outs
  const runOutMatch = dismissalInfo.match(/run out \(([\w\s/]+)\)/);
  if (runOutMatch) {
    const fielders = runOutMatch[1].split('/').map(f => f.trim());
    fielders.forEach(fielder => {
      const mappedName = nameMapping[fielder.toLowerCase()] || properCase(fielder);
      addFieldingContribution(fieldingData, mappedName, 'runOut', matchId, team);
    });
  }
}

function addFieldingContribution(
  fieldingData: PlayerData[], 
  playerName: string, 
  type: 'catch' | 'stumping' | 'runOut',
  matchId: string,
  team: string
): void {
  // Clean and proper case the player name
  playerName = cleanPlayerName(playerName);

  let player = fieldingData.find(p => 
    p.fullName.toLowerCase() === playerName.toLowerCase() || 
    p.shortName.toLowerCase() === playerName.toLowerCase()
  );
  
  if (!player) {
    player = {
      fullName: playerName,
      shortName: playerName,
      team,
      matchId,
      innings: 0,
      catches: 0,
      stumpings: 0,
      runOuts: 0
    };
    fieldingData.push(player);
  }

  switch (type) {
    case 'catch':
      player.catches++;
      break;
    case 'stumping':
      player.stumpings++;
      break;
    case 'runOut':
      player.runOuts++;
      break;
  }
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

// Helper functions for point calculations
function calculateSRPoints(runs: number, balls: number, strikeRate: number): number {
  if (balls < 10) return 0;
  
  if (strikeRate < 50) return -15;
  if (strikeRate < 75) return -10;
  if (strikeRate < 100) return -5;
  if (strikeRate < 125) return 0;
  if (strikeRate < 150) return 5;
  if (strikeRate < 200) return 10;
  return 15;
}

function calculateBonusPoints(runs: number): number {
  return Math.floor(runs / 25) * 10;
}

function calculateEconomyPoints(overs: number, economy: number): number {
  if (overs < 1) return 0;
  
  if (economy < 5.01) return 20;
  if (economy < 6.01) return 15;
  if (economy < 7.01) return 10;
  if (economy < 8.01) return 5;
  if (economy < 9.01) return 0;
  if (economy < 10.01) return -5;
  if (economy < 12.01) return -10;
  return -20;
}

function calculateWicketBonus(wickets: number): number {
  return Math.max(0, (wickets - 1) * 10);
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
  if (playerData.battingRuns !== undefined) {
    console.log(`\nCalculating batting points for ${playerData.fullName}:`);
    
    // 1. Base points (1 point per run)
    points.battingPoints += playerData.battingRuns;
    console.log(`Base points for ${playerData.battingRuns} runs: ${playerData.battingRuns}`);
    
    // 2. Boundary bonus
    const fourPoints = (playerData.fours || 0);
    const sixPoints = (playerData.sixes || 0) * 2;
    points.battingPoints += fourPoints + sixPoints;
    console.log(`Boundary bonus - Fours: ${playerData.fours || 0} × 1 = ${fourPoints}`);
    console.log(`Boundary bonus - Sixes: ${playerData.sixes || 0} × 2 = ${sixPoints}`);
    
    // 3. Milestone bonus (10 points for every 25 runs)
    const milestoneBonus = Math.floor(playerData.battingRuns / 25) * 10;
    points.battingPoints += milestoneBonus;
    console.log(`Milestone bonus (${Math.floor(playerData.battingRuns / 25)} × 10): ${milestoneBonus}`);
    
    // 4. Strike Rate bonus/penalty
    if (playerData.balls && playerData.balls >= 10) {
      const strikeRate = (playerData.battingRuns / playerData.balls) * 100;
      let srBonus = 0;
      
      if (strikeRate < 50) srBonus = -15;
      else if (strikeRate < 75) srBonus = -10;
      else if (strikeRate < 100) srBonus = -5;
      else if (strikeRate < 125) srBonus = 0;
      else if (strikeRate < 150) srBonus = 5;
      else if (strikeRate < 200) srBonus = 10;
      else srBonus = 15;
      
      points.battingPoints += srBonus;
      console.log(`Strike Rate ${strikeRate.toFixed(2)} bonus/penalty: ${srBonus}`);
    } else {
      console.log('No Strike Rate bonus/penalty (less than 10 balls faced)');
    }

    console.log(`Total batting points: ${points.battingPoints}`);
  }

  // Bowling Points
  if (playerData.wickets !== undefined) {
    console.log(`\nCalculating bowling points for ${playerData.fullName}:`);
    
    // 1. Base points (20 points per wicket)
    const wicketPoints = playerData.wickets * 20;
    points.bowlingPoints += wicketPoints;
    console.log(`Base points for ${playerData.wickets} wickets: ${wicketPoints}`);
    
    // 2. Wicket bonus (10 points for each wicket after first)
    let wicketBonus = 0;
    if (playerData.wickets > 1) {
      wicketBonus = (playerData.wickets - 1) * 10;
      points.bowlingPoints += wicketBonus;
      console.log(`Wicket bonus (${playerData.wickets - 1} additional wickets × 10): ${wicketBonus}`);
    }
    
    // 3. Maiden over points (20 points per maiden)
    const maidenPoints = (playerData.maidens || 0) * 20;
    points.bowlingPoints += maidenPoints;
    console.log(`Maiden over points (${playerData.maidens || 0} maidens × 20): ${maidenPoints}`);
    
    // 4. Dot ball points (2 points per dot ball)
    const dotBallPoints = (playerData.dotBalls || 0) * 2;
    points.bowlingPoints += dotBallPoints;
    console.log(`Dot ball points (${playerData.dotBalls || 0} dot balls × 2): ${dotBallPoints}`);
    
    // 5. Economy rate bonus/penalty
    let economyPoints = 0;
    if (playerData.overs && playerData.overs >= 1) {
      const economy = (playerData.runsConceded || 0) / playerData.overs;
      if (economy < 5.01) economyPoints = 20;
      else if (economy < 6.01) economyPoints = 15;
      else if (economy < 7.01) economyPoints = 10;
      else if (economy < 8.01) economyPoints = 5;
      else if (economy < 9.01) economyPoints = 0;
      else if (economy < 10.01) economyPoints = -5;
      else if (economy < 12.01) economyPoints = -10;
      else economyPoints = -20;
      
      points.bowlingPoints += economyPoints;
      console.log(`Economy rate ${economy.toFixed(2)} bonus/penalty: ${economyPoints}`);
    } else {
      console.log('No economy rate bonus/penalty (less than 1 over bowled)');
    }
    
    // 6. Penalties for extras
    let extrasPenalty = 0;
    if (playerData.wides) {
      const widesPenalty = -Math.floor(playerData.wides / 2);
      extrasPenalty += widesPenalty;
      console.log(`Wides penalty (${playerData.wides} wides): ${widesPenalty}`);
    }
    if (playerData.noBalls) {
      const noBallsPenalty = -playerData.noBalls * 2;
      extrasPenalty += noBallsPenalty;
      console.log(`No balls penalty (${playerData.noBalls} no balls × -2): ${noBallsPenalty}`);
    }
    points.bowlingPoints += extrasPenalty;

    console.log(`Total bowling points: ${points.bowlingPoints}`);
  }

  // Fielding Points (10 points each for catch/stumping/run-out)
  points.fieldingPoints = (playerData.catches || 0) * 10 +
                         (playerData.stumpings || 0) * 10 +
                         (playerData.runOuts || 0) * 10;

  return points;
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
    const name = player.player_name.padEnd(26);
    const team = player.team.padEnd(26);
    const batting = player.batting_points.toString().padStart(6);
    const bowling = player.bowling_points.toString().padStart(6);
    const fielding = player.fielding_points.toString().padStart(6);
    const potm = (player.potm_points || 0).toString().padStart(6);
    const total = (player.batting_points + player.bowling_points + player.fielding_points + (player.potm_points || 0)).toString().padStart(7);

    console.log(`║ ${rank} │ ${name} │ ${team} │ ${batting} │ ${bowling} │ ${fielding} │ ${potm} │ ${total} ║`);
  });

  console.log('╚════╧══════════════════════════════╧══════════════════════════════╧════════╧════════╧════════╧════════╧═════════╝');

  // Display team totals
  const teamTotals = sortedPoints.reduce((acc: { [key: string]: { batting: number, bowling: number, fielding: number } }, player) => {
    const team = player.team;
    if (!acc[team]) {
      acc[team] = {
        batting: 0,
        bowling: 0,
        fielding: 0
      };
    }
    acc[team].batting += player.batting_points;
    acc[team].bowling += player.bowling_points;
    acc[team].fielding += player.fielding_points;
    return acc;
  }, {});

  console.log('\n=== TEAM TOTALS ===');
  console.log('╔══════════════════════════════╤════════╤════════╤════════╤═════════╗');
  console.log('║ Team                         │   Bat  │  Bowl  │ Field  │  Total  ║');
  console.log('╟──────────────────────────────┼────────┼────────┼────────┼─────────╢');

  Object.entries(teamTotals).forEach(([team, points]: [string, any]) => {
    const teamName = team.padEnd(26);
    const batting = points.batting.toString().padStart(6);
    const bowling = points.bowling.toString().padStart(6);
    const fielding = points.fielding.toString().padStart(6);
    const total = (points.batting + points.bowling + points.fielding).toString().padStart(7);

    console.log(`║ ${teamName} │ ${batting} │ ${bowling} │ ${fielding} │ ${total} ║`);
  });

  console.log('╚══════════════════════════════╧════════╧════════╧════════╧═════════╝');
}

interface MergedPlayerData {
  [key: string]: PlayerData;
}

function mergePlayerStats(battingData: PlayerData[], bowlingData: PlayerData[], fieldingData: PlayerData[], dnbData: PlayerData[]): PlayerData[] {
  const mergedPlayers: MergedPlayerData = {};

  const getPlayerKey = (player: PlayerData) => `${player.fullName.toLowerCase()}_${player.team}`;

  const mergePlayer = (player: PlayerData) => {
    const key = getPlayerKey(player);
    if (!mergedPlayers[key]) {
      mergedPlayers[key] = {
        fullName: player.fullName,
        shortName: player.shortName,
        team: player.team,
        matchId: player.matchId,
        innings: player.innings,
        battingRuns: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        overs: 0,
        maidens: 0,
        wickets: 0,
        runsConceded: 0,
        economy: 0,
        wides: 0,
        noBalls: 0,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
        dotBalls: 0  // Initialize dotBalls
      };
    }

    // Merge batting stats
    if (player.battingRuns !== undefined) {
      mergedPlayers[key].battingRuns = player.battingRuns;
      mergedPlayers[key].balls = player.balls || 0;
      mergedPlayers[key].fours = player.fours || 0;
      mergedPlayers[key].sixes = player.sixes || 0;
      mergedPlayers[key].strikeRate = player.strikeRate || 0;
    }

    // Merge bowling stats
    if (player.overs !== undefined) {
      mergedPlayers[key].overs = player.overs;
      mergedPlayers[key].maidens = player.maidens || 0;
      mergedPlayers[key].wickets = player.wickets || 0;
      mergedPlayers[key].runsConceded = player.runsConceded || 0;
      mergedPlayers[key].economy = player.economy || 0;
      mergedPlayers[key].wides = player.wides || 0;
      mergedPlayers[key].noBalls = player.noBalls || 0;
      mergedPlayers[key].dotBalls = player.dotBalls || 0;  // Make sure to merge dotBalls
    }

    // Merge fielding stats
    mergedPlayers[key].catches = (mergedPlayers[key].catches || 0) + (player.catches || 0);
    mergedPlayers[key].stumpings = (mergedPlayers[key].stumpings || 0) + (player.stumpings || 0);
    mergedPlayers[key].runOuts = (mergedPlayers[key].runOuts || 0) + (player.runOuts || 0);
  };

  [...battingData, ...bowlingData, ...dnbData].forEach(mergePlayer);

  // Handle fielding data separately to avoid overwriting
  fieldingData.forEach(player => {
    const key = getPlayerKey(player);
    if (mergedPlayers[key]) {
      mergedPlayers[key].catches = player.catches || 0;
      mergedPlayers[key].stumpings = player.stumpings || 0;
      mergedPlayers[key].runOuts = player.runOuts || 0;
    }
  });

  return Object.values(mergedPlayers);
}

function mergePlayerPoints(points: PlayerPoints[]): PlayerPoints[] {
  const mergedPoints: { [key: string]: PlayerPoints } = {};

  points.forEach(player => {
    const key = `${player.player_name.toLowerCase()}_${player.team}`;
    
    if (!mergedPoints[key]) {
      mergedPoints[key] = {
        match_id: player.match_id,
        player_name: player.player_name,
        team: player.team,
        batting_points: 0,
        bowling_points: 0,
        fielding_points: 0,
        potm_points: 0
      };
    }

    // Add up all points
    mergedPoints[key].batting_points += player.batting_points;
    mergedPoints[key].bowling_points += player.bowling_points;
    mergedPoints[key].fielding_points += player.fielding_points;
    mergedPoints[key].potm_points += (player.potm_points || 0);  // Add POTM points
  });

  return Object.values(mergedPoints);
}

interface PlayerWithPrice {
  Player: string;
  "Player ID": string;
  "Team Name": string;
  Price: number;
  Country: string;
  "Player Role": string;
  "Role Detail": string;
  "Birth Date": string;
  "Birth Place": string;
  Height: string;
  "Batting Style": string;
  "Bowling Style": string;
  "Team ID": string;
}

interface DotBallStats {
  playerName: string;
  team: string;
  dotBalls: number;
}

async function getPlayerIdFromJson(playerName: string): Promise<string | null> {
  try {
    const playersData = await fs.readFile('public/data/players_with_prices.json', 'utf8');
    const players: PlayerWithPrice[] = JSON.parse(playersData);
    
    // Clean the player name for comparison
    const cleanedName = cleanPlayerName(playerName).toLowerCase();
    
    // Try to find the player
    const player = players.find(p => 
      cleanPlayerName(p.Player).toLowerCase() === cleanedName
    );
    
    return player ? player["Player ID"] : null;
  } catch (error) {
    console.error('Error reading players_with_prices.json:', error);
    return null;
  }
}

async function getDotBallCount(matchId: string, inningNumber: string, playerId: string): Promise<number> {
  try {
    const url = `https://www.cricbuzz.com/player-match-highlights/${matchId}/${inningNumber}/${playerId}/bowling`;
    console.log(`Fetching dot balls from: ${url}`);
    
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    let dotBalls = 0;
    
    $('.cb-plyr-hlts-comm .cb-mr-bottom-10.cb-col.cb-col-100.cb-events').each((index, elem) => {
      const ballNumber = $(elem).find('.cb-col.cb-col-8 .text-bold').text().trim();
      const commentary = $(elem).find('.cb-col.cb-com-ln.cb-col-90').text().trim();
      
      if (!ballNumber || !commentary) return;
      
      const [bowlerToBatter, afterComma] = commentary.split(',');
      if (afterComma) {
        const cleanedText = afterComma.trim().toLowerCase();
        
        if (
          cleanedText.includes('no run') ||
          cleanedText.includes('byes') ||
          cleanedText.includes('leg byes') ||
          cleanedText.includes('out')
        ) {
          dotBalls++;
          console.log(`Found dot ball: ${commentary}`);
        }
      }
    });
    
    console.log(`Total dot balls for player ${playerId} in innings ${inningNumber}: ${dotBalls}`);
    return dotBalls;
  } catch (error) {
    console.error(`Error fetching dot balls for player ${playerId}:`, error);
    return 0;
  }
}

async function collectDotBallStats(
  matchId: string, 
  bowlingData: PlayerData[]
): Promise<{ [key: string]: number }> {
  const dotBallStats: { [key: string]: number } = {};
  console.log('\nCollecting dot ball stats...');

  for (const bowler of bowlingData) {
    if (bowler.playerId) {
      console.log(`\nProcessing bowler: ${bowler.fullName} (ID: ${bowler.playerId})`);
      const firstInningDots = await getDotBallCount(matchId, '1', bowler.playerId);
      const secondInningDots = await getDotBallCount(matchId, '2', bowler.playerId);
      const totalDotBalls = firstInningDots + secondInningDots;

      dotBallStats[bowler.fullName] = totalDotBalls;
      console.log(`Total dot balls for ${bowler.fullName}: ${totalDotBalls}`);
    } else {
      console.warn(`Could not find player ID for ${bowler.fullName}`);
    }
  }

  return dotBallStats;
}

async function exportPointsTable(points: PlayerPoints[]): Promise<void> {
  try {
    // Filter out non-player entries and include only players with actual points
    const tablePoints = points
      .filter(player => {
        // Exclude special rows like "Extras", "Total", "Did Not Bat"
        const excludedNames = ["Extras", "Total", "Did Not Bat"];
        return !excludedNames.includes(player.player_name);
      })
      .map(player => ({
        match_id: player.match_id,
        player_name: player.player_name,
        team: player.team,
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
        `${player.player_name} (${player.team}): ` +
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

// Add this interface
interface POTM {
  match_id: string;
  player_name: string;
  player_id: string;
}

// Add this function to extract POTM
async function extractPOTM(matchUrl: string): Promise<POTM | null> {
  try {
    // Use the match ID we already have from the match URL
    const matchId = matchUrl.split('/cricket-scorecard/')[1];
    if (!matchId) {
      console.error('Could not extract match ID from URL:', matchUrl);
      return null;
    }
    
    // Directly construct the scores URL with the known match ID
    const url = `https://www.cricbuzz.com/cricket-scores/${matchId}`;
    console.log('Fetching POTM from:', url);
    
    const response = await fetch(url, { headers });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Look for the POTM div with multiple possible class combinations
    const potmDiv = $('.cb-mom-itm, .cb-mom-item, .cb-mat-mop-itm');
    if (potmDiv.length) {
      const playerLink = potmDiv.find('a');
      if (playerLink.length) {
        const playerName = playerLink.text().trim();
        const playerHref = playerLink.attr('href') || '';
        const playerId = playerHref.split('/').filter(Boolean).pop() || '';
        
        console.log(`Found POTM: ${playerName} (ID: ${playerId})`);
        
        return {
          match_id: matchId,
          player_name: playerName,
          player_id: playerId
        };
      }
    }
    
    // Try alternative selector if first attempt fails
    const altPotmDiv = $('div:contains("Player of the match")').next().find('a');
    if (altPotmDiv.length) {
      const playerName = altPotmDiv.text().trim();
      const playerHref = altPotmDiv.attr('href') || '';
      const playerId = playerHref.split('/').filter(Boolean).pop() || '';
      
      console.log(`Found POTM (alternative method): ${playerName} (ID: ${playerId})`);
      
      return {
        match_id: matchId,
        player_name: playerName,
        player_id: playerId
      };
    }
    
    console.log('No POTM found on the page');
    return null;
  } catch (error) {
    console.error(`Error fetching POTM data from ${matchUrl}:`, error);
    return null;
  }
}

// Add these interfaces at the top
interface PointsBreakdown {
  basePoints: number;
  bonusPoints: number;
  penaltyPoints: number;
  total: number;
}

interface PlayerPointsDetails extends PlayerPoints {
  breakdown: {
    batting: PointsBreakdown;
    bowling: PointsBreakdown;
    fielding: PointsBreakdown;
  };
}

// Add this function to help with name matching
function normalizePlayerName(name: string): string {
  // Remove any special characters, extra spaces, and convert to lowercase
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')    // Replace multiple spaces with single space
    .trim();
}

// Update the main function to include dot ball collection:
async function main() {
  try {
    console.log('Starting scraper...');
    
    const matches = await scrapeMatches();
    console.log(`Found ${matches.length} matches to process`);

    const matchesToProcess = matches.slice(0, 1); // Comment this line to process all matches
    // const matchesToProcess = matches; // Uncomment this line to process all matches

    for (const match of matchesToProcess) {
      console.log(`\n=== Processing match ID: ${match.id} ===`);
      console.log(`${match.teams[0]} vs ${match.teams[1]}`);
      
      // Extract Player of the Match
      const potm = await extractPOTM(match.scorecard_url);

      // Add delay to avoid hitting the server too frequently
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        // Now proceed with processing player points
        console.log(`Processing scorecard for match ${match.id}...`);
        const html = await fetchWithRetry(match.id);
        const {
          battingData,
          bowlingData,
          fieldingData,
          dnbData
        } = await parseScorecard(html, match.id);

        // Collect dot ball stats for bowlers
        console.log('Collecting dot ball stats...');
        const dotBallStats = await collectDotBallStats(match.id, bowlingData);

        // Update bowling data with dot balls
        bowlingData.forEach(bowler => {
          if (dotBallStats[bowler.fullName]) {
            bowler.dotBalls = dotBallStats[bowler.fullName];
          }
        });

        // Process player points but don't save to database
        const mergedPlayers = mergePlayerStats(battingData, bowlingData, fieldingData, dnbData);
        const playerPoints = calculateAllPlayerPoints(mergedPlayers, potm);
        await exportPointsTable(playerPoints);
        displayPointsTable(playerPoints);

        console.log(`Successfully processed match ${match.id}`);

      } catch (error) {
        console.error(`Error processing match ${match.id}:`, error);
        continue;
      }

      // Add delay between matches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\nFinished processing all matches');
  } catch (error) {
    console.error('Error in main process:', error);
    throw error;
  }
}

function calculateAllPlayerPoints(players: PlayerData[], potm: POTM | null): PlayerPoints[] {
  return players.map(player => {
    const points = calculatePoints(player);
    return {
      match_id: player.matchId,
      player_name: player.fullName,
      team: player.team,
      batting_points: points.battingPoints,
      bowling_points: points.bowlingPoints,
      fielding_points: points.fieldingPoints,
      potm_points: potm?.player_name === player.fullName ? 50 : 0
    };
  });
}

main();