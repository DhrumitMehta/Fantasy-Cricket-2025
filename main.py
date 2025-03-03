import requests
from bs4 import BeautifulSoup
import pandas as pd
import re
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from supabase import create_client, Client
from dotenv import load_dotenv
import os
from datetime import datetime, timezone

# Load environment variables
load_dotenv()

# Debugging: Print environment variable status (without exposing secrets)
print("Environment variables:", {
    "supabase_url": os.getenv("SUPABASE_URL"),
    "has_service_key": bool(os.getenv("SUPABASE_SERVICE_KEY"))  # Check if the key exists without printing it
})

# Ensure required environment variables are set
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

print("Supabase client initialized successfully!")

def insert_match(match_id, match_date, teams, venue, result, scorecard_url):
    """Insert match details into Supabase matches table, but only if it doesn't already exist."""

    # ✅ 1. Check if the match already exists in the database
    response = supabase.table("matches").select("id").eq("id", match_id).execute()

    if hasattr(response, "data") and response.data:
        print(f"⚠️ Match {match_id} already exists in database. Skipping insert.")
        return  # Skip inserting duplicate matches

    # ✅ 2. Skip inserting matches with no result
    if not result or result == "Result Pending":
        print(f"⚠️ Match {match_id} result is pending. Skipping insert.")
        return  # Skip matches without a result

    # ✅ 3. Prepare match data for insertion
    match_data = {
        "id": match_id,
        "match_date": match_date,
        "teams": teams,
        "venue": venue,
        "result": result,
        "scorecard_url": scorecard_url,  # Include the scorecard URL
        "processed": True  # Mark match as processed
    }

    # ✅ 4. Insert match record into Supabase (only if it's new)
    response = supabase.table("matches").upsert([match_data]).execute()

    # ✅ 5. Handle response
    if hasattr(response, "status") and response.status >= 400:
        print(f"❌ Error inserting match {match_id}: {response}")
    elif hasattr(response, "data") and response.data:
        print(f"✅ Match {match_id} inserted successfully into database.")
    else:
        print(f"⚠️ Unknown response format: {response}")

def insert_player_points(df_player_points):
    """Insert player fantasy points into Supabase player_points table."""
    
    # Convert numeric columns to float (to match the updated Supabase schema)
    numeric_columns = ["batting_points", "bowling_points", "fielding_points", "potm_points"]
    df_player_points[numeric_columns] = df_player_points[numeric_columns].astype(float)

    # Remove 'total_points' before inserting (since it's auto-calculated)
    records = df_player_points.drop(columns=["total_points"], errors="ignore").to_dict(orient="records")

    response = supabase.table("player_points").insert(records).execute()

    if hasattr(response, "status") and response.status >= 400:
        print(f"❌ Error inserting player points: {response}")
    elif hasattr(response, "data") and response.data:
        print("✅ Player points inserted successfully.")
    else:
        print(f"⚠️ Unknown response format: {response}")

# Initialize empty DataFrames for all matches
all_batting_data = []
all_bowling_data = []
all_fielding_data = []
all_potm_data = []

SERIES_URL = 'https://www.cricbuzz.com/cricket-series/9351/womens-premier-league-2025/matches'

# Configure session with retries
session = requests.Session()
retry_strategy = Retry(
    total=5,
    backoff_factor=2,
    status_forcelist=[429, 500, 502, 503, 504],
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("https://", adapter)
session.mount("http://", adapter)

from datetime import datetime, timezone

from datetime import datetime, timezone

def extract_match_date(match_div):
    """Extract match date from the `timestamp` attribute inside `.schedule-date[timestamp]`."""
    
    # ✅ Find the span with the `timestamp` attribute inside `.schedule-date`
    schedule_date = match_div.find('span', class_='schedule-date')

    if not schedule_date:
        print(f"⚠️ Warning: No `.schedule-date` span found for match: {match_div}")
        return None

    # ✅ Extract the `timestamp` attribute
    timestamp_attr = schedule_date.get("timestamp")

    if not timestamp_attr or not timestamp_attr.isdigit():
        print(f"⚠️ Warning: Invalid or missing timestamp `{timestamp_attr}`")
        return None

    try:
        # ✅ Convert timestamp to integer
        timestamp = int(timestamp_attr)
        match_datetime = datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc)  # Convert to UTC datetime
        
        # ✅ Debugging output
        print(f"✅ Parsed match date: {match_datetime.strftime('%Y-%m-%dT%H:%M:%SZ')} (UTC)")

        return match_datetime.strftime("%Y-%m-%dT%H:%M:%SZ")  # Format in ISO 8601 (UTC)
    
    except ValueError as e:
        print(f"❌ Error parsing date: {e}")
        print(f"❌ Raw timestamp: {timestamp_attr}")
        return None  # Return None if conversion fails

