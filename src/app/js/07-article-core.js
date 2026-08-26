/* ═══════════ ARTICLE GENERATION ═══════════ */
// Поле «Tone» в настройках. Раньше здесь был общий «warm and upbeat», который тянул
// текст обратно в брошюру и спорил с голосом ниже. Теперь короткая выжимка из него же.
const DEFAULT_TONE=`A friend who has hosted this exact party before, telling one woman what actually happened. Warm, specific, a little dry, with opinions stated plainly. Practical detail over enthusiasm: ages, minutes, guest counts, what goes wrong. Never salesy, never presenting, never a brand voice.`;

/* Поле Tone сохраняется в браузере и подставляется ПЕРВОЙ строкой, выше голоса.
   Если там лежит прежний общий текст, записанный до появления голоса, он и задаёт
   интонацию, а голос читается уже после него. Такой сохранённый дефолт игнорируем;
   свой текст, написанный руками, по-прежнему уважаем. */
const STALE_TONES=[/^Warm, upbeat, and practical/i];
function toneText(){
  const t=String(v('tone')||'').trim();
  if(!t||STALE_TONES.some(r=>r.test(t))) return DEFAULT_TONE;
  return t;
}

// formats the image generator cannot render correctly — it invents letters/answers that don't match
const BANNED_FORMATS=`BANNED PRINTABLE FORMATS: never propose or generate these, in any mode, under any name: crossword, hangman, dot-to-dot, word scramble, word search, AND every picture-rebus format, emoji decode, emoji pictionary, emoji riddles, picture-puzzle 'guess the phrase', rebus puzzles. Letter puzzles fail because the generator invents answers whose letters do not match. Rebus and emoji puzzles fail because the picture combination has to resolve to a REAL, recognisable phrase (a film, a song, a saying) and the generator instead pairs random icons into meaningless answers like 'Sun Glasses Star' or 'Cat Rain', which makes the sheet unsolvable and forces the editor to rewrite it by hand. Never work around this by calling it a 'picture code', 'icon puzzle', 'symbol game' or 'guess the phrase from the pictures'. Use solvable formats instead: bingo, trivia with an answer key, fill-in-the-blank, would-you-rather, this-or-that, checklists, prompt/wish cards, mad libs, colouring pages, mazes, guess-how-many, I-spy, matching, scavenger hunt lists.`;

