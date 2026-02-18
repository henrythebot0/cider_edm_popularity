export async function fetchBeatport() {
  // TODO: Add robust, polite scraping or official source ingestion.
  // Keep this adapter keyless and resilient to layout changes.
  return {
    sourceName: "beatport",
    sourceUrl: "https://www.beatport.com/charts",
    tracks: []
  };
}
