// Public description only. No hostnames, accounts, file paths or workplace detail.
const steps = [
 ['Press','Press REC as the meeting starts. The red light comes on and the screen shows REC with the meeting from my calendar.'],
 ['It records','Audio saves to the card in one-minute pieces. The e-paper screen holds the state with no power, so a glance shows it is still listening.'],
 ['The transcript lands','Back on home Wi-Fi it uploads to a small server at home that transcribes it locally. The transcript files privately into my notes, and a view-only cloud copy goes quietly to invited colleagues when the meeting match is certain; anything uncertain waits for my OK.']
];
const spec = [
 ['Board','ESP32-S3 with 8 MB flash and 8 MB PSRAM, audio codec, onboard microphone and real-time clock'],
 ['Screen','1.54 in e-paper, 200 × 200 pixels, four colours: black, white, red and yellow'],
 ['Recording','16 kHz mono to a microSD card, saved a minute at a time, three-hour cap'],
 ['Battery','Single-cell LiPo, charged over USB-C. Runtime not yet measured'],
 ['Privacy','Transcribed locally at home with an open-source speech model. Audio is never uploaded to a cloud service and leaves the card once home confirms it has it. The finished transcript does leave home as a cloud document'],
 ['Sharing','The transcript is shared as a view-only cloud document, with no notification email, only to known people on the invite and only when the match is certain. Uncertain matches, unlisted guests and unscheduled recordings wait for my approval or stay private'],
 ['Signal','Red light on exactly while the microphone is capturing. I record only with the room’s agreement']
];
export function renderMinutes(){return `<section class="minutes" aria-labelledby="minutes-how"><div class="minutes-intro"><h2 id="minutes-how">How it works.</h2><p>One button, three steps.</p></div><ol class="minutes-steps">${steps.map(([t,x],i)=>`<li><span class="minutes-step" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><h3>${t}</h3><p>${x}</p></li>`).join('')}</ol><div class="minutes-sheet"><h2 id="minutes-spec">Spec sheet.</h2><dl>${spec.map(([t,x])=>`<div><dt>${t}</dt><dd>${x}</dd></div>`).join('')}</dl><p class="minutes-status"><strong>Status: in development, November 2026.</strong> The screen driver runs on the board. Recording, upload and transcription are being built now.</p></div></section>`;}
