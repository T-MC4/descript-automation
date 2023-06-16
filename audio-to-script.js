import { transcribeDiarizedAudio } from "./deepgram-transcribe.js";

const transcript = await transcribeDiarizedAudio("thomas-bnb.mp3");

console.log(transcript);
