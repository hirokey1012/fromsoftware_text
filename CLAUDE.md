# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FromSoftware Text Extractor** - An advanced web scraper designed to extract flavor texts and item descriptions from FromSoftware game wikis. Currently supports Elden Ring with plans to expand to other FromSoftware titles like Dark Souls, Bloodborne, and Sekiro.

## Commands

### Development
```bash
# Install dependencies
npm install

# Run the scraper
npm start
```

### File Structure
- `scraper.js` - Main scraping logic for extracting flavor texts
- `viewer.html` - Web interface for viewing extracted data
- `package.json` - Project configuration
- `flavor_texts.json` - Output data in JSON format (generated)
- `flavor_texts.csv` - Output data in CSV format (generated)

## Architecture

### Core Components
- **EldenRingFlavorTextScraper**: Main scraper class handling data extraction
- **Web Interface**: HTML/CSS/JS viewer for browsing results
- **Data Output**: JSON and CSV formats for extracted flavor texts

### Key Features
- Scrapes kamikouryaku.net Elden Ring wiki
- Extracts flavor text from item pages
- Outputs data in JSON and CSV formats
- Responsive web interface with search functionality
- Rate limiting to be respectful to target site

### Data Structure
- Each item has: game, category, name, flavorText
- CSV Format: 作品名,アイテムカテゴリ,アイテム名,フレーバーテキスト
- Categories: 道具, アイテム製作素材, 強化素材, 鈴玉, 貴重品, 絵画 (エルデンリング), 武器, 防具, アイテム (他ゲーム)

## Development Notes

- Uses Node.js with axios and cheerio
- 1-second delay between requests
- Handles encoding for Japanese URLs
- Graceful error handling for failed requests