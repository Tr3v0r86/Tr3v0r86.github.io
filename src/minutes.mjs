// Public description only. No hostnames, accounts, file paths or workplace detail.
// Step screenshots use demo data only. Never mention voice learning.
const v = (name, widths) => widths.map(([w, h]) => ({src: `/media/${name}-${w}-${h}.webp`, width: w, type: 'image/webp'}));
export const stepMedia = {
 screen: {src:'/media/minutes-screen-recording-600-b571215f4e.webp',width:600,height:600,variants:v('minutes-screen-recording',[[480,'3e2937c8f1'],[600,'b571215f4e']]),pixel:true,
  alt:'E-paper screen with a red RECORDING band and STARTED 14:05 below it'},
 menu: {src:'/media/minutes-menu-transcribing-600-13a1ba102c.webp',width:600,height:380,variants:v('minutes-menu-transcribing',[[480,'4aa02d770f'],[600,'13a1ba102c']]),
  alt:'Mac menu-bar popover reading Transcribing a recording, about 11 min left, then Recorder 81 percent, about 6 h of recording left, 10 h when full'},
 review: {src:'/media/minutes-review-window-1100-10929f4a20.webp',width:1100,height:810,variants:v('minutes-review-window',[[480,'94ab37dde7'],[960,'aad26bbc15'],[1100,'10929f4a20']]),
  alt:'Review window for a meeting called Weekly Ops with guests Alice, Bob and Carol. Two yellow cards ask: Is this Carol, with Yes and No, and Who is this, with Alice, Bob and Carol buttons and a box to type a name'}
};
const steps = [
 ['Press REC','I press REC once the room has agreed. The e-paper screen turns to a red RECORDING band and stays still until I stop; it is the only recording indicator. The recorder writes 16 kHz mono to its card, up to three hours.','screen','The recording screen · rendered from the firmware'],
 ['Locked on device','Each minute is encrypted with age, an open standard, as it is written, using a public key only. The recorder holds nothing that can decrypt it, so it can lock a recording but never unlock it. Its firmware has no Wi-Fi code.'],
 ['Copy, then transcribe','One USB cable to one paired laptop. It copies and checks each recording before the recorder deletes anything, unlocks it with its Secure Enclave key, then transcribes locally with Whisper. The menu bar shows progress, recorder battery and a learned estimate of recording time left.','menu','Transcribing, with recording time left · screenshot, demo data'],
 ['Review and approve','Speakers arrive pre-named from the invite guests and the introductions. Where it is unsure, it asks “Is this Carol?” or “Who is this?” with short clips, and I tap an answer. Nothing is filed until I approve.','review','Two questions to answer · screenshot, demo data']
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
const intro = 'Four steps from the room to a transcript I have approved.';
export function renderMinutes({image, escape: e}){
 const fig = (key, caption) => { const m = stepMedia[key]; return `<figure class="minutes-shot minutes-shot--${key}"><div class="minutes-shot-frame">${image(m)}</div><figcaption>${e(caption)}</figcaption></figure>`; };
 return `<section class="minutes" aria-labelledby="minutes-how"><div class="minutes-intro"><h2 id="minutes-how">How it works.</h2><p>${e(intro)}</p></div><ol class="minutes-steps">${steps.map(([t,x,k,c],i)=>`<li${k?'':' class="minutes-step-text-only"'}><div class="minutes-step-copy"><span class="minutes-step" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><h3>${e(t)}</h3><p>${e(x)}</p></div>${k?fig(k,c):''}</li>`).join('')}</ol><div class="minutes-sheet"><h2 id="minutes-spec">Spec sheet.</h2><dl>${spec.map(([t,x])=>`<div><dt>${t}</dt><dd>${x}</dd></div>`).join('')}</dl><p class="minutes-status"><strong>Status: version 0.2 in use, November 2026.</strong> Encryption on the device, transfer over the cable and transcription on the laptop are tested end to end on the bench. I am preparing it as an open-source project that anyone can fork and reuse, with a walkthrough of the hardware and the software. The repository is not public yet.</p></div></section>`;
}
