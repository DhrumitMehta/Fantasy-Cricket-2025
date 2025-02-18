-- Create matches table
CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    match_date TIMESTAMP WITH TIME ZONE NOT NULL,
    teams TEXT[] NOT NULL,
    venue TEXT NOT NULL,
    result TEXT,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create player_points table
CREATE TABLE player_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id TEXT REFERENCES matches(id),
    player_name TEXT NOT NULL,
    team TEXT NOT NULL,
    batting_points INTEGER DEFAULT 0,
    bowling_points INTEGER DEFAULT 0,
    fielding_points INTEGER DEFAULT 0,
    potm_points INTEGER DEFAULT 0,
    total_points INTEGER GENERATED ALWAYS AS 
        (batting_points + bowling_points + fielding_points + potm_points) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_match_date ON matches(match_date);
CREATE INDEX idx_player_points_match ON player_points(match_id); 