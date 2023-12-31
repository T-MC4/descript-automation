import dotenv from 'dotenv';

import axios from 'axios';
import path from 'path';
import fs from 'fs';
import jq from 'node-jq';

import ffmpeg from 'fluent-ffmpeg';
//console.log(ffmpeg.path, ffmpeg.version);

// Set the input file path
const inputFile = './upload/kras.mp3';

// Set the output file path
const outputFile = './processed-audio/processedkras.mp3';



/*
async function processAudioFile(inputFile, outputFile, startTime, duration) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputFile)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputFile)
      .on('end', () => {
        console.log('Audio processing completed.');
        resolve();
      })
      .on('error', (err) => {
        console.error('An error occurred:', err.message);
        reject(err);
      })
      .run();
  });
}

// Usage:

const startTime = 10; // Start time in seconds
const duration = 10; // Duration in seconds

processAudioFile(inputFile, outputFile, startTime, duration)
  .catch(error => console.error('An error occurred:', error));
*/

export async function transcribeDiarizedAudio(fileNameWithExtension) {
    const deepgramApiKey = process.env.deepgramApiKey;

    // Set file path
    const filePath = path.join('./upload', fileNameWithExtension);

    // Set API endpoint and options
    const url =
        'https://api.deepgram.com/v1/listen?model=general&tier=nova&diarize=true'
    const options = {
        method: 'post',
        url: url,
        headers: {
            Authorization: `Token ${deepgramApiKey}`,
            'Content-Type': determineMimetype(fileNameWithExtension),
        },
        data: fs.createReadStream(filePath),
    };
try{
    // get API response
    const response = await axios(options);
    const json = response.data; // Deepgram Response
    


    // IF &smart_format=FALSE in the url, then switch the comments of the two lines below
     const data = transformTranscript(json);
     const audioSegments = extractSpeakerChunks(json.results.channels[0])  // REPLACE THIS WITH FUNCTION THAT CREATES SEGMENTATION INFO
     processAudioSegments(filePath, audioSegments, outputFile)
     .catch(error => console.error('An error occurred:', error));
    //console.log('transcript array result:', data); // Grouping Results

    // IF &utterances=true is added to the url, then remove the comments below
    // const filter =
    // 	'[.results.utterances[] | {"speaker": .speaker, "transcript": .transcript}]';
    // const data = JSON.parse(await jq.run(filter, json, { input: "json" }));

    // Save the transcript
    const fileNameWithoutExtension = path.parse(fileNameWithExtension).name;
    fs.writeFileSync(
        `./segmentation-info/${fileNameWithoutExtension}.json`,
        JSON.stringify(data, null, 2)
    );

    // Return the transcript
    return data;}
    catch(error){
        console.error('An error occurred:', error);

    }
}







function extractSpeakerChunks(transcriptJson) {
    let currentSpeaker = transcriptJson.alternatives[0].words[0].speaker;
    let extractedChunks = [];
    let currentChunk = {
      start: transcriptJson.alternatives[0].words[0].start,
      duration: 0,
      end: transcriptJson.alternatives[0].words[0].end
    };
  
    transcriptJson.alternatives[0].words.forEach((word) => {
      if (word.speaker === currentSpeaker) {
        // Speaker remains the same, update the end time of the current chunk
        currentChunk.end = word.end;
      } else {
        // Speaker changed, push the current chunk and start a new one
        extractedChunks.push(currentChunk);
        currentSpeaker = word.speaker;
        currentChunk = {
          speaker: currentSpeaker,
          start: word.start,
          duration: 0,
          end: word.end
        };
      }
    });
  
    // Push the last chunk
    extractedChunks.push(currentChunk);
  
    return extractedChunks;
  }
  
  async function processAudioSegments(inputFile, timestamps, outputFile) {
    const segments = [];
  
    // Cut audio segments
    for (let i = 0; i < timestamps.length; i++) {
      const segment = timestamps[i];
      const { start, speaker , end} = segment;
      const segmentOutputFile = `segment_${i}.mp3`;
      if(speaker===1){
      await new Promise((resolve, reject) => {
        ffmpeg(inputFile)
          .setStartTime(start)
          .setDuration(end-start)
          .output(segmentOutputFile)
          .on('end', () => {
            segments.push(segmentOutputFile);
            resolve();
          })
          .on('error', (err) => {
            reject(err);
          })
          .run();
      });}
    }

    // Concatenate audio segments
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input('concat:' + segments.join('|'))
        .output(outputFile)
        .on('end', () => {
          // Clean up temporary segment files
          segments.forEach((segment) => fs.unlinkSync(segment));
          resolve();
        })
        .on('error', (err) => {
          reject(err);
        })
        .run();
    });
}
  

// const transcript = await transcribeDiarizedAudio(
// 	"REc4323a037cd0e2cde4f6bee845f598fb.mp3"
// );
// console.log(transcript);

function determineMimetype(file) {
    const extension = path.extname(file);
    switch (extension) {
        case '.wav':
            return 'audio/wav';
        case '.mp3':
            return 'audio/mpeg';
        case '.m4a':
            return 'audio/mp4';
        // Add more cases as needed for different file types
        default:
            return 'application/octet-stream'; // default to binary if unknown
    }
}

// FUNCTION FOR CREATING SEGMENTATION INFO
//
// PLACE CODE HERE
//

// Use this when smart_format=FALSE
function transformTranscript(data) {
    let currentSpeaker = null;
    let transcripts = [];
    let currentTranscript = '';

    data.results.channels[0].alternatives[0].words.forEach(
        (wordInfo, index, array) => {
            if (currentSpeaker === null) {
                currentSpeaker = wordInfo.speaker;
            }

            if (wordInfo.speaker === currentSpeaker) {
                currentTranscript += `${wordInfo.word} `;
            } else {
                transcripts.push({
                    speaker: currentSpeaker,
                    transcript: currentTranscript.trim(),
                });

                currentSpeaker = wordInfo.speaker;
                currentTranscript = `${wordInfo.word} `;
            }

            if (index === array.length - 1) {
                transcripts.push({
                    speaker: currentSpeaker,
                    transcript: currentTranscript.trim(),
                });
            }
        }
    );

    return transcripts;
}

// Use this when smart_format=TRUE
function createTranscriptArray(response) {
    const paragraphs =
        response.results.channels[0].alternatives[0].paragraphs.paragraphs;

    const transcriptArray = [];
    let currentSpeaker = paragraphs[0].speaker;
    let currentTranscript = '';

    paragraphs.forEach((paragraph, index) => {
        if (paragraph.speaker === currentSpeaker) {
            currentTranscript +=
                ' ' +
                paragraph.sentences.map((sentence) => sentence.text).join(' ');
        } else {
            transcriptArray.push({
                speaker: currentSpeaker,
                transcript: currentTranscript.trim(),
            });
            currentSpeaker = paragraph.speaker;
            currentTranscript = paragraph.sentences
                .map((sentence) => sentence.text)
                .join(' ');
        }

        // Make sure to add the last transcript
        if (index === paragraphs.length - 1) {
            transcriptArray.push({
                speaker: currentSpeaker,
                transcript: currentTranscript.trim(),
            });
        }
    });

    return transcriptArray;
}
