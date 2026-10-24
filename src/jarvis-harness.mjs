// Public description only. Hostnames, accounts, file paths and private infrastructure stay out of this artifact.
const parts = [
 ['What it does','I send Jarvis a text, a voice note or a photo on Telegram, and it transcribes the audio, reads the image and suggests the page where it belongs. It answers questions from my notes inside a read-only sandbox and files nothing until I reply yes.'],
 ['What stays with me','My notes, each conversation page and a log with a line for every turn are plain Markdown files under Git, on a Raspberry Pi at home. The model reads them for a turn and never holds the only copy.'],
 ['Why it’s model-agnostic','Jarvis talks to the model through one narrow seam, and today OpenAI’s Codex CLI sits behind it. If I switch models, the tools, the notes and the conversation pages stay where they are.']
];
export function renderJarvisHarness(){return `<section class="jarvis-harness" aria-labelledby="jarvis-harness-title"><div class="jarvis-harness-intro"><h2 id="jarvis-harness-title">How Jarvis works.</h2><p>Version 2 is in development, October 2026.</p></div><ul class="jarvis-harness-parts">${parts.map(([title,text])=>`<li><h3>${title}</h3><p>${text}</p></li>`).join('')}</ul></section>`;}
