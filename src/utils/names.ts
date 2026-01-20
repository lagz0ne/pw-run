const adjectives = [
  "happy", "calm", "swift", "bright", "quiet", "bold", "keen", "warm",
  "cool", "fair", "kind", "wise", "brave", "quick", "sharp", "clear",
  "fresh", "light", "soft", "pure", "neat", "prime", "true", "fine"
];

const nouns = [
  "fox", "bear", "owl", "wolf", "deer", "hawk", "lynx", "crow",
  "dove", "hare", "seal", "wren", "moth", "swan", "toad", "wasp",
  "crab", "goat", "lamb", "newt", "puma", "ram", "yak", "elk"
];

export function generateSessionName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}-${noun}`;
}

export function isValidSessionName(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name.includes("--")) return false;
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name);
}
