/**
 * DEMO MODE ONLY. Placeholder content so the app can be shown without a backend.
 * The text is KJV, labelled DEV ONLY and unlicensed per docs/SCRIPTURE_LICENSING.md (licence not verified here).
 * This module is required only behind the DEMO_MODE build constant and must never ship in a release build.
 */
export const DEMO_TRANSLATION = {
  code: 'KJV-DEV',
  name: 'King James Version (DEMO placeholder)',
  language: 'en',
  license_name: 'DEV ONLY, unlicensed, unverified',
  copyright_text: 'DEMO ONLY. Licence not verified. See docs/SCRIPTURE_LICENSING.md.',
  attribution_text: 'King James Version. DEMO placeholder text, not licensed for release.',
};

export interface DemoVerse {
  id: string;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end?: number;
  text: string;
  theme: string;
}

export const DEMO_VERSES: DemoVerse[] = [
  { id: '11111111-1111-4111-8111-111111111101', book: 'PSA', chapter: 23, verse_start: 1, text: 'The LORD is my shepherd; I shall not want.', theme: 'trust' },
  { id: '11111111-1111-4111-8111-111111111102', book: 'JHN', chapter: 3, verse_start: 16, text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', theme: 'love' },
  { id: '11111111-1111-4111-8111-111111111103', book: 'PRO', chapter: 3, verse_start: 5, verse_end: 6, text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.', theme: 'guidance' },
  { id: '11111111-1111-4111-8111-111111111104', book: 'PSA', chapter: 119, verse_start: 105, text: 'Thy word is a lamp unto my feet, and a light unto my path.', theme: 'guidance' },
  { id: '11111111-1111-4111-8111-111111111105', book: 'MAT', chapter: 11, verse_start: 28, text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', theme: 'rest' },
  { id: '11111111-1111-4111-8111-111111111106', book: 'ISA', chapter: 41, verse_start: 10, text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.', theme: 'courage' },
];

export const DEMO_PRAYERS = [
  { id: '22222222-2222-4222-8222-222222222201', title: 'Before I scroll', body: 'Lord, I come to your Word before I come to my screen. Quiet my mind, open my heart, and help me to hear you in these verses. Amen.' },
  { id: '22222222-2222-4222-8222-222222222202', title: 'Steady my day', body: 'Father, steady my steps today. Let what I read settle in me and shape what I say and do. Amen.' },
  { id: '22222222-2222-4222-8222-222222222203', title: 'Rest in you', body: 'God, I bring my tiredness to you. Teach me to rest in your care and to trust you with what I cannot carry. Amen.' },
];
