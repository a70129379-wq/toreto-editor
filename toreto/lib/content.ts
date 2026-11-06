// All site copy and media live here. Edit this file to change the site's content.

export type Film = {
  id: string;
  title: string;
  discipline: string;
  note: string;
  length: string;
  ratio: "16 / 9" | "9 / 16";
  accent: string;
  full: string;
};

const film = (id: string, title: string, discipline: string, note: string, length: string, ratio: Film["ratio"], accent: string): Film => ({
  id,
  title,
  discipline,
  note,
  length,
  ratio,
  accent,
  full: `/media/${id}.mp4`,
});

// The edits, in the order the camera reaches them. Accent is the colour each one lights the void with.
export const films: Film[] = [
  film("film", "Film Edit", "Long-form Storytelling", "A 12-minute story cut.", "11:52", "16 / 9", "#ff7a2f"),
  film("cars", "Cars Edit", "Kinetic Type", "Speed, type and every cut on the beat.", "0:40", "9 / 16", "#ff2a3c"),
  film("pg", "PG: Untold Story", "Cinematic Documentary", "Mood, pacing and a story told in the dark.", "1:10", "16 / 9", "#3b7bff"),
  film("redbull", "Red Bull Edit", "Motion Graphics", "Type and product moving as one.", "0:12", "9 / 16", "#ffc62e"),
  film("grade", "Cinematic Colour Grade", "Colour", "Sky, leaves and lyrics in one graded mood.", "0:14", "16 / 9", "#3fe0c0"),
  film("viral", "Viral Reel", "Short Form", "Eight seconds, built to be replayed.", "0:08", "9 / 16", "#c44bff"),
  film("intro", "Toreto Intro", "Logo Animation", "My own channel intro.", "0:08", "16 / 9", "#ff4d8d"),
  film("bjp", "BJP Reel", "Political Short", "Big national moments, cut fast for Instagram.", "0:15", "9 / 16", "#ffa63d"),
];

// Web3Forms access key: sends project requests to Toreto's inbox. It is safe in public code,
// because it can only send messages to that inbox.
export const contactEmail = "a70129379@gmail.com";
export const formKey = "2e8d7a39-1fbe-4e11-a4e9-5620207db51d";

export const rotating = ["Film edits", "Car edits", "Motion graphics", "Colour grades", "Viral reels"];

export const skills = [
  { title: "Story Cut", kana: "映", body: "Long-form edits built on structure and pacing, so a 12-minute film still holds. Then one graded mood across every shot." },
  { title: "Beat Sync", kana: "拍", body: "Every cut and every word aimed at the beat, and landing on it. Kinetic type included." },
  { title: "Motion and Sound", kana: "動", body: "Screens, products and type moving together, finished with the sound that sells the hit." },
];

export const process = [
  { title: "Send the footage", body: "Your clips, references and the feeling you want." },
  { title: "First cut", body: "Structure and pacing first, before any polish." },
  { title: "Your notes", body: "You watch it and tell me what to change." },
  { title: "Final delivery", body: "Colour, sound and effects locked, exported for your platform." },
];

export const youtube = "https://www.youtube.com/@toretonotur";