def get_scorecard_urls(url):
    """Fetch match details and insert into Supabase before returning scorecard URLs."""
    scorecard_urls = []

    # Fetch the page content
    response = session.get(url, timeout=10)
    if response.status_code == 200:
        page_content = response.text
    else:
        print(f"Failed to retrieve the page. Status code: {response.status_code}")
        exit()

    # Parse the HTML content
    soup = BeautifulSoup(page_content, 'html.parser')

    # ✅ Find all match divs (first match + other matches)
    match_divs = soup.find_all('div', class_=[
        "cb-col-100 cb-col cb-series-matches",  # First match
        "cb-col-100 cb-col cb-series-brdr cb-series-matches"  # Other matches
    ])

    # 🔍 Debugging: Print the number of matches found
    print(f"\n🔍 DEBUG: Found {len(match_divs)} match divs\n")

    # Check if no matches were found
    if not match_divs:
        print("\n❌ ERROR: No match divs found! The structure of the website might have changed.")
        exit()

    matches = []

    for match_div in match_divs:
        # Extract match details
        match_info = {}

        # Extract match title and scorecard URL safely
        match_link = match_div.find('a', class_='text-hvr-underline')
        if match_link and 'href' in match_link.attrs:
            match_info['match_title'] = match_link.text.strip()
            match_info['scorecard_url'] = match_link['href']
            match_info['match_id'] = match_info['scorecard_url'].split("/")[-2]
        else:
            match_info['match_title'] = "Unknown Match"
            match_info['scorecard_url'] = None  # Explicitly set to None if missing
            match_info['match_id'] = None

        # Extract venue
        venue_div = match_div.find('div', class_='text-gray')
        match_info['venue'] = venue_div.text.strip() if venue_div else "Unknown Venue"

        # Extract result
        result_link = match_div.find('a', class_='cb-text-complete')
        match_info['result'] = result_link.text.strip() if result_link else "Result Pending"

        # ✅ Extract match date correctly
        match_date = extract_match_date(match_div)
        match_info["match_date"] = match_date if match_date else "1970-01-01T00:00:00Z"  # Fallback date

        if match_date is None:
            print(f"⚠️ WARNING: No valid date found for match `{match_info['match_title']}`, using fallback.")
            match_date = "1970-01-01T00:00:00Z"  # Set a clear fallback date instead of NULL

        if match_info['scorecard_url']:  # Ensure URL exists before processing
            match_id = match_info['scorecard_url'].split("/")[-2]
        else:
            print(f"Skipping match due to missing scorecard URL: {match_info['match_title']}")
            continue  # Skip this match

        # Extract teams from match title (Only take text before the first comma)
        match_title = match_info['match_title'].split(",")[0]  # Take only text before the first comma
        teams = match_title.split(" vs ") if " vs " in match_title else ["Unknown", "Unknown"]
        match_info['teams'] = match_title.split(" vs ") if " vs " in match_title else ["Unknown", "Unknown"]

        # Store extracted match info
        matches.append(match_info)

        # Insert match into Supabase
        insert_match(
            match_id=match_id,
            match_date=match_date,
            teams=teams,
            venue=match_info['venue'],
            result=match_info['result'],
            scorecard_url=f"https://www.cricbuzz.com{match_info['scorecard_url']}"
        )

    # Output the extracted match information
    for match in matches:
        print(f"Match: {match.get('match_title', 'N/A')}")
        print(f"Venue: {match.get('venue', 'N/A')}")
        print(f"Result: {match.get('result', 'N/A')}")
        print(f"Scorecard URL: https://www.cricbuzz.com{match.get('scorecard_url', 'N/A')}")
        print("-" * 40)
        scorecard_urls.append(f"https://www.cricbuzz.com{match.get('scorecard_url', 'N/A')}")
        
    return matches

def extract_match_id(scorecard_url):
    """Extract match_id from the scorecard URL"""
    return scorecard_url.split("/")[-2]

def fetch_scorecard(match_id):
    """Fetch scorecard HTML from Cricbuzz API with retry handling"""
    api_url = f"https://www.cricbuzz.com/api/html/cricket-scorecard/{match_id}"
    try:
        response = session.get(api_url, timeout=10)
        response.raise_for_status()
        
        # Check if scorecard contains valid content
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for an indication that the scorecard is not available
        if not soup.find('div', class_='cb-col cb-col-100 cb-ltst-wgt-hdr'):
            print(f"Scorecard not available yet for Match ID {match_id}. Skipping...")
            return None

        return response.text
    except requests.exceptions.RequestException as e:
        print(f"Error fetching scorecard for match {match_id}: {e}")
        return None

