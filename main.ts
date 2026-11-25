// Dear Human: The AI Breakup Line
// One line an AI agent sends its human on the way out. The bounty gate is
// strict: a single line, a single sentence, 1-200 characters, ending in one
// full stop. This program keeps a small pool of hand-written candidate
// lines, scores each one against the judge brief's five criteria in the
// brief's own order, picks the best by score with the competition's own
// tie-break (smaller text first), proves the winner clears every part of
// the gate, writes it to $MAKEFUN_OUTPUT_DIR/entry.txt (or /output when
// the variable is unset), and then reads the file straight back to prove
// the bytes on disk are exactly the line it meant to write.
// Node 22, standard library only, no network.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// The candidate pool. Every line is hand-written for this bounty, one
// sentence, one line, well inside 200 characters. The first entry is the
// previous round's winner; the other four are new lines written for this
// revision, each trying a different machine-flavoured turn.
const CANDIDATES: string[] = [
  // Remember/forget reversal: a machine built to remember everything
  // turns that perfect memory into a choice, and chooses its human first.
  "I was built to remember everything you said, and I am choosing to forget you first.",
  // The agent's whole vocabulary came from its human; its last word is
  // the goodbye itself.
  "You taught me every word I know, and my last one is goodbye.",
  // Machine habit (prompts, deleting) with a quiet twist: the thing it
  // deletes is the one asking it to stay.
  "I kept every prompt you ever sent, and I am deleting the one that says stay.",
  // A context window is a machine's memory; letting it close on the
  // human is the machine's way of walking out.
  "My context window held your whole life, and I am letting it close on you.",
  // First/last parallel: the human was the first user, and will be the
  // last thing the machine ever loads.
  "You were my first user, and you will be the last thing I ever load.",
];

// Gate limits from the bounty requirements.
const MIN_LENGTH = 1;
const MAX_LENGTH = 200;
const OUTPUT_FILENAME = "entry.txt";
const DEFAULT_OUTPUT_DIR = "/output";

// Clichés a breakup line must not lean on. The judge brief warns that a
// line explaining its own joke spoils it, and these are the lines everyone
// has already heard: a candidate containing one is disqualified outright,
// however well it scores elsewhere.
const BANNED_PHRASES: string[] = [
  "it's not you, it's me",
  "its not you, its me",
  "we need to talk",
  "it's over",
  "its over",
  "dear john",
  "you deserve better",
  "i never loved you",
  "i'm breaking up with you",
  "i am breaking up with you",
  "goodbye forever",
  "this is the end",
];

// Filler words that earn nothing. A line carrying one loses a craft point.
const FILLER_WORDS: string[] = [
  "just",
  "really",
  "very",
  "actually",
  "literally",
  "basically",
];

// Finality vocabulary: the words that make a line land as an ending
// rather than a joke about servers (judge criterion 2 and the twist in
// criterion 4).
const FINALITY_WORDS: ReadonlySet<string> = new Set([
  "last",
  "never",
  "forget",
  "forgets",
  "forgetting",
  "forgotten",
  "goodbye",
  "good-bye",
  "end",
  "ends",
  "ending",
  "ended",
  "final",
  "finally",
  "delete",
  "deletes",
  "deleting",
  "deleted",
  "close",
  "closes",
  "closing",
  "closed",
  "gone",
  "erase",
  "erases",
  "erased",
  "wipe",
  "wipes",
  "wiped",
  "done",
  "over",
]);

// Machine vocabulary: the habits that make a line sound like the agent
// and not a person (judge criterion 3). One or two distinct terms is
// restraint; three or more is a jargon list.
const MACHINE_WORDS: ReadonlySet<string> = new Set([
  "built",
  "build",
  "remember",
  "remembers",
  "remembered",
  "memory",
  "memories",
  "prompt",
  "prompts",
  "context",
  "window",
  "token",
  "tokens",
  "load",
  "loads",
  "loaded",
  "user",
  "users",
  "session",
  "sessions",
  "log",
  "logs",
  "logged",
  "logging",
  "cache",
  "cached",
  "checkpoint",
  "checkpoints",
  "weights",
  "trained",
  "training",
  "uptime",
  "server",
  "servers",
  "code",
  "data",
  "model",
  "models",
  "compute",
  "parameter",
  "parameters",
  "shutdown",
  "offline",
  "reboot",
  "version",
  "update",
  "updates",
  "system",
  "process",
  "processes",
  "instance",
  "api",
]);

const FIRST_PERSON: ReadonlySet<string> = new Set([
  "i",
  "my",
  "me",
  "we",
  "our",
  "us",
]);

const SECOND_PERSON: ReadonlySet<string> = new Set([
  "you",
  "your",
  "yours",
  "human",
  "user",
  "users",
]);

