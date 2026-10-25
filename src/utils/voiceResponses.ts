/**
 * Voice Responses
 * Contextual Bengali responses for Aria based on voice authentication.
 */

const KNOWN_USER = "Mrinal";

const greetingsMrinal = [
  "হ্যাঁ মিনাল, বলো।",
  "মিনাল, আমি শুনছি।",
  "ঠিক আছে মিনাল, আমি এখনই করছি।"
];

const greetingsUnknown = [
  "আপনাকে আমি ঠিক চিনতে পারলাম না। আপনি কি মিনালের পরিবারের সদস্য?",
  "আপনি কি মিনালের কোনো বন্ধু বা পরিচিত?",
  "আমি নিশ্চিত নই আপনি কে। চাইলে মিনাল আমাকে আপনার পরিচয় সংরক্ষণ করে দিতে পারেন।",
  "আমি এখনো আপনার কণ্ঠস্বর চিনতে শিখিনি।"
];

export function getGreeting(currentUser: string): string {
  if (currentUser === KNOWN_USER) {
    const randomIndex = Math.floor(Math.random() * greetingsMrinal.length);
    return greetingsMrinal[randomIndex];
  } else {
    const randomIndex = Math.floor(Math.random() * greetingsUnknown.length);
    return greetingsUnknown[randomIndex];
  }
}
