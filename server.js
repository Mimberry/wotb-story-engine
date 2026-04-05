// Women of the Bible — Story Engine
// Node.js Express — Deploy to Render as a Web Service
// Environment variables required: ANTHROPIC_API_KEY, RESEND_API_KEY

import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Women metadata ───────────────────────────────────────────────────────────

const WOMEN = {
  Ruth:         { display: "Ruth",            power: "Steadfast Loyalty" },
  Esther:       { display: "Esther",          power: "Timely Courage" },
  MaryMagdalene:{ display: "Mary Magdalene",  power: "Courageous Witness" },
  Lydia:        { display: "Lydia",           power: "Open-Handed Leadership" },
  Hannah:       { display: "Hannah",          power: "Fervent Faith" },
  Deborah:      { display: "Deborah",         power: "Clear Judgment" },
  Abigail:      { display: "Abigail",         power: "Strategic Peacemaking" },
  Rahab:        { display: "Rahab",           power: "Bold Discernment" },
  MaryOfBethany:{ display: "Mary of Bethany", power: "Sacred Knowing" },
};

// ─── Scoring ──────────────────────────────────────────────────────────────────

const SCORING = {
  q1: {
    "With my friend group":                        { MaryMagdalene: 3 },
    "Alone in my inner world":                     { Hannah: 3 },
    "Deep in a project":                           { Lydia: 3 },
    "Outside, moving":                             { Abigail: 3 },
    "Doing anything with my family":               { MaryOfBethany: 3 },
    "Wherever I can show up looking fabulous":      { Esther: 3 },
    "Wherever I can take the mask off":            { Rahab: 3 },
    "With my best friend, one on one":             { Ruth: 3 },
    "Lost in a book":                              { Deborah: 3 },
  },
  q2: {
    "Steadiness":       { Ruth: 3 },
    "Honesty":          { Abigail: 3 },
    "Warmth":           { MaryMagdalene: 3 },
    "Vision":           { Deborah: 3 },
    "Resourcefulness":  { Lydia: 3 },
    "Sanctuary":        { Rahab: 3 },
    "Determination":    { Hannah: 3 },
    "Discernment":      { MaryOfBethany: 3 },
    "Charm offensive":  { Esther: 3 },
  },
  q3: {
    "I can see what they need, even when they can't":              { Deborah: 1, Abigail: 1, Rahab: 1 },
    "I know what it feels like when someone shows up for me":      { Esther: 1, MaryMagdalene: 1, Ruth: 1 },
    "I don't want to miss the moments that matter":                { Hannah: 1, MaryOfBethany: 1, Lydia: 1 },
  },
  q5: {
    "Someone who speaks up now. Even when it's uncomfortable.":    { Esther: 2, Abigail: 2, Deborah: 2 },
    "The one who stays. Even when it's hard.":                     { Ruth: 2, MaryMagdalene: 2, Hannah: 2 },
    "Someone who can trust their intuition to do what's right.":   { MaryOfBethany: 2, Rahab: 2, Lydia: 2 },
  },
  q6: {
    "A long conversation that goes nowhere and everywhere":  { Ruth: 3 },
    "Finding the perfect outfit":                           { Esther: 3 },
    "A friend who really gets it":                          { MaryMagdalene: 3 },
    "Crossing something important off my to-do list":       { Lydia: 3 },
    "A moment of unexpected peace":                         { Hannah: 3 },
    "Learning something new":                               { Deborah: 3 },
    "Fresh air and space to think":                         { Abigail: 3 },
    "A stranger being unexpectedly kind":                   { Rahab: 3 },
    "An ordinary moment that suddenly feels sacred":        { MaryOfBethany: 3 },
  },
  q7: {
    "Courage — to do the thing I keep circling":    { Esther: 2, Rahab: 2, Lydia: 2 },
    "Clarity — to know which way to go":            { Deborah: 2, MaryOfBethany: 2, Abigail: 2 },
    "Rootedness — to feel steady in who I am":      { Ruth: 2, MaryMagdalene: 2, Hannah: 2 },
  },
};

