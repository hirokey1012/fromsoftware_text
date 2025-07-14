# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FromSoftware Text Extractor** - An advanced web scraper designed to extract flavor texts and item descriptions from FromSoftware game wikis. Supports multiple FromSoftware titles including Elden Ring, Dark Souls series, Bloodborne, and Sekiro.

## Commands

### Development
```bash
# Install dependencies
npm install

# Run the scraper (default: Elden Ring)
npm start

# Run scraper for specific games
npm run scrape:eldenring
npm run scrape:darksouls
npm run scrape:darksouls2
npm run scrape:darksouls3
npm run scrape:bloodborne
npm run scrape:sekiro

# Run scraper with custom URL
node scraper.js https://kamikouryaku.net/[game]/
```

### File Structure
- `scraper.js` - Main scraping logic for extracting flavor texts
- `viewer.html` - Web interface for viewing extracted data
- `package.json` - Project configuration
- `flavor_texts.json` - Output data in JSON format (generated)
- `flavor_texts.csv` - Output data in CSV format (generated)

## Architecture

### Core Components
- **FromSoftwareFlavorTextScraper**: Main scraper class handling data extraction for multiple games
- **Web Interface**: HTML/CSS/JS viewer for browsing results
- **Data Output**: JSON and CSV formats for extracted flavor texts

### Key Features
- Scrapes kamikouryaku.net wikis for multiple FromSoftware games
- Dynamic game detection from URL
- Extracts flavor text from item pages
- Outputs data in JSON and CSV formats
- Responsive web interface with search functionality
- Rate limiting to be respectful to target site
- Support for multiple games: Elden Ring, Dark Souls series, Bloodborne, Sekiro

### Data Structure
- Each item has: game, name, url, flavorText
- CSV Format: ゲーム,アイテム名,URL,フレーバーテキスト
- Game names are automatically detected from the source URL
- Categories: 道具, アイテム製作素材, 強化素材, 鈴玉, 貴重品, 絵画 (エルデンリング), 武器, 防具, アイテム (他ゲーム)

## Development Notes

- Uses Node.js with axios and cheerio
- 1-second delay between requests
- Handles encoding for Japanese URLs
- Graceful error handling for failed requests