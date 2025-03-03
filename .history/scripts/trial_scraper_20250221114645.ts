import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';

dotenv.config();

console.log('Environment variables:', {
  supabaseUrl: process.env.SUPABASE_URL,
  hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
});

const CRICBUZZ_BASE_URL = 'https://www.cricbuzz.com';

interface BattingStats {
  player: string;
  runs: string;
  balls: string;
  fours: string;
  sixes: string;
  strikeRate: string;
}

interface BowlingStats {
  player: string;
  overs: string;
  maidens: string;
  runs: string;
  wickets: string;
  economy: string;
}

interface FieldingStats {
  player: string;
  catches: string;
  stumpings: string;
}

// Add rate limiting utility
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Add test match IDs
const TEST_MATCH_IDS = [
  '112680', // Add a few known match IDs here
  '47352',
  '47353'
];

async function getMatchScorecard(matchId: string) {
  try {
    // Add delay for rate limiting (1 second between requests)
    await delay(1000);
    
    const url = `${CRICBUZZ_BASE_URL}/api/html/cricket-scorecard/${matchId}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching scorecard for match ${matchId}:`, error);
    return null;
  }
}

function parseBattingStats(html: string): BattingStats[] {
  const $ = cheerio.load(html);
  const battingStats: BattingStats[] = [];

  $('.cb-col.cb-col-100.cb-ltst-wgt-hdr').each((_, element) => {
    const rows = $(element).find('.cb-col.cb-col-100.cb-scrd-itms');
    rows.each((_, row) => {
      const player = $(row).find('.cb-col.cb-col-27').text().trim();
      const runs = $(row).find('.cb-col.cb-col-10').first().text().trim();
      const balls = $(row).find('.cb-col.cb-col-10').eq(1).text().trim();
      const fours = $(row).find('.cb-col.cb-col-10').eq(2).text().trim();
      const sixes = $(row).find('.cb-col.cb-col-10').eq(3).text().trim();
      const strikeRate = $(row).find('.cb-col.cb-col-10').last().text().trim();
      
      if (player) {
        battingStats.push({ player, runs, balls, fours, sixes, strikeRate });
      }
    });
  });

  return battingStats;
}

function parseBowlingStats(html: string): BowlingStats[] {
  const $ = cheerio.load(html);
  const bowlingStats: BowlingStats[] = [];

  $('.cb-col.cb-col-100.cb-ltst-wgt-hdr').each((_, element) => {
    const rows = $(element).find('.cb-col.cb-col-100.cb-scrd-itms');
    rows.each((_, row) => {
      const player = $(row).find('.cb-col.cb-col-40').text().trim();
      const overs = $(row).find('.cb-col.cb-col-10').first().text().trim();
      const maidens = $(row).find('.cb-col.cb-col-10').eq(1).text().trim();
      const runs = $(row).find('.cb-col.cb-col-10').eq(2).text().trim();
      const wickets = $(row).find('.cb-col.cb-col-10').eq(3).text().trim();
      const economy = $(row).find('.cb-col.cb-col-10').last().text().trim();
      
      if (player) {
        bowlingStats.push({ player, overs, maidens, runs, wickets, economy });
      }
    });
  });

  return bowlingStats;
}

function parseFieldingStats(html: string): FieldingStats[] {
  const $ = cheerio.load(html);
  const fieldingStats: FieldingStats[] = [];

  $('.cb-col.cb-col-100.cb-ltst-wgt-hdr').each((_, element) => {
    const rows = $(element).find('.cb-col.cb-col-100.cb-scrd-itms');
    rows.each((_, row) => {
      const player = $(row).find('.cb-col.cb-col-40').text().trim();
      const catches = $(row).find('.cb-col.cb-col-10').first().text().trim();
      const stumpings = $(row).find('.cb-col.cb-col-10').eq(1).text().trim();
      
      if (player) {
        fieldingStats.push({ player, catches, stumpings });
      }
    });
  });

  return fieldingStats;
}

async function getMatchStats(matchId: string): Promise<{
  battingStats: BattingStats[];
  bowlingStats: BowlingStats[];
  fieldingStats: FieldingStats[];
} | null> {
  const scorecardHtml = await getMatchScorecard(matchId);
  if (!scorecardHtml) return null;

  const battingStats = parseBattingStats(scorecardHtml);
  const bowlingStats = parseBowlingStats(scorecardHtml);
  const fieldingStats = parseFieldingStats(scorecardHtml);

  return { battingStats, bowlingStats, fieldingStats };
}