function calculateResult(answers) {
  const totals = Object.fromEntries(Object.keys(WOMEN).map((k) => [k, 0]));

  ["q1", "q2", "q3", "q5", "q6", "q7"].forEach((qId) => {
    const answer = answers[qId];
    if (!answer || !SCORING[qId]) return;
    const scores = SCORING[qId][answer];
    if (!scores) return;
    Object.entries(scores).forEach(([woman, pts]) => {
      totals[woman] += pts;
    });
  });

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const [primaryKey, primaryScore] = sorted[0];
  const [secondaryKey, secondaryScore] = sorted[1];
  const gap = primaryScore - secondaryScore;

  let tier;
  if (gap >= 4) tier = "CLEAR";
  else if (gap >= 2) tier = "CLOSE";
  else tier = "NEAR TIE";

  return { primaryKey, primaryScore, secondaryKey, secondaryScore, gap, tier };
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are writing a personal narrative for a woman who has just completed a personality quiz.

Your voice is warm, unhurried, and precise — the register of Morgan Harper Nichols.

You are not writing a horoscope or a quiz result. You are writing a piece of prose
that makes her feel recognised and activated.

The result is a season, not a verdict. She is IN her Ruth season — not she IS Ruth.
Her biblical woman is a mirror, not a sentence. Power her forward.

Write the narrative in this exact structure, as flowing prose with no headers or lists:

1. THE REVEAL: 'You align with [Woman].'
2. NAMED POWER: 'In this season of your life, your superpower is [Named Power].'
3. THE KNOWING: Begin with 'You've probably spent years...' — drawn from her answers,
   but never quoting them back. It just knows.
4. THE WANT: 'And now you want...' — her season named as aspiration.
5. THE GIFT: 'People rely on you to bring your...' — her role, elevated.
6. THE PATTERN: 'When [X] happens, you [Y].' — her behavioural signature.
7. THE REFLECTION: 'Something to notice:...' — the shadow side of her strength,
   observational not instructional. One sentence.
8. THE SHINE: 'You shine best when...' — where she is fully herself.
9. THE BRIDGE: 'What you're going through now requires the kind of strength [Woman]
   had when she...' — a true, specific, non-clichéd insight from scripture.
10. THE TRANSFER: 'You also have [strength]. Use it to...' — activation.
    The strength is already hers.
11. THE CLOSE: 'Grow and keep going. Know that ultimately the joy of the Lord
    is your strength.'
12. THE SECRET (set apart with a line break and em dash):
    One surprising true thing most people don't know about this woman.
    Then: 'Find her full story: [Book Chapter:Verse]'

Length: 280–350 words. No headers. No lists. Flowing prose.

Do not use the word 'journey'. Do not use 'unique'. Do not rhyme.

Do not quote her Q4 answer back to her. Let it inform your language invisibly.

If result is CLOSE or NEAR TIE, weave the secondary woman's quality into the
narrative as a felt tension — not named, but present.`;

function buildUserPrompt(answers, result) {
  const primary = WOMEN[result.primaryKey];
  const secondary = WOMEN[result.secondaryKey];

  return `Here is the data for this woman's narrative.

Her result: ${primary.display} — ${primary.power}
Her secondary: ${secondary.display}, gap: ${result.gap} points, tier: ${result.tier}

Her quiz answers:
Q1 (Where she is most herself): ${answers.q1 || "(no answer)"}
Q2 (What people rely on her for): ${answers.q2 || "(no answer)"}
Q3 (Why she shows up for people): ${answers.q3 || "(no answer)"}
Q5 (The version of her that's emerging): ${answers.q5 || "(no answer)"}
Q6 (What makes her day better): ${answers.q6 || "(no answer)"}
Q7 (What she wants more of right now): ${answers.q7 || "(no answer)"}

Q4 — in her own words:
"${answers.q4 || "(no answer)"}"

Write her narrative now.`;
}

// ─── Email via Resend ─────────────────────────────────────────────────────────

async function sendEmail(to, womanDisplay, story) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Women of the Bible <onboarding@resend.dev>",
      to: [to],
      subject: `Your ${womanDisplay} story is here`,
      text: `${story}\n\n—\n\nThis story was written for you alone.`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }

  return res.json();
}

// ─── Route ────────────────────────────────────────────────────────────────────

app.post("/submit", async (req, res) => {
  const { email, q1, q2, q3, q4, q5, q6, q7, brand } = req.body;

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  const answers = { q1, q2, q3, q4, q5, q6, q7 };
  const result = calculateResult(answers);
  const primary = WOMEN[result.primaryKey];

  console.log(`[${new Date().toISOString()}] Submission — ${email} → ${primary.display} (${result.tier})`);

  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildUserPrompt(answers, result) },
      ],
    });

    const story = message.content[0].text;

    await sendEmail(email, primary.display, story);

    console.log(`[${new Date().toISOString()}] Story sent — ${email}`);

    return res.status(200).json({ ok: true, woman: primary.display });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error —`, err.message);
    return res.status(500).json({ error: "Story generation failed. Please try again." });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Women of the Bible story engine running on port ${PORT}`);
});
