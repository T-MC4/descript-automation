const deepgramApiKey = "4f89d81415d84b932642221f5f86a23b9416ee8b";

import axios from "axios";
import path from "path";
import fs from "fs";
import jq from "node-jq";

export async function transcribeDiarizedAudio(fileNameWithExtension) {
	// Set file path
	const filePath = path.join("./upload", fileNameWithExtension);

	// Set API endpoint and options
	const url =
		"https://api.deepgram.com/v1/listen?model=phonecall&tier=nova&diarize=true&punctuate=true&smart_format=true";
	const options = {
		method: "post",
		url: url,
		headers: {
			Authorization: `Token ${deepgramApiKey}`,
			"Content-Type": determineMimetype(fileNameWithExtension),
		},
		data: fs.createReadStream(filePath),
	};

	// get API response
	const response = await axios(options);
	const json = response.data; // Deepgram Response

	// IF &smart_format=FALSE in the url, then switch the comments of the two lines below
	// const data = transformTranscript(json);
	const data = createTranscriptArray(json);

	console.log("transcript array result:", data); // Grouping Results

	// IF &utterances=true is added to the url, then remove the comments below
	// const filter =
	// 	'[.results.utterances[] | {"speaker": .speaker, "transcript": .transcript}]';
	// const data = JSON.parse(await jq.run(filter, json, { input: "json" }));

	// Save the transcript
	const fileNameWithoutExtension = path.parse(fileNameWithExtension).name;
	fs.writeFileSync(
		`./transcripts/${fileNameWithoutExtension}.json`,
		JSON.stringify(data, null, 2)
	);

	// Return the transcript
	return data;
}

// const transcript = await transcribeDiarizedAudio(
// 	"REc4323a037cd0e2cde4f6bee845f598fb.mp3"
// );
// console.log(transcript);

function determineMimetype(file) {
	const extension = path.extname(file);
	switch (extension) {
		case ".wav":
			return "audio/wav";
		case ".mp3":
			return "audio/mpeg";
		case ".m4a":
			return "audio/mp4";
		// Add more cases as needed for different file types
		default:
			return "application/octet-stream"; // default to binary if unknown
	}
}

// Use this when smart_format=FALSE
function transformTranscript(data) {
	let currentSpeaker = null;
	let transcripts = [];
	let currentTranscript = "";

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
	let currentTranscript = "";

	paragraphs.forEach((paragraph, index) => {
		if (paragraph.speaker === currentSpeaker) {
			currentTranscript +=
				" " + paragraph.sentences.map((sentence) => sentence.text).join(" ");
		} else {
			transcriptArray.push({
				speaker: currentSpeaker,
				transcript: currentTranscript.trim(),
			});
			currentSpeaker = paragraph.speaker;
			currentTranscript = paragraph.sentences
				.map((sentence) => sentence.text)
				.join(" ");
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