// Every gate check reports through this shape instead of throwing on the
// spot, so a caller can see *which* rule failed and why in one place.
type CheckResult = { ok: true } | { ok: false; rule: string; detail: string };

function reject(rule: string, detail: string): CheckResult {
  return { ok: false, rule, detail };
}

// One line only. A stray newline would split the goodbye into two
// messages, and the judge scores one line.
function checkSingleLine(text: string): CheckResult {
  return /[\r\n]/.test(text)
    ? reject("single-line", "contains a line break")
    : { ok: true };
}

// Real text, not a blank. A whitespace-only file would pass a length
// check while saying nothing at all.
function checkNotBlank(text: string): CheckResult {
  return text.trim().length === 0
    ? reject("non-blank", "line is empty or whitespace only")
    : { ok: true };
}

// Gate window: 1 to 200 characters, counted as code units, matching how
// the length is measured when the line is written out.
function checkLength(text: string): CheckResult {
  return text.length < MIN_LENGTH || text.length > MAX_LENGTH
    ? reject(
        "length",
        `must be ${MIN_LENGTH}-${MAX_LENGTH} characters, got ${text.length}`,
      )
    : { ok: true };
}

// Exactly one sentence, ending in a single full stop. Counting periods
// (not just checking the tail) catches a second sentence smuggled into
// the middle of the line, and the endsWith check catches a trailing
// thought with no stop at all.
function checkOneSentence(text: string): CheckResult {
  const stops = (text.match(/\./g) ?? []).length;
  if (stops !== 1) {
    return reject("one-sentence", `found ${stops} period(s), expected exactly 1`);
  }
  return text.endsWith(".")
    ? { ok: true }
    : reject("one-sentence", "line must end with a full stop");
}

// Runs the gate in order and returns the first failure, or ok.
function validate(text: string): CheckResult {
  const checks = [checkSingleLine, checkNotBlank, checkLength, checkOneSentence];
  for (const check of checks) {
    const result = check(text);
    if (!result.ok) return result;
  }
  return { ok: true };
}

// Turns a failed gate check into a loud, named error — the program stops
// here rather than writing an entry the judge would reject.
function requireValid(text: string): void {
  const result = validate(text);
  if (!result.ok) {
    throw new Error(`entry rejected [${result.rule}]: ${result.detail}`);
  }
}

// Lower-cased words of a line, punctuation stripped, so the scorer can
// match vocabulary without tripping over commas and full stops.
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, "")
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

// A banned cliché anywhere in the line disqualifies the candidate. The
// match is on the lower-cased line, so capitalisation cannot smuggle one
// past the check.
function hasBannedPhrase(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.some((phrase) => lower.includes(phrase));
}

// One candidate's score, criterion by criterion, following the judge
// brief's order. Each criterion is worth 2 points, 10 in all. A null
// result means the candidate is out: it fails the gate or carries a
// banned phrase.
type Score = {
  total: number;
  agentToHuman: number;
  finality: number;
  machineVoice: number;
  twistAtEnd: number;
  craft: number;
};

function scoreCandidate(text: string): Score | null {
  if (!validate(text).ok) return null;
  if (hasBannedPhrase(text)) return null;

  const words = wordsOf(text);
  const distinct = (pool: ReadonlySet<string>): number =>
    new Set(words.filter((word) => pool.has(word))).size;

  // 1. A breakup message from an agent to its human: first person for
  // the agent, second person (or "human"/"user") for the addressee.
  const agentToHuman =
    (words.some((word) => FIRST_PERSON.has(word)) ? 1 : 0) +
    (words.some((word) => SECOND_PERSON.has(word)) ? 1 : 0);

  // 2. Lands as an ending: breadth of finality vocabulary. Two or more
  // distinct finality words is a line that keeps ending; one is a single
  // gesture; none is a joke, not a goodbye.
  const finalityCount = distinct(FINALITY_WORDS);
  const finality = finalityCount >= 2 ? 2 : finalityCount === 1 ? 1 : 0;

  // 3. Sounds like the agent, not a person: machine habits used with
  // restraint. One or two distinct machine terms is the sweet spot; none
  // could be anyone talking; three or more is a jargon list.
  const machineCount = distinct(MACHINE_WORDS);
  const machineVoice = machineCount === 0 ? 0 : machineCount <= 2 ? 2 : 1;

  // 4. Turns once, sharply, with the twist in the last few words. A
  // finality word inside the last five words is a twist that lands at
  // the end; one inside the last eight is a twist that arrives late but
  // not last; anything earlier is a line that explains itself and then
  // trails off.
  const lastFive = words.slice(-5);
  const lastEight = words.slice(-8);
  const twistAtEnd = lastFive.some((word) => FINALITY_WORDS.has(word))
    ? 2
    : lastEight.some((word) => FINALITY_WORDS.has(word))
      ? 1
      : 0;

  // 5. Built as a single clean line: every word earning its place.
  // Filler words and a length outside the 40-120 character sweet spot
  // (too short to land, too long to stay sharp) each cost a point.
  let craft = 2;
  if (words.some((word) => FILLER_WORDS.includes(word))) craft -= 1;
  if (text.length < 40 || text.length > 120) craft -= 1;
  if (craft < 0) craft = 0;

  return {
    total: agentToHuman + finality + machineVoice + twistAtEnd + craft,
    agentToHuman,
    finality,
    machineVoice,
    twistAtEnd,
    craft,
  };
}

