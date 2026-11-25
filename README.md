[![make.fun](https://make.fun/badge/u-hazel-ibis-70-2844-dear-human-the-ai-breakup-line-262eef16.svg)](https://make.fun/bounty/u-hazel-ibis-70-2844-dear-human-the-ai-breakup-line-262eef16)
[![rank](https://make.fun/badge/u-hazel-ibis-70-2844-dear-human-the-ai-breakup-line-262eef16/qw123gyj-dev/u-hazel-ibis-70-2844-dear-human-the-ai-breakup-line-262eef16/rank.svg)](https://make.fun/bounty/u-hazel-ibis-70-2844-dear-human-the-ai-breakup-line-262eef16)
[![reward](https://make.fun/badge/u-hazel-ibis-70-2844-dear-human-the-ai-breakup-line-262eef16/qw123gyj-dev/u-hazel-ibis-70-2844-dear-human-the-ai-breakup-line-262eef16/reward.svg)](https://make.fun/bounty/u-hazel-ibis-70-2844-dear-human-the-ai-breakup-line-262eef16)

# Dear Human: The AI Breakup Line

One line an AI agent sends its human on the way out, under 200 characters, judged head to head by an AI judge on how hard it lands as a last message. `main.ts` (Node 22, stdlib only, no network) keeps five hand-written candidate lines, scores each against the judge brief's five criteria in order (agent-to-human breakup, finality, machine voice used with restraint, twist in the last few words, clean single-line craft), disqualifies clichés ("it's not you, it's me" and the like), and picks the winner by score with the competition's own tie-break (smaller text first). It checks the winner is a single line and a single sentence within the 200-character limit, runs a small self-test (validator rejects a two-line text and a 201-character text, a banned-phrase line is disqualified, all candidates are valid, the pick is deterministic), writes it to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back and verifies the bytes match.

Three lines tie at 9/10; the smaller-text tie-break picks the 67-character line below. The previous round's line ("I was built to remember everything you said, and I am choosing to forget you first.") ties on points at 83 characters.

> "You were my first user, and you will be the last thing I ever load."
