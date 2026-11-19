// Public description only. No hostnames, accounts, file paths or workplace detail.
const steps = [
 ['Press','Press REC as the meeting starts. The screen turns to a red RECORDING band and stays still until I stop, so nothing flickers in the room.'],
 ['It locks','Audio is encrypted on the device as it records, in one-minute pieces. The device holds only a public key, so it can lock a recording but never unlock it.'],
 ['One cable','Recordings leave only over a USB cable, to one paired laptop. The key that opens them lives in that laptop’s secure chip, where it cannot be copied out.'],
 ['The transcript lands','The laptop transcribes locally, splits the speakers and names them from the calendar invite and from introductions at the start. Anything uncertain is shown with a confidence level and short clips, and I confirm it. Nothing is filed until I approve. Audio never touches any network.']
];
const spec = [
 ['Board','Waveshare ESP32-S3 with 8 MB flash and 8 MB PSRAM, audio codec, onboard microphone, real-time clock and TF card slot'],
 ['Screen','1.54 in e-paper, 200 × 200 pixels, four colours. Status only: Ready, Recording, Saved or Discarded, card, key, clock and low-battery problems, and how many recordings wait to copy. One redraw per event, none during a recording'],
 ['Recording','16 kHz mono to the TF card, saved a minute at a time, three-hour cap. One REC button, one power button'],
 ['Battery','Single-cell LiPo, charged over USB-C. Designed to sleep between meetings and wake on a button press. Runtime not yet measured, so no figure is claimed'],
 ['Privacy','Encrypted on the device with an open standard (age), using a public key only. The device has no way to decrypt. Only the paired laptop can open a recording, and it transcribes with an open-source speech model on the laptop itself. Audio is never uploaded to any service'],
 ['Transfer','Over the USB cable only. The laptop checks each copy and confirms it before the device deletes anything. The firmware contains no Wi-Fi code, which can be checked in the binary'],
 ['Laptop app','A menu-bar app and background helper for the Mac: review pre-filled speaker names, answer “Is this person?” with short clips, approve each meeting, then file a private transcript and a private cloud copy. The menu shows the recorder’s battery level and an estimate of recording time left, which learns from the recorder’s battery readings after a few recordings'],
 ['Signal','The red RECORDING screen is the indicator. I record only with the room’s agreement']
];
export function renderMinutes(){return `<section class="minutes" aria-labelledby="minutes-how"><div class="minutes-intro"><h2 id="minutes-how">How it works.</h2><p>One button, four steps.</p></div><ol class="minutes-steps">${steps.map(([t,x],i)=>`<li><span class="minutes-step" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><h3>${t}</h3><p>${x}</p></li>`).join('')}</ol><div class="minutes-sheet"><h2 id="minutes-spec">Spec sheet.</h2><dl>${spec.map(([t,x])=>`<div><dt>${t}</dt><dd>${x}</dd></div>`).join('')}</dl><p class="minutes-status"><strong>Status: version 0.2 in use, November 2026.</strong> Encryption on the device, transfer over the cable and transcription on the laptop are tested end to end on the bench. I am preparing it as an open-source project that anyone can fork and reuse, with a walkthrough of the hardware and the software. The repository is not public yet.</p></div></section>`;}