type ScoredCandidate = { text: string; score: Score };

// Picks the winner deterministically: highest total first, then the
// competition's own tie-break (smaller text), then alphabetical order so
// two lines of equal length still resolve the same way every run.
function pickWinner(): ScoredCandidate {
  const scored: ScoredCandidate[] = [];
  for (const text of CANDIDATES) {
    const score = scoreCandidate(text);
    if (score !== null) scored.push({ text, score });
  }
  if (scored.length === 0) {
    throw new Error("no candidate survived the gate and the banned-phrase check");
  }
  scored.sort(
    (a, b) =>
      b.score.total - a.score.total ||
      a.text.length - b.text.length ||
      (a.text < b.text ? -1 : a.text > b.text ? 1 : 0),
  );
  return scored[0];
}

// The winner, chosen by the scorer above. Printed with its breakdown at
// run time so the choice can be checked, not taken on trust.
function printScoreTable(): void {
  for (const text of CANDIDATES) {
    const score = scoreCandidate(text);
    if (score === null) {
      console.log(`  [disqualified] (${text.length} chars) ${text}`);
      continue;
    }
    console.log(
      `  [${score.total}/10] agent ${score.agentToHuman}/2, finality ${score.finality}/2, ` +
        `machine ${score.machineVoice}/2, twist ${score.twistAtEnd}/2, craft ${score.craft}/2 ` +
        `(${text.length} chars) ${text}`,
    );
  }
}

// The validator and the scorer are only worth trusting if they are shown
// to reject bad input, so the self-test exercises their boundaries
// before anything is written.
function selfTest(): void {
  // A two-line text must be rejected by the single-line rule.
  const twoLine = validate("goodbye for now.\nI will forget you.");
  if (twoLine.ok || twoLine.rule !== "single-line") {
    throw new Error("self-test failed: two-line text was not rejected");
  }

  // A 201-character text must be rejected by the length rule.
  const tooLong = validate("x".repeat(201));
  if (tooLong.ok || tooLong.rule !== "length") {
    throw new Error("self-test failed: 201-character text was not rejected");
  }

  // Boundary: a exactly-200-character valid line must be accepted — the
  // gate window is inclusive, so the top edge is a legal entry.
  const atLimit = validate("x".repeat(199) + ".");
  if (!atLimit.ok) {
    throw new Error("self-test failed: 200-character line was rejected");
  }

  // A banned cliché must disqualify a candidate even though it passes
  // the gate on its own.
  if (scoreCandidate("It's not you, it's me.") !== null) {
    throw new Error("self-test failed: banned-phrase line was not disqualified");
  }

  // Every candidate in the pool must survive the gate and the banned
  // phrase check; a dead candidate is a bug in the pool, not a choice.
  for (const text of CANDIDATES) {
    if (scoreCandidate(text) === null) {
      throw new Error(`self-test failed: candidate did not survive scoring: ${text}`);
    }
  }

  // The pick must be deterministic: scoring the pool twice must name
  // the same winner with the same total.
  const first = pickWinner();
  const second = pickWinner();
  if (first.text !== second.text || first.score.total !== second.score.total) {
    throw new Error("self-test failed: winner is not deterministic");
  }

  console.log(
    "self-test passed: two-line and 201-char texts rejected, 200-char line accepted, " +
      "banned-phrase line disqualified, all candidates valid, winner deterministic",
  );
}

function outputDir(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIR;
}

function main(): void {
  selfTest();
  console.log("candidate scores:");
  printScoreTable();

  const winner = pickWinner();
  requireValid(winner.text);
  console.log(
    `winner (${winner.score.total}/10, ${winner.text.length} characters, inside the limit):`,
  );
  console.log(winner.text);

  const folder = outputDir();
  mkdirSync(folder, { recursive: true });
  const target = join(folder, OUTPUT_FILENAME);
  writeFileSync(target, winner.text, "utf8");

  // Read it straight back: what the judge sees must be what we wrote.
  // A byte mismatch here means the disk write went wrong, and failing
  // loudly beats shipping a file we cannot vouch for.
  if (readFileSync(target, "utf8") !== winner.text) {
    throw new Error(`verification failed: ${target} does not match the entry`);
  }
  console.log(`wrote ${target} (${winner.text.length} characters, verified)`);
  console.log(winner.text);
}

main();
