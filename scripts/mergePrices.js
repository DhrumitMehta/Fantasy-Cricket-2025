const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Read the files
const playersJson = JSON.parse(fs.readFileSync('public/data/players.json', 'utf-8'));
const pricesCsv = fs.readFileSync('public/data/player_prices.csv', 'utf-8');

// Parse CSV data
const pricesData = parse(pricesCsv, {
  columns: true,
  skip_empty_lines: true
});

// Create price lookup map
const pricesMap = new Map(
  pricesData.map((row) => [row['Full Name'], parseFloat(row['Price'])])
);

// Merge data
const mergedPlayers = playersJson.map((player) => ({
  ...player,
  Price: pricesMap.get(player.Player) || 5.0 // Default price of 5.0M
}));

// Write the merged data to a new JSON file
fs.writeFileSync(
  'public/data/players_with_prices.json',
  JSON.stringify(mergedPlayers, null, 2)
);

console.log('Successfully merged player data with prices'); 