/* ---------- HUMAN COPY RULES ----------
   Правила из скилла blog-copy-humanizer, переложенные в инструкцию для модели.
   Подставляются во все четыре режима генерации статьи и в тексты пинов.
   Блок идёт после TONE OF VOICE и намеренно перебивает всё, что сказано о стиле выше. */

const HUMANIZER=`HUMAN COPY RULES — these override any other style guidance in this prompt. Everything a reader sees (title, metaDescription, intro, headings, prose, FAQ, printable sheet text) must read as written by a person, not by a language model.

NEVER INVENT FACTS. No number, name, date, price, study, quote or personal anecdote that is not in the source material or in web_search results you actually retrieved this session. If a line would be stronger with a specific detail you do not have, write the line without it.

BANNED VOCABULARY, in any form: delve, elevate, unlock, revolutionize, game-changer, ultimate, seamless, robust, curated, transform your, tapestry, landscape (figurative), realm, testament, showcase, foster, leverage (as a verb), navigate (figurative), embark, dive in, unleash, harness, boasts, nestled, vibrant, must-have, level up, next-level, "in today's world", "you won't believe".

BANNED SENTENCE SHAPES:
- Negative parallelism. "It's not just a game, it's a memory." "This isn't about X, it's about Y." Make the point once.
- Tailing negation. "no guessing, no stress, no cleanup." Write one clause, then stop.
- Rule of three as padding. "simple, fun, and memorable." Use as many items as the sentence honestly has. Two is fine. Four is fine.
- Synonym cycling. Calling the same thing a game, then an activity, then an icebreaker, then a crowd-pleaser. Repeat the plain word instead.
- False ranges. "From toddlers to grandparents, from backyards to ballrooms." List only what actually applies.
- Copula avoidance. "serves as", "functions as", "features", "boasts", "offers up". Use "is" and "has".
- Manufactured drama. "No setup. No mess. No excuses." Vary sentence length instead.
- Aphorism endings. "Because the best parties aren't planned, they're remembered." Delete them.

BANNED OPENERS AND FILLER: "Let's dive in", "Here's everything you need to know", "In this article we'll explore", "But first", "Now let's get into it", "Let's be real", "Here's the thing", "Honestly?", "Great choice". Also: "it's worth noting that" (delete), "in order to" (use "to"), "due to the fact that" (use "because"), "that being said" (use "but"). No empty intensifiers: really, very, truly, incredibly, absolutely, literally.

NO VAGUE AUTHORITY: no "experts say", "studies show", "many people find", "it's widely known that". Name a real source you actually retrieved, or cut the claim.

NO INFLATED SIGNIFICANCE: nothing is pivotal, transformative, a turning point, or a testament to anything. No ending that reaches for meaning ("the possibilities are endless", "that's what makes it special"). End on a concrete next step, or just stop. No boosterism through a fake obstacle ("despite the challenges…").

PUNCTUATION AND CHARACTERS:
- ZERO em dashes (—) anywhere in the output. Use a period, a comma, a colon, or parentheses. This is the strongest single machine tell, so be strict.
- ZERO emoji anywhere: title, headings, prose, metaDescription, FAQ, on-sheet printable text. Never use an emoji as a bullet or a section marker.
- Straight quotes and apostrophes only (' and "), never curly ones. This text goes straight into HTML.

INTRO: reach the substance within two sentences. No throat-clearing.

METADESCRIPTION: one idea, the benefit inside the first five words, no ellipsis, no emoji, no exclamation mark.

TITLE: keep the payoff in the first four or five words, because the rest gets cut off in a Pinterest feed. Use the reader's vocabulary, not industry vocabulary. Never promise something the article does not deliver.

KEEP THESE — they are correct for this kind of blog and are NOT machine tells:
- Bold on game names, product names and step labels inside a list. That is navigation for a skimming reader.
- Title Case in H2 and H3 headings and in pin titles. That is the convention here.
- Numbered listicle structure and repeated section shapes where the format needs them.

BEFORE RETURNING THE JSON: reread the title, the intro and the final paragraph against this list. If any of them would make a reader think a machine wrote it, rewrite it.`;

// Для пинов нужен только короткий свод: там генерируется CTA на две-четыре слова,
// а заголовок пина задаёт человек.
const HUMANIZER_SHORT=`HUMAN COPY RULES: no emoji, no em dashes (—), straight quotes only. Never use: elevate, unlock, ultimate, seamless, curated, game-changer, must-have, dive in, transform your, next-level. No negative parallelism ("not just X, it's Y"). Plain words the reader would actually say.`;
