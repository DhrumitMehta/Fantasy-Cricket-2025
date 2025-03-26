import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the directory path of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: resolve(__dirname, '../.env') });

// Debug: Log environment variables
console.log('Environment variables:', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Check if environment variables are loaded
if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing environment variables. Please check your .env file.');
  console.error('Required variables: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY');
  console.error('Current values:', { supabaseUrl, supabaseKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
  try {
    // Read the JSON file
    const playersData = JSON.parse(fs.readFileSync('./public/data/players_with_prices.json', 'utf8'));
    
    // Transform the data to match the table structure
    const transformedPlayers = playersData.map(player => ({
      Player_ID: player["Player ID"] || player.Player_ID || player.player_id || `temp-${Date.now()}-${Math.random()}`,
      Player: player.Player || "Unknown Player",
      Country: player.Country || "",
      Player_Role: player["Player Role"] || player.Player_Role || "",
      Role_Detail: player["Role Detail"] || player.Role_Detail || "",
      Birth_Date: player["Birth Date"] || player.Birth_Date || "",
      Birth_Place: player["Birth Place"] || player.Birth_Place || "",
      Height: player.Height || "",
      Batting_Style: player["Batting Style"] || player.Batting_Style || "",
      Bowling_Style: player["Bowling Style"] || player.Bowling_Style || "",
      Team_Name: player["Team Name"] || player.Team_Name || "",
      Team_ID: player["Team ID"] || player.Team_ID || "",
      Price: player.Price || 5.0,
    }));
    
    // Insert the data into the Supabase table
    const { data, error } = await supabase
      .from('players')
      .upsert(transformedPlayers);
      
    if (error) {
      console.error('Error inserting data:', error);
    } else {
      console.log('Data migration successful!');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

migrateData();