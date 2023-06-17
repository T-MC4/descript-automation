import { transcribeDiarizedAudio } from "./deepgram-transcribe.js";
import dotenv from 'dotenv'
dotenv.config();

const transcript = await transcribeDiarizedAudio("johnsnippet.mp3");

//console.log(transcript);