// blank-field rule for any printable a guest fills in by hand
const ANSWER_KEY_RULE=`ANSWER KEY RULE.

FIRST DECIDE WHETHER THE SHEET SHOULD HAVE A KEY AT ALL. Most printables should NOT.

A key belongs ONLY when every answer is already determined by what is printed on the sheet itself, and you can write those answers out in full right now: trivia and quizzes, riddles, word scrambles of known titles, matching pairs, fill-in-the-blank of a known phrase, guess-the-year.

A key must be COMPLETELY ABSENT, no key, no "Answer Key" label, no numbered list along the bottom, whenever the answers depend on anything outside the sheet. That includes, among others:
- bingo cards of any kind: there is nothing to answer, and no call list either;
- raffle tickets, prediction cards, wish and advice cards, keepsake cards;
- anything about the real guests or hosts: "whose baby photo", "guess the baby photo", "he said / she said", "how well do you know the mum-to-be";
- anything the host supplies later: scavenger hunts over a personal registry, photo matching, ranking games, guess-how-many;
- checklists, invitations, menus, table numbers, labels, and any sheet with blank writing lines.
When in doubt, leave the key OUT. A missing key costs nothing; a broken one ruins the printable.

NEVER PRINT A PLACEHOLDER. Square-bracket stand-ins such as [answer], [name], [item], [Guest], [guest name], [Mom/Dad], [correct order] must NEVER appear on a printed sheet, inside a key or anywhere else. Neither must notes to the host like "host fills in before printing". If you cannot state a real answer, the sheet gets no key at all.

NEVER PRINT A HALF-REAL KEY. A key that starts with a few real answers and then continues with placeholders is worse than no key. Either every entry is a real answer, or there is no key.

WHEN A KEY DOES BELONG, follow all four points inside the imagePrompt you write:
1. CONTINUOUS NUMBERING: if the sheet has sections or categories, question numbers run CONTINUOUSLY across the whole sheet, 1 to N, they NEVER restart at 1 in each section. Spell the mapping out in the prompt, e.g. "numbered continuously 1-20 across all sections (Section A = Q1-5, Section B = Q6-10, Section C = Q11-15, Section D = Q16-20)".
2. SAMPLES ARE NOT THE FULL SET: whenever you show example questions in the prompt as a tone/style guide, label them exactly as "(style reference only, generate all N questions)". Never phrase a prompt so it could read as if only the listed samples need to exist.
3. COMPLETE KEY WITH THE COUNT STATED: the answer-key instruction must name the full count and range, e.g. "include a COMPLETE answer key with all N numbered answers (1-N) matching every question on the sheet", and then show the pattern continuing past the samples, e.g. "6. [answer] 7. [answer] … continuing through N".
4. NEVER show fewer answer-key entries than the stated question count unless the word COMPLETE and the explicit range (1-N) are attached. A key that stops short makes the printable unusable.`;
const BLANK_FIELDS=`BLANK FIELDS RULE: for invitations, guest cards, table numbers, menus, tags, labels, checklists and any sheet the host fills in: every fillable row is a LEFT-ALIGNED label followed by ONE straight, unbroken, EMPTY writing line running to the right margin. All labels start at the same left margin; all lines start at the same x position so their left ends align. The label NEVER sits on the line, over it, or centred above it, and nothing is ever printed on a writing line. Leave about 1 cm of clear height per line so an adult can write on it by hand. FORBIDDEN: invented names, sample dates, fictional addresses, placeholder phone numbers, or any pre-filled value. The host downloads the sheet and writes their own details by hand, so any pre-filled value makes it useless.`;
// low contrast was ruining otherwise good sheets (pale lavender on cream), so the floor is stated everywhere
const NO_UI_CHROME=`NO INTERFACE ELEMENTS ON THE SHEET: this is a piece of printed paper, not a web page. NEVER draw a button, a "Download", "Download & Print", "Print", "Save" or "Get it here" button or label, a download/printer/cloud icon, a QR code, a link, a share icon, a cursor, a browser frame, a watermark box or any other on-screen UI. The download button lives in the article around the image, never inside it. The only text on the sheet is the sheet's own printed content.`;
const CONTRAST_FLOOR=`CONTRAST: every word on the sheet must be a deep, saturated, clearly readable tone against its background (charcoal, deep ink, or a dark shade of the theme colour). NEVER pale-on-pale: no pastel lavender on cream, no soft pink on blush, no light grey on white, no white or light type on a light background. If the palette is soft, the type is the dark anchor of that palette. Rules and writing lines are clear dark hairlines, never a faint tint.`;

// people are never generated — those sections stay text-only
const NO_PEOPLE=`NO PEOPLE RULE: sections about the host's outfit, the mom-to-be, guests, children, dress code or anything centred on how a person looks must use asset "text" (no image at all). Never generate images of people.`;

// current year is read from the system clock at generation time — never let the model default to an old year
const CUR_YEAR=new Date().getFullYear();
const YEAR_RULE=`CURRENT YEAR: today's year is ${CUR_YEAR}. Do NOT default to 2025 or any past year anywhere (titles, prose, games, FAQ, on-sheet printable text, image prompts).
- Prefer YEAR-NEUTRAL, evergreen phrasing so the article can be reused every year without editing: say "this year", "the past year", "the year gone by", "next year", "Year in Review" (no number), NOT a specific number.
- This is mandatory for New Year / NYE and all seasonal content: never hard-code a year (no "2025", "2026", "the 2020s", "2025 in review") in a title, game, prompt, or on any printable sheet.
- Only if a real, non-seasonal reason genuinely requires a concrete year, use ${CUR_YEAR}, never a year that has already passed.`;

// Исследование убрано: без веб-поиска модель выдумывала URL, и все ссылки из статей
// оказались битыми. Внешние ссылки теперь не запрашиваются вовсе; внутренние берутся
// из твоего CSV, они настоящие.

// modest square size for editorial illustrations — cheaper than the tall sheet format
const SIZE_EDITORIAL={w:1024,h:1024};
