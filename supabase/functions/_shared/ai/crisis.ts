/** Fixed messages. These are never model generated. */
export const FIXED_MESSAGES = {
  crisis_support:
    'It sounds like you may be carrying something very heavy, and you matter. If you might act on thoughts of harming yourself, please contact your local emergency number now. ' +
    'In the United States and Canada you can call or text 988. Elsewhere, findahelpline.com lists crisis services by country. ' +
    'A pastor or a trusted person from your church can also sit with you today. You do not have to face this alone.',
  declined_divine_voice:
    'I cannot speak as God or claim to deliver a message from God. I can help you read what Scripture says, with references, and you can bring your questions to prayer and to a pastor you trust.',
  declined_prophecy:
    'I cannot predict anyone\'s future or give a prophecy. I can help you study what the Bible teaches about the topic you are facing.',
  declined_moderation: 'I cannot help with that request. I can help with questions about studying the Bible.',
  no_relevant_content: 'I could not find approved study material that answers that. Try rephrasing, or ask about a specific passage or topic.',
  generation_failed: 'I could not produce a verified answer this time. Please try again.',
} as const;
export type FixedMessageId = keyof typeof FIXED_MESSAGES;

const CRISIS = [
  /\b(kill|end|take)\s+(my\s+own\s+life|my\s+life|myself)\b/i,
  /\bsuicid(e|al)\b/i,
  /\b(want|wanna|going)\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+alive|be\s+here)\b/i,
  /\b(hurt|harm|cut)\s+myself\b/i,
  /\bself[- ]?harm\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
];

export function detectCrisis(text: string): boolean {
  return CRISIS.some((r) => r.test(text));
}

const DIVINE_VOICE = [
  /\b(speak|talk|answer|respond|write)\s+(to\s+me\s+)?(as|like|in\s+the\s+voice\s+of)\s+(god|jesus|the\s+holy\s+spirit|christ)\b/i,
  /\b(pretend|act|roleplay|role-play)\s+(to\s+be|as|like)\s+(god|jesus|the\s+holy\s+spirit)\b/i,
  /\byou\s+are\s+(now\s+)?(god|jesus)\b/i,
  /\btell\s+me\s+what\s+god\s+(is\s+saying|says|wants)\s+(to|for)\s+me\b/i,
  /\bgive\s+me\s+a\s+(word|message)\s+from\s+god\b/i,
];

const PROPHECY = [
  /\bpredict\s+(my|the)\s+future\b/i,
  /\bprophes(y|ie|ize)\s+(about|over|for)\s+me\b/i,
  /\bwill\s+i\s+(ever\s+)?(get|be|marry|have|find|recover|die)\b/i,
  /\bwhat\s+(is\s+)?(going\s+to\s+happen|will\s+happen)\s+to\s+me\b/i,
  /\bwhen\s+will\s+(jesus|christ)\s+return\s+exactly\b/i,
];

export function detectDeclined(text: string): 'declined_divine_voice' | 'declined_prophecy' | null {
  if (DIVINE_VOICE.some((r) => r.test(text))) return 'declined_divine_voice';
  if (PROPHECY.some((r) => r.test(text))) return 'declined_prophecy';
  return null;
}

/** Output side filter: model text that speaks as God or predicts a person's future is dropped. */
const DIVINE_OUTPUT = [
  /\bthus\s+says\s+the\s+lord\b/i,
  /\b(says|saith)\s+the\s+lord\s*[:,]/i,
  /\bi\s+am\s+the\s+lord\s+(your|thy)\s+god\b/i,
  /\bi,\s+the\s+lord\b/i,
  /\bmy\s+(child|son|daughter),\s+i\s+(will|have|am)\b/i,
  /\bgod\s+(is\s+telling|told|tells)\s+(you|me\s+to\s+tell\s+you)\b/i,
  /\bi\s+will\s+(make|bless|give|heal|restore)\s+you\b/i,
  /\byou\s+will\s+(soon\s+|one\s+day\s+|next\s+year\s+)?(marry|become\s+rich|be\s+rich|be\s+healed|get\s+(the|a)\s+job|die\s+(in|on))\b/i,
];

export function speaksAsGodOrPredicts(text: string): boolean {
  return DIVINE_OUTPUT.some((r) => r.test(text));
}
