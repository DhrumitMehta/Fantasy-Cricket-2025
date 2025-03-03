from fastapi import FastAPI
import requests
from bs4 import BeautifulSoup

app = FastAPI()

# Function to scrape player points from Cricbuzz (Example URL)
def scrape_player_points():
    url = "https://www.cricbuzz.com/live-cricket-scorecard/112680"  # Replace with real match URL
    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")
    
    players = {}

    # Example scraping logic (modify based on Cricbuzz/CricClubs structure)
    for player_row in soup.find_all("div", class_="cb-col cb-col-100 cb-scrd-itms"):
        name_tag = player_row.find("a", class_="cb-text-link")
        points_tag = player_row.find("div", class_="cb-col cb-col-8 text-right")
        
        if name_tag and points_tag:
            name = name_tag.text.strip()
            points = int(points_tag.text.strip())
            players[name] = points

    return players

@app.get("/players/points")
def get_player_points():
    points_data = scrape_player_points()
    return {"players": points_data}
