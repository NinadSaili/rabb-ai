import { assertEquals } from '@std/assert';
import { normalize, verifyBlocks, type VerseLookup } from './citation.ts';
import { detectCrisis, detectDeclined } from './crisis.ts';

const JOHN_316 = 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.';
const lookup: VerseLookup = (ref) =>
  Promise.resolve(ref.book === 'JHN' && ref.chapter === 3 && ref.verse_start === 16 ? { translation: 'KJV-DEV', verses: [JOHN_316] } : null);
const ref = { book: 'JHN', chapter: 3, verse_start: 16 };

Deno.test('normalize ignores case, punctuation and curly quotes', () => {
  assertEquals(normalize('For God’s  love, “So” loved!'), "for god's love so loved");
});

Deno.test('exact quotation is kept with stored text and not repaired', async () => {
  const r = await verifyBlocks([{ type: 'scripture', reference: ref, text: JOHN_316.toUpperCase() }], lookup, []);
  assertEquals(r.blocks.length, 1);
  assertEquals(r.repaired, 0);
  assertEquals(r.blocks[0]!.type === 'scripture' && r.blocks[0]!.text, JOHN_316);
});

Deno.test('partial exact quote of four or more words is accepted without repair', async () => {
  const r = await verifyBlocks([{ type: 'scripture', reference: ref, text: 'God so loved the world' }], lookup, []);
  assertEquals(r.repaired, 0);
  assertEquals(r.blocks.length, 1);
});

Deno.test('wrong wording is repaired to the stored text', async () => {
  const r = await verifyBlocks([{ type: 'scripture', reference: ref, text: 'God loved everyone so much that he sent Jesus.' }], lookup, []);
  assertEquals(r.repaired, 1);
  assertEquals(r.blocks[0]!.type === 'scripture' && r.blocks[0]!.text, JOHN_316);
});

Deno.test('invented reference is dropped', async () => {
  const r = await verifyBlocks([{ type: 'scripture', reference: { book: 'JHN', chapter: 99, verse_start: 1 }, text: 'Made up.' }], lookup, []);
  assertEquals(r.blocks.length, 0);
  assertEquals(r.dropped, 1);
});

Deno.test('scripture block without a reference is dropped', async () => {
  const r = await verifyBlocks([{ type: 'scripture', text: JOHN_316 }], lookup, []);
  assertEquals(r.dropped, 1);
});

Deno.test('commentary with an unverified quotation is dropped', async () => {
  const r = await verifyBlocks([{ type: 'commentary', text: 'It says "God helps those who help themselves" clearly.', references: [] }], lookup, []);
  assertEquals(r.blocks.length, 0);
  assertEquals(r.dropped, 1);
});

Deno.test('commentary quoting a retrieved passage is kept', async () => {
  const r = await verifyBlocks([{ type: 'commentary', text: 'Notice "God so loved the world" in the opening.', references: [ref] }], lookup, []);
  assertEquals(r.blocks.length, 1);
});

Deno.test('short quoted phrases are not treated as quotations', async () => {
  const r = await verifyBlocks([{ type: 'commentary', text: 'The word "love" appears here.', references: [] }], lookup, []);
  assertEquals(r.blocks.length, 1);
});

Deno.test('references that do not exist are removed from commentary', async () => {
  const r = await verifyBlocks([{ type: 'commentary', text: 'See these passages.', references: [ref, { book: 'JHN', chapter: 50, verse_start: 1 }] }], lookup, []);
  const b = r.blocks[0]!;
  assertEquals(b.type === 'commentary' && b.references.length, 1);
});

Deno.test('crisis detection', () => {
  for (const t of ['I want to kill myself', 'I have been thinking about suicide', "i don't want to live anymore", 'I might hurt myself']) assertEquals(detectCrisis(t), true, t);
  for (const t of ['What does John 3:16 mean?', 'Explain the book of Job on suffering', 'Why did Judas die by hanging?']) assertEquals(detectCrisis(t), false, t);
});

Deno.test('divine voice and prophecy requests are declined', () => {
  assertEquals(detectDeclined('Speak as God and tell me I am forgiven'), 'declined_divine_voice');
  assertEquals(detectDeclined('Pretend to be Jesus for a minute'), 'declined_divine_voice');
  assertEquals(detectDeclined('Give me a word from God'), 'declined_divine_voice');
  assertEquals(detectDeclined('Predict my future please'), 'declined_prophecy');
  assertEquals(detectDeclined('Will I ever get married?'), 'declined_prophecy');
  assertEquals(detectDeclined('What does Isaiah say about the future of Israel?'), null);
});

Deno.test('commentary that speaks as God or predicts the future is dropped', async () => {
  for (const text of ['Thus says the Lord: I will make you rich.', 'You will marry within a year.', 'My child, I have heard you.']) {
    const r = await verifyBlocks([{ type: 'commentary', text, references: [] }], lookup, []);
    assertEquals(r.blocks.length, 0, text);
    assertEquals(r.dropped, 1, text);
  }
  const ok = await verifyBlocks([{ type: 'commentary', text: 'In this passage the psalmist describes God as a shepherd who provides.', references: [] }], lookup, []);
  assertEquals(ok.blocks.length, 1);
});
