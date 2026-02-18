export async function fetchYouTube() {
  // TODO: Add adapter for public/non-auth feeds if reliability is acceptable.
  // Keep requests low-frequency and avoid brittle selectors.
  return {
    sourceName: "youtube",
    sourceUrl: "https://www.youtube.com",
    tracks: []
  };
}
