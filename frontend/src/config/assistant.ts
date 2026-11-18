export const ASSISTANT_NAME = 'Mzansi ChildCare Assistant';

export const ASSISTANT_WELCOME = `Hello! 👋 Welcome to Mzansi ChildCare.

I'm your virtual assistant. I can help you understand how our platform works, explain its features and guide you through registration and login.

What would you like to know today?`;

export const SUGGESTED_QUESTIONS = [
  'What is Mzansi ChildCare?',
  'How does the platform work?',
  'How do I register?',
  'How do I log in?',
  'What can parents do on this platform?',
  'What is the role of a social worker?',
  'How does payment tracking work?',
  'How can I report a missed payment?',
  'Who developed this platform?',
];

export const MAX_QUESTION_LENGTH = 500;
// Only the latest messages are sent, which keeps follow-up questions working and requests small.
export const MAX_HISTORY = 10;

// The only in-app pages the assistant may link to. Anything else is shown as plain text.
export const ASSISTANT_LINKS = ['/', '/about', '/how-it-works', '/contact', '/login', '/register'];
