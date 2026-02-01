import { BasicPitch, noteFramesToTime, outputToNotesPoly } from "@spotify/basic-pitch";
import p5 from "p5";
import * as tf from "@tensorflow/tfjs";

new p5((p) => {
  let audio;
  let basicPitch;

  p.setup = () => {
    const input = p.createFileInput(displayType);
    input.position(0, 100);
    console.log("ready!");
  };

  function displayType(file) {
    p.text(`This is file's type is: ${file.type}`, 10, 10, 80, 80);
    if (file.type == "audio") {
      audio = file;
      playSound();
    }
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

    const resampledBuffer = await offlineCtx.startRendering();
    return resampledBuffer;
  }

  async function playSound() {
    const arrayBuffer = await audio.file.arrayBuffer();
    const context = new AudioContext();
    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    const resampledBuffer = await resampleAudioBuffer(audioBuffer, 22050);
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.start();

    if (!basicPitch) {
      const bpModel = await tf.loadGraphModel("/model/model.json");
      basicPitch = new BasicPitch(bpModel);
    }
    console.log(resampledBuffer.numberOfChannels);

    const allFrames = []
    const allOnsets = []
    const evaluate = await basicPitch.evaluateModel(
      resampledBuffer,
      (framesChunk, onsetsChunk) => {
        for (let frame of framesChunk) {
          allFrames.push(frame); //duration/sustain of note
        }
        for (let onset of onsetsChunk){
          allOnsets.push(onset); //when a new note begins
        }
      },
      (percent) => {
        console.log("percent" + Math.round(percent * 100));
      }
    );

    const noteEvents = noteFramesToTime(outputToNotesPoly(allFrames, allOnsets, 0.25, 0.25, 5))
    console.log(noteEvents) //outputs cool things!! most importantly pitchMidi!


  }
});