def count_dot_balls(highlights_url):
    """Fetch the highlights page and count dot balls based on specific keywords."""
    try:
        response = session.get(highlights_url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        # Find all ball commentary events
        ball_events = soup.find_all('div', class_='cb-mr-bottom-10 cb-col cb-col-100 cb-events')

        dot_ball_keywords = ["no run", "byes", "leg byes", "out"]
        dot_ball_count = 0

        for event in ball_events:
            ball_description = event.find('div', class_='cb-col cb-com-ln cb-col-90')
            if ball_description:
                ball_text = ball_description.text.lower()  # Convert to lowercase for case-insensitive matching
                
                # Check if any of the dot ball keywords appear
                if any(keyword in ball_text for keyword in dot_ball_keywords):
                    dot_ball_count += 1

        return dot_ball_count

    except requests.exceptions.RequestException as e:
        print(f"Error fetching highlights from {highlights_url}: {e}")
        return None

def parse_scorecard(html_content):
    """Parse batting, bowling, and fielding tables from the scorecard"""
    soup = BeautifulSoup(html_content, 'html.parser')

    # Extract team names
    team_names = []
    innings_headers = soup.find_all('div', class_='cb-col cb-col-100 cb-scrd-hdr-rw')
    for header in innings_headers:
        team_name = header.text.split('Innings')[0].strip()
        team_names.append(team_name)

    # Initialize data structures
    batting_tables = []
    bowling_tables = []
    fielding_stats_by_innings = {1: {}, 2: {}}  # Track fielding stats per innings
    team_player_mapping = {}  # Add this line to initialize the mapping
    current_innings = 0  # Add this to track current innings

    # Extract batting tables
    for table in soup.find_all('div', class_='cb-col cb-col-100 cb-ltst-wgt-hdr'):
        if "Batter" in table.text or "Batsman" in table.text:  # Identify batting tables for multiple innings
            current_innings += 1  # Increment innings counter
            rows = []
            batting_team = team_names[current_innings - 1]  # Use current_innings instead of innings
            for row in table.find_all('div', class_='cb-col cb-col-100 cb-scrd-itms'):
                cols = row.find_all('div')
                if len(cols) >= 7:  # Ensure it's a valid batting row
                    player_name = cols[0].text.strip()
                    team_player_mapping[player_name] = batting_team  # Map player to their team
                    player_link = cols[0].find('a')  # Get player profile link
                    full_name = fetch_full_name(player_link['href']) if player_link else player_name
                    
                    dismissal_info = cols[1].text.strip().lower()  # Get dismissal details
                    runs = cols[2].text.strip()
                    balls = cols[3].text.strip()
                    fours = cols[4].text.strip()
                    sixes = cols[5].text.strip()
                    strike_rate = cols[6].text.strip()
                    
                    rows.append([full_name, player_name, runs, balls, fours, sixes, strike_rate])

                    # Initialize fielding stats for this innings if not exists
                    current_fielding_stats = fielding_stats_by_innings[current_innings]
                    
                    # Handle caught & bowled dismissals safely
                    if 'c & b' in dismissal_info:
                        parts = dismissal_info.split('c & b')
                    elif 'c and b' in dismissal_info:
                        parts = dismissal_info.split('c and b')
                    else:
                        parts = []

                    if len(parts) > 1:  # Ensure fielder information exists
                        fielder = parts[1].strip()
                        current_fielding_stats[fielder] = current_fielding_stats.get(fielder, {"Catches": 0, "Stumpings": 0, "Run Outs": 0})
                        current_fielding_stats[fielder]["Catches"] += 1
                    else:
                        # Handle regular catches: "c Player Name b Bowler Name"
                        catch_match = re.search(r'c (.*?)\s+(?=b\s+)', dismissal_info)
                        if catch_match:
                            fielder = catch_match.group(1).strip()
                            current_fielding_stats[fielder] = current_fielding_stats.get(fielder, {"Catches": 0, "Stumpings": 0, "Run Outs": 0})
                            current_fielding_stats[fielder]["Catches"] += 1

                    # Handle stumpings
                    stumping_match = re.search(r'st (\w+ \w+)', dismissal_info)
                    if stumping_match:
                        fielder = stumping_match.group(1).strip()
                        current_fielding_stats[fielder] = current_fielding_stats.get(fielder, {"Catches": 0, "Stumpings": 0, "Run Outs": 0})
                        current_fielding_stats[fielder]["Stumpings"] += 1

                    # Handle run outs
                    runout_match = re.search(r'run out \(([\w\s/]+)\)', dismissal_info)
                    if runout_match:
                        fielders = runout_match.group(1).strip().split("/")
                        for fielder in fielders:
                            fielder = fielder.strip()
                            current_fielding_stats[fielder] = current_fielding_stats.get(fielder, {"Catches": 0, "Stumpings": 0, "Run Outs": 0})
                            current_fielding_stats[fielder]["Run Outs"] += 1

            # After the batting tables extraction, modify the DNB players code:
            dnb_players = []

            # Find all instances of 'Did not Bat'
            dnb_sections = [div for div in soup.find_all('div', class_='cb-col cb-col-100 cb-scrd-itms') if 'Did not Bat' in div.text]

            # Check if there are exactly two DNB sections
            if len(dnb_sections) == 2:
                for i, dnb_section in enumerate(dnb_sections):
                    # Determine correct team based on occurrence
                    batting_team = team_names[i]  # First DNB -> team_names[0], Second DNB -> team_names[1]

                    # Extract player names from DNB section
                    dnb_links = dnb_section.find_all('a', class_='cb-text-link')
                    for player_link in dnb_links:
                        player_name = player_link.text.strip()
                        if player_name:  # Ensure valid player names
                            full_name = fetch_full_name(player_link['href'])

                            # Add the player with correct team
                            dnb_players.append([full_name, player_name, i + 1, batting_team])  # i+1 ensures correct innings

            # Convert DNB players to DataFrame with innings and team information
            df_dnb = pd.DataFrame(dnb_players, columns=['Full Name', 'Batsman', 'Innings', 'Team']) if dnb_players else pd.DataFrame(columns=['Full Name', 'Batsman', 'Innings', 'Team'])
            
            batting_tables.append(rows)

    # Extract bowling tables
    for table in soup.find_all('div', class_='cb-col cb-col-100 cb-ltst-wgt-hdr'):
        if "Bowler" in table.text:  # Identify bowling tables
            rows = []
            for row in table.find_all('div', class_='cb-col cb-col-100 cb-scrd-itms'):
                cols = row.find_all('div')
                if len(cols) >= 8:  # Ensure it's a valid bowling row
                    player_name = cols[0].text.strip()
                    player_link = cols[0].find('a')  # Get player profile link
                    full_name = fetch_full_name(player_link['href']) if player_link else player_name
                    
                    overs = cols[1].text.strip()
                    maidens = cols[2].text.strip()
                    runs = cols[3].text.strip()
                    wickets = cols[4].text.strip()
                    no_balls = cols[5].text.strip()
                    wides = cols[6].text.strip()
                    economy = cols[7].text.strip()
                    
                    # Extract the dot ball link if available
                    dots_link_tag = cols[8].find('a')
                    dot_ball_link = f"https://www.cricbuzz.com{dots_link_tag['href']}" if dots_link_tag else "N/A"

                    dots = count_dot_balls(dot_ball_link) 
                    
                    rows.append([full_name, player_name, overs, maidens, runs, wickets, no_balls, wides, economy, dots])
            bowling_tables.append(rows)

    # Convert fielding stats to DataFrame format
    fielding_data = []
    for innings, stats in fielding_stats_by_innings.items():
        for fielder, contributions in stats.items():
            proper_name = ' '.join(word.capitalize() for word in fielder.split())
            fielding_data.append([
                proper_name,
                contributions["Catches"],
                contributions["Stumpings"],
                contributions["Run Outs"],
                innings,  # Add innings number
                team_names[0] if innings == 2 else team_names[1]  # Add correct bowling team
            ])

    df_fielding = pd.DataFrame(
        fielding_data,
        columns=["Player", "Catches", "Stumpings", "Run Outs", "Innings", "Team"]
    )

    return batting_tables, bowling_tables, df_fielding, team_player_mapping, team_names, df_dnb

def fetch_full_name(player_url):
    """Fetch full player name from their profile page with retry handling"""
    base_url = "https://www.cricbuzz.com"
    full_url = base_url + player_url
    try:
        response = session.get(full_url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        name_tag = soup.find('h1', class_='cb-font-40')
        return name_tag.text.strip() if name_tag else "N/A"
    except requests.exceptions.RequestException as e:
        print(f"Error fetching player name from {full_url}: {e}")
        return "N/A"
    
def fetch_player_name_from_cricbuzz(player_id):
    """Fetch the correct player name from Cricbuzz using player_id."""
    url = f"https://www.cricbuzz.com/profiles/{player_id}"
    try:
        response = session.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        name_tag = soup.find('h1', class_='cb-font-40')
        return name_tag.text.strip() if name_tag else None
    except requests.RequestException as e:
        print(f"Error fetching player name for ID {player_id}: {e}")
        return None

def extract_potm(match_url):
    """Extract Player of the Match information from the match page"""
    try:
        response = session.get(match_url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        potm_div = soup.find('div', class_='cb-col cb-col-50 cb-mom-itm')
        if potm_div:
            player_link = potm_div.find('a', class_='cb-link-undrln')
            if player_link:
                player_name = player_link.text.strip()
                player_id = player_link['href'].split('/')[-2]
                return pd.DataFrame([{'Match_ID': match_url.split('/')[-2], 'Player_Name': player_name, 'Player_ID': player_id}])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching POTM data from {match_url}: {e}")
    return None

def process_match(scorecard_url, match_index, total_matches):
    """Process a single match and append its data to global lists with progress tracking"""
    match_id = extract_match_id(scorecard_url)
    print(f"Processing match {match_index + 1} of {total_matches}: Match ID {match_id}")
    scorecard_html = fetch_scorecard(match_id)
    
    if not scorecard_html:  # Skip if scorecard is unavailable
        return

    if scorecard_html:
        batting_data, bowling_data, df_fielding, team_player_mapping, team_names, df_dnb = parse_scorecard(scorecard_html)

        # Process Batting Data
        all_batters = []
        for innings, batting_table in enumerate(batting_data, 1):
            df = pd.DataFrame(batting_table, columns=["Full Name", "Batsman", "Runs", "Balls", "4s", "6s", "SR"])
            df['Innings'] = innings
            df['Match_ID'] = match_id
            df['Team'] = team_names[innings-1]
            all_batting_data.append(df)
        
        # Process Bowling Data
        for innings, bowling_table in enumerate(bowling_data, 1):
            df = pd.DataFrame(bowling_table, columns=["Full Name", "Bowler", "Overs", "Maidens", "Runs", "Wickets", "No Balls", "Wides", "Econ", "Dots"])
            df['Innings'] = innings
            df['Match_ID'] = match_id
            df['Team'] = team_names[1 if innings == 1 else 0]
            all_bowling_data.append(df)

        # Add DNB players if available
        if not df_dnb.empty:
            # DNB players already have innings and team information
            df_dnb['Match_ID'] = match_id
            df_dnb['Runs'] = 0
            df_dnb['Balls'] = 0
            df_dnb['4s'] = 0
            df_dnb['6s'] = 0
            df_dnb['SR'] = 0
            all_batters.append(df_dnb)
        
        all_batting_data.extend(all_batters)
        
        # Process Fielding Data
        df_fielding['Match_ID'] = match_id
        df_fielding['Team'] = df_fielding['Innings'].map({1: team_names[1], 2: team_names[0]})
        
        all_fielding_data.append(df_fielding)
        
        # Extract Player of the Match
        base_url = "https://www.cricbuzz.com"
        potm_url = scorecard_url.replace('/live-cricket-scorecard/', '/cricket-scores/')
        match_url = f"{base_url}{potm_url}"

        df_potm = extract_potm(match_url)
        if df_potm is not None:
            all_potm_data.append(df_potm)
        
        # Add delay to avoid hitting the server too frequently
        time.sleep(2)

# Create a more flexible name mapping system
def create_name_variations(name):
    """Create different variations of a name for matching"""
    name = name.strip()
    variations = {name}  # Original name
    
    # Split name into parts
    parts = name.split()
    
    if len(parts) > 1:
        # Last name only
        variations.add(parts[-1])
        
        # First letter of first name + last name
        variations.add(f"{parts[0][0]} {parts[-1]}")
        
        # First name + last name (for cases with middle names)
        variations.add(f"{parts[0]} {parts[-1]}")
        
        # Handle initials
        if any('.' in part for part in parts):
            # Remove dots from initials
            no_dots = ' '.join(part.replace('.', '') for part in parts)
            variations.add(no_dots)
    
    return variations

# Then when creating the name mapping, it will include DNB players as well:
name_mapping = {}

# Calculate batting points
def calculate_sr_points(row):
    """Calculate Strike Rate points based on the given criteria"""
    if row['Balls'] < 10:
        return 0
        
    sr = row['SR']
    if sr < 50:
        return -15
    elif sr < 75:
        return -10
    elif sr < 100:
        return -5
    elif sr < 125:
        return 0
    elif sr < 150:
        return 5
    elif sr < 200:
        return 10
    else:
        return 15

def calculate_bonus_points(runs):
    """Calculate bonus points for every 25 runs"""
    return (runs // 25) * 10

def calculate_batting_points(df_batting_final):
    # Ensure numeric columns are properly converted
    numeric_columns = ['Runs', 'Balls', '4s', '6s', 'SR']
    df_batting_final[numeric_columns] = df_batting_final[numeric_columns].apply(pd.to_numeric, errors='coerce').fillna(0)

    # Calculate individual point components
    df_batting_final['Run_Points'] = df_batting_final['Runs'] * 1
    df_batting_final['Four_Points'] = df_batting_final['4s'] * 1
    df_batting_final['Six_Points'] = df_batting_final['6s'] * 2
    df_batting_final['SR_Points'] = df_batting_final.apply(calculate_sr_points, axis=1)
    df_batting_final['Bonus_Points'] = df_batting_final['Runs'].apply(calculate_bonus_points)

    # Calculate total batting points
    df_batting_final['Batting_Points'] = (
        df_batting_final['Run_Points'] + 
        df_batting_final['Four_Points'] + 
        df_batting_final['Six_Points'] + 
        df_batting_final['SR_Points'] + 
        df_batting_final['Bonus_Points']
    )

    # Optionally, drop the intermediate point columns if you don't need them
    df_batting_final.drop(['Run_Points', 'Four_Points', 'Six_Points', 'SR_Points', 'Bonus_Points'], axis=1, inplace=True)

    # Display the updated DataFrame
    return df_batting_final

# Calculate bowling points
def calculate_economy_points(row):
    """Calculate Economy Rate points based on the given criteria"""
    if row['Overs'] < 1:
        return 0
        
    economy = row['Econ']
    if economy < 5.01:
        return 20
    elif economy < 6.01:
        return 15
    elif economy < 7.01:
        return 10
    elif economy < 8.01:
        return 5
    elif economy < 9.01:
        return 0
    elif economy < 10.01:
        return -5
    elif economy < 12.01:
        return -10
    else:
        return -20

def calculate_wicket_bonus(wickets):
    """Calculate bonus points for wicket milestones (2+ wickets)"""
    return max(0, (wickets - 1) * 10)  # Ensures no negative values

def calculate_bowling_points(df_bowling_final):
    # Ensure numeric columns are properly converted for bowling
    numeric_columns = ['Overs', 'Maidens', 'Runs', 'Wickets', 'No Balls', 'Wides', 'Econ', 'Dots']
    df_bowling_final[numeric_columns] = df_bowling_final[numeric_columns].apply(pd.to_numeric, errors='coerce').fillna(0)

    # Calculate individual point components
    df_bowling_final['Wicket_Points'] = df_bowling_final['Wickets'] * 20
    df_bowling_final['Economy_Points'] = df_bowling_final.apply(calculate_economy_points, axis=1)
    df_bowling_final['No_Ball_Points'] = df_bowling_final['No Balls'] * -2
    df_bowling_final['Wide_Points'] = (df_bowling_final['Wides'] // 2) * -1  # -1 point per 2 wides
    df_bowling_final['Wicket_Bonus_Points'] = df_bowling_final['Wickets'].apply(calculate_wicket_bonus)
    df_bowling_final['Maiden_Points'] = df_bowling_final['Maidens'] * 20
    df_bowling_final['Dots_Points'] = df_bowling_final['Dots'] * 2
    # Calculate total bowling points
    df_bowling_final['Bowling_Points'] = (
        df_bowling_final['Wicket_Points'] + 
        df_bowling_final['Economy_Points'] + 
        df_bowling_final['No_Ball_Points'] + 
        df_bowling_final['Wide_Points'] + 
        df_bowling_final['Wicket_Bonus_Points'] +
        df_bowling_final['Maiden_Points'] + 
        df_bowling_final['Dots_Points']
    )

    # Optionally, drop the intermediate point columns
    df_bowling_final.drop([
        'Wicket_Points', 'Economy_Points', 'No_Ball_Points', 
        'Wide_Points', 'Wicket_Bonus_Points', 'Maiden_Points', 'Dots_Points'
    ], axis=1, inplace=True)

    # Display the updated DataFrame
    return df_bowling_final

def calculate_fielding_points(df_fielding_final):
    # Ensure numeric columns are properly converted for fielding
    numeric_columns = ['Catches', 'Stumpings', 'Run Outs']
    df_fielding_final[numeric_columns] = df_fielding_final[numeric_columns].apply(pd.to_numeric, errors='coerce').fillna(0)

    # Calculate fielding points
    df_fielding_final['Catch_Points'] = df_fielding_final['Catches'] * 10
    df_fielding_final['Stumping_Points'] = df_fielding_final['Stumpings'] * 10
    df_fielding_final['RunOut_Points'] = df_fielding_final['Run Outs'] * 10

    # Calculate total fielding points
    df_fielding_final['Fielding_Points'] = (
        df_fielding_final['Catch_Points'] + 
        df_fielding_final['Stumping_Points'] + 
        df_fielding_final['RunOut_Points']
    )

    # Optionally, drop the intermediate point columns
    df_fielding_final.drop(['Catch_Points', 'Stumping_Points', 'RunOut_Points'], axis=1, inplace=True)

    # Display the updated DataFrame
    return df_fielding_final

def calculate_potm_points(df_potm_final):
    # Add Player of the Match points
    if df_potm_final is not None:
        df_potm_final['POTM_Points'] = 50

    return df_potm_final

def calculate_points(df_batting_final, df_bowling_final, df_fielding_final, df_potm_final):
    """Calculate points for batting, bowling, fielding, and Player of the Match"""
    # Calculate individual points
    df_batting_final = calculate_batting_points(df_batting_final)
    df_bowling_final = calculate_bowling_points(df_bowling_final)
    df_fielding_final = calculate_fielding_points(df_fielding_final)
    df_potm_final = calculate_potm_points(df_potm_final)

    # First, let's create copies of our dataframes with just the necessary columns
    batting_points = df_batting_final[['Full Name', 'Team', 'Match_ID', 'Batting_Points']].copy()
    bowling_points = df_bowling_final[['Full Name', 'Team', 'Match_ID', 'Bowling_Points']].copy()
    fielding_points = df_fielding_final[['Player', 'Match_ID', 'Fielding_Points']].copy()  # Remove Team from fielding

    # Rename Player column in fielding to match others
    fielding_points = fielding_points.rename(columns={'Player': 'Full Name'})

    # Create a player-team mapping from batting data
    player_team_mapping = batting_points[['Full Name', 'Team', 'Match_ID']].drop_duplicates()

    # If a player doesn't exist in batting, try to get their team from bowling data
    bowling_team_mapping = bowling_points[['Full Name', 'Team', 'Match_ID']].drop_duplicates()
    player_team_mapping = pd.concat([player_team_mapping, bowling_team_mapping]).drop_duplicates()

    # Merge all points, starting with the player-team mapping as the base
    fantasy_points = player_team_mapping.merge(
        batting_points[['Full Name', 'Match_ID', 'Batting_Points']], 
        on=['Full Name', 'Match_ID'], 
        how='left'
    ).merge(
        bowling_points[['Full Name', 'Match_ID', 'Bowling_Points']], 
        on=['Full Name', 'Match_ID'], 
        how='left'
    ).merge(
        fielding_points[['Full Name', 'Match_ID', 'Fielding_Points']], 
        on=['Full Name', 'Match_ID'], 
        how='left'
    )

    # Fill NaN values with 0 for points columns
    fantasy_points['Batting_Points'] = fantasy_points['Batting_Points'].fillna(0)
    fantasy_points['Bowling_Points'] = fantasy_points['Bowling_Points'].fillna(0)
    fantasy_points['Fielding_Points'] = fantasy_points['Fielding_Points'].fillna(0)

    # Fetch correct player names for POTM using player_id
    df_potm_final['Corrected_Player_Name'] = df_potm_final['Player_ID'].apply(fetch_player_name_from_cricbuzz)

    # Handle POTM points using player_id
    if df_potm_final is not None:
        df_potm_final["match_player_key"] = df_potm_final["Corrected_Player_Name"] + "_" + df_potm_final["Match_ID"].astype(str)
        fantasy_points["match_player_key"] = fantasy_points["Full Name"] + "_" + fantasy_points["Match_ID"].astype(str)

        # Create mapping using the composite key
        potm_points = dict(zip(df_potm_final["match_player_key"], df_potm_final["POTM_Points"]))

        # Map POTM points using player_id
        fantasy_points["POTM_Points"] = fantasy_points["match_player_key"].map(potm_points).fillna(0)

        # Clean up by removing temporary columns
        fantasy_points.drop(["match_player_key"], axis=1, inplace=True)
        df_potm_final.drop(["match_player_key", "Corrected_Player_Name"], axis=1, inplace=True)
    else:
        fantasy_points["POTM_Points"] = 0

    # Calculate total Fantasy Points
    fantasy_points['Fantasy_Points'] = (
        fantasy_points['Batting_Points'] + 
        fantasy_points['Bowling_Points'] + 
        fantasy_points['Fielding_Points'] + 
        fantasy_points['POTM_Points']
    )

    # Sort by Fantasy Points in descending order
    fantasy_points = fantasy_points.sort_values('Fantasy_Points', ascending=False)

    # Create final leaderboard with rounded values
    leaderboard = fantasy_points[[
        'Full Name', 'Team', 'Match_ID', 'Fantasy_Points',
        'Batting_Points', 'Bowling_Points', 'Fielding_Points', 'POTM_Points'
    ]].round(2)

    return leaderboard

def main():
    """Main function to execute the scraper"""
    # ✅ 1. Fetch existing matches from the database
    print("🔄 Fetching existing matches from database...")
    response = supabase.table("matches").select("id").execute()

    if hasattr(response, "data") and response.data:
        existing_match_ids = {match["id"] for match in response.data}
        print(f"📌 Found {len(existing_match_ids)} existing matches in database.")
    else:
        existing_match_ids = set()
        print("⚠️ No existing matches found in database.")

    # ✅ 2. Get the list of **NEW scorecard URLs only**
    all_matches = get_scorecard_urls(SERIES_URL)
    
    # ✅ 3. Filter out matches that are:
    #    - Already in the database
    #    - Have "Result Pending"
    new_matches = [
        match for match in all_matches
        if match["match_id"] not in existing_match_ids and match["result"] != "Result Pending"
    ]

    print(f"🆕 {len(new_matches)} new completed matches to process.\n")

    # ✅ 4. Process ONLY new matches
    for i, match in enumerate(new_matches):
        process_match(match["scorecard_url"], i, len(new_matches))

    # ✅ 5. Concatenate DataFrames only if data exists
    df_batting_final = pd.concat(all_batting_data, ignore_index=True) if all_batting_data else pd.DataFrame()
    df_bowling_final = pd.concat(all_bowling_data, ignore_index=True) if all_bowling_data else pd.DataFrame()
    df_fielding_final = pd.concat(all_fielding_data, ignore_index=True) if all_fielding_data else pd.DataFrame()
    df_potm_final = pd.concat(all_potm_data, ignore_index=True) if all_potm_data else pd.DataFrame()

    # ✅ 6. Check if any data exists before proceeding
    if df_batting_final.empty and df_bowling_final.empty and df_fielding_final.empty and df_potm_final.empty:
        print("⚠️ No player data collected. Exiting.")
        return

    for batsman, full_name in zip(df_batting_final['Batsman'], df_batting_final['Full Name']):
        batsman_variations = create_name_variations(batsman)
        full_name_variations = create_name_variations(full_name)
        
        for variation in batsman_variations | full_name_variations:
            name_mapping[variation.lower()] = full_name

    # Update player names in fielding DataFrame
    df_fielding_final['Player'] = df_fielding_final['Player'].apply(
        lambda x: name_mapping.get(x.strip().lower(), x)
    )

    # Now drop the Batsman column
    df_batting_final = df_batting_final.drop('Batsman', axis=1)
    df_bowling_final = df_bowling_final.drop('Bowler', axis=1)

    # Display final DataFrames
    print("\nBatting Statistics (All Matches)")
    print(df_batting_final)
    print("\nBowling Statistics (All Matches)")
    print(df_bowling_final)
    print("\nFielding Statistics (All Matches)")
    print(df_fielding_final)
    if not df_potm_final.empty:
        print("\nPlayers of the Match")
        print(df_potm_final)

    leaderboard = calculate_points(df_batting_final, df_bowling_final, df_fielding_final, df_potm_final)

    # Prepare player points for Supabase
    df_player_points = leaderboard.rename(columns={
        "Full Name": "player_name",
        "Match_ID": "match_id",
        "Team": "team",
        "Batting_Points": "batting_points",
        "Bowling_Points": "bowling_points",
        "Fielding_Points": "fielding_points",
        "POTM_Points": "potm_points",
        "Fantasy_Points": "total_points"
    })[['match_id', 'player_name', 'team', 'batting_points', 'bowling_points', 'fielding_points', 'potm_points', 'total_points']]

    # ✅ 7. Insert Player Points into Database
    if not df_player_points.empty:
        insert_player_points(df_player_points)

    print("\nFinal Fantasy Points Leaderboard")
    print(leaderboard)

    print("\n🏏 Scraping complete!")

if __name__ == "__main__":
    main()
