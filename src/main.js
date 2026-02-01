import {
  BasicPitch,
  noteFramesToTime,
  outputToNotesPoly,
} from "@spotify/basic-pitch";
import p5 from "p5";
import * as tf from "@tensorflow/tfjs";

new p5((p) => {
  let audioFile;
  let basicPitch;
  let context;
  // C MAJOR
  const thesiaMapping = {
    '0': "#de2f23", '1' : "#9C4C39", '2' : "#d1ac27", '3' : '#5C994E', "4" : '#5daf42', "5" : "#b37f45", "6" : "#857168", "7" : "#3eb8d2", "8" : "#5368A3", "9" : "#b25c89", "10" : "#93729F", "11" : "#d29dac"
  }

  // todooo: thesia logic
  for (note in noteEvents) {
    pitchClass = note.pitchMidi % 12
    color = thesiaMapping[pitchClass]
  }


  p.setup = () => {
    p.createCanvas(400, 200);
    const input = p.createFileInput(displayType);
    input.position(0, 100);
    console.log("ready!");
  };

  function displayType(file) {
    p.text(`This is file's type is: ${file.type}`, 10, 10, 80, 80);
    if (file.type == "audio") {
      audioFile = file;
      runPipeline(audioFile);
    }
  }

  async function loadAudioBufferFromFile(file) {
    const arrayBuffer = await file.file.arrayBuffer();
    context = context ?? new AudioContext();
    return await context.decodeAudioData(arrayBuffer);
  }

  async function resampleAudioBuffer(audioBuffer, targetSampleRate) {
    const duration = audioBuffer.duration;

    const offlineCtx = new OfflineAudioContext(
      1,
      Math.ceil(duration * targetSampleRate),
      targetSampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    return await offlineCtx.startRendering();
  }

  async function getBasicPitch() {
    if (basicPitch) return basicPitch;

    const bpModel = await tf.loadGraphModel("/model/model.json");
    basicPitch = new BasicPitch(bpModel);
    return basicPitch;
  }

  async function extractNoteEvents(resampledBuffer) {
    const bp = await getBasicPitch();

    const allFrames = [];
    const allOnsets = [];
    await bp.evaluateModel(
      resampledBuffer,
      (framesChunk, onsetsChunk) => {
        for (let frame of framesChunk) {
          allFrames.push(frame); //duration/sustain of note
        }
        for (let onset of onsetsChunk) {
          allOnsets.push(onset); //when a new note begins
        }
      },
      (percent) => {
        console.log("percent: " + Math.round(percent * 100) + "%");
      }
    );

    return noteFramesToTime(
      outputToNotesPoly(allFrames, allOnsets, 0.25, 0.25, 5)
    ); //outputs cool things!! most importantly pitchMidi!
  }

  function playAudioBuffer(audioBuffer) {
    context = context ?? new AudioContext();
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.start();
    return source;
  }

  async function runPipeline(file) {
    const originalBuffer = await loadAudioBufferFromFile(file);
    const resampledBuffer = await resampleAudioBuffer(originalBuffer, 22050);
    const noteEvents = await extractNoteEvents(resampledBuffer);
    console.log(noteEvents);
    playAudioBuffer(originalBuffer); //TODO: add onClick event here or smth similar for optional playback
  }
});
