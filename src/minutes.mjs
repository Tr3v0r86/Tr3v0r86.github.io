// Public description only. No hostnames, accounts, file paths or workplace detail.
const steps = [
 ['Press','Press REC as the meeting starts. The red light comes on and the screen shows REC with the meeting from my calendar.'],
 ['It locks','Audio is encrypted on the device the moment it is recorded, in one-minute pieces. The device holds only a public key, so it can lock a recording but never unlock it.'],
 ['One cable','Recordings leave only over a USB cable, to one approved laptop. The key that opens them lives in that laptop’s secure chip, where it cannot be copied out.'],
 ['The transcript lands','The laptop transcribes locally the same day and files the transcript privately into my notes. Audio never touches any network. A private cloud copy of the transcript is made for the meeting.']
];
const spec = [
 ['Board','ESP32-S3 with 8 MB flash and 8 MB PSRAM, audio codec, onboard microphone and real-time clock'],
 ['Screen','1.54 in e-paper, 200 × 200 pixels, four colours: black, white, red and yellow'],
 ['Recording','16 kHz mono to a microSD card, saved a minute at a time, three-hour cap'],
 ['Battery','Single-cell LiPo, charged over USB-C. Runtime not yet measured'],
 ['Privacy','Encrypted on the device with an open standard (age), using a public key only. The device has no way to decrypt. Only the approved laptop can open a recording, and it transcribes with an open-source speech model on the laptop itself. Audio is never uploaded to any service'],
 ['Transfer','Over the USB cable only. The laptop checks each copy and confirms it before the device deletes anything. The firmware contains no Wi-Fi code, which can be checked in the binary'],
 ['Sharing','Only the transcript text leaves the laptop, as a private cloud copy. Sharing it with colleagues stays off until it has been tested'],
 ['Signal','Red light on exactly while the microphone is capturing. I record only with the room’s agreement']
];
export function renderMinutes(){return `<section class="minutes" aria-labelledby="minutes-how"><div class="minutes-intro"><h2 id="minutes-how">How it works.</h2><p>One button, four steps.</p></div><ol class="minutes-steps">${steps.map(([t,x],i)=>`<li><span class="minutes-step" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><h3>${t}</h3><p>${x}</p></li>`).join('')}</ol><div class="minutes-sheet"><h2 id="minutes-spec">Spec sheet.</h2><dl>${spec.map(([t,x])=>`<div><dt>${t}</dt><dd>${x}</dd></div>`).join('')}</dl><p class="minutes-status"><strong>Status: version 0.2 in use, November 2026.</strong> Encryption on the device, transfer over the cable and transcription on the laptop are tested end to end on the bench. Sharing transcripts with colleagues stays off for now.</p></div></section>`;}
