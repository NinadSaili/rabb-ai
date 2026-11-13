-- DEV ONLY. UNLICENSED. NOT FOR RELEASE.
-- Fixtures exist so screens and tests run. The translation row is marked is_dev_only and the release gate constraint
-- (scripture_translations_release_gate) prevents include_in_release from being set while it is dev only or unverified.
-- Prayers and verse selections are placeholders pending editorial review. They are NOT editorially approved content:
-- reviewed_by is the literal 'DEV FIXTURE' so release checks can find and remove them.
-- Never scraped from YouVersion or any Bible app.

insert into public.scripture_translations
  (code, name, language, license_name, license_url, copyright_text, attribution_text, is_public_domain, is_dev_only, include_in_release)
values
  ('KJV-DEV', 'King James Version (DEV ONLY fixture)', 'en', 'DEV ONLY unlicensed, unverified', null,
   'DEV ONLY. Licence not verified. See docs/SCRIPTURE_LICENSING.md.',
   'King James Version. DEV ONLY fixture, not for release.', false, true, false)
on conflict (code) do nothing;

insert into public.scripture_content (translation_id, book, chapter, verse, text)
select t.id, v.book, v.chapter, v.verse, v.text
from public.scripture_translations t
cross join (values
  ('PSA', 23, 1, 'The LORD is my shepherd; I shall not want.'),
  ('JHN', 3, 16, 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'),
  ('PRO', 3, 5, 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.'),
  ('PRO', 3, 6, 'In all thy ways acknowledge him, and he shall direct thy paths.'),
  ('PSA', 119, 105, 'Thy word is a lamp unto my feet, and a light unto my path.'),
  ('MAT', 11, 28, 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.'),
  ('ISA', 41, 10, 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.')
) as v(book, chapter, verse, text)
where t.code = 'KJV-DEV'
on conflict do nothing;

insert into public.daily_verses (book, chapter, verse_start, verse_end, language, theme, status, reviewed_by, reviewed_at, is_fallback, fallback_rank)
values
  ('PSA', 23, 1, null, 'en', 'trust', 'approved', 'DEV FIXTURE', now(), true, 1),
  ('JHN', 3, 16, null, 'en', 'love', 'approved', 'DEV FIXTURE', now(), true, 2),
  ('PRO', 3, 5, 6, 'en', 'guidance', 'approved', 'DEV FIXTURE', now(), true, 3),
  ('PSA', 119, 105, null, 'en', 'guidance', 'approved', 'DEV FIXTURE', now(), true, 4),
  ('MAT', 11, 28, null, 'en', 'rest', 'approved', 'DEV FIXTURE', now(), true, 5),
  ('ISA', 41, 10, null, 'en', 'courage', 'approved', 'DEV FIXTURE', now(), true, 6)
on conflict do nothing;

insert into public.daily_prayers (title, body, language, theme, status, reviewed_by, reviewed_at, is_fallback, fallback_rank)
values
  ('Before I scroll', 'Lord, I come to your Word before I come to my screen. Quiet my mind, open my heart, and help me to hear you in these verses. Amen.', 'en', 'focus', 'approved', 'DEV FIXTURE', now(), true, 1),
  ('Steady my day', 'Father, steady my steps today. Let what I read settle in me and shape what I say and do. Amen.', 'en', 'guidance', 'approved', 'DEV FIXTURE', now(), true, 2),
  ('Rest in you', 'God, I bring my tiredness to you. Teach me to rest in your care and to trust you with what I cannot carry. Amen.', 'en', 'rest', 'approved', 'DEV FIXTURE', now(), true, 3)
on conflict do nothing;
