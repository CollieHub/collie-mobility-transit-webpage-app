CREATE TABLE IF NOT EXISTS ads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT,
    redirect_url TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#FFE600',
    border TEXT NOT NULL DEFAULT '#E6CF00',
    text_color TEXT NOT NULL DEFAULT '#2D3277',
    display_order INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
