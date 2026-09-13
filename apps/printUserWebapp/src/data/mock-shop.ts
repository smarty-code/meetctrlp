import { ShopContext, FAQItem } from '../types/upload';

export const mockShop: ShopContext = {
  id: 'shop_001',
  name: 'CtrlP Campus Hub',
  address: 'Shop 4, Student Center Complex, North Campus',
  status: 'OPEN',
  statusMessage: "We're ready to print!",
  estimatedMinutes: 10,
  startingPriceA4: 3,
  openTime: '08:00 AM',
  closeTime: '09:00 PM',
};

export const faqList: FAQItem[] = [
  {
    id: 'faq-1',
    question: 'What Document format can I print?',
    answer: 'We support PDF, Word documents (.doc, .docx), PowerPoint presentations (.ppt, .pptx), and image files (.jpg, .jpeg, .png). PDF format is recommended for the most accurate layout and typography.',
  },
  {
    id: 'faq-2',
    question: 'What printing options can I choose from?',
    answer: 'You can choose Black & White or Color, paper size (standard A4), copy count, and select all pages or specific page ranges (e.g., 1, 3, 5-8).',
  },
  {
    id: 'faq-3',
    question: 'How do I upload my documents?',
    answer: 'Simply tap "Upload Document", select one or multiple documents from your phone files or gallery, and wait for the brief upload verification before configuring your print job.',
  },
  {
    id: 'faq-4',
    question: 'Are my documents/photos stored and handled securely?',
    answer: 'Yes, privacy is our top priority. Your files are encrypted in transit and at rest, processed automatically without staff browsing, and deleted permanently in accordance with our strict document retention policy once printed.',
  },
  {
    id: 'faq-5',
    question: 'What is the max number of files/photos I can upload?',
    answer: 'You can upload up to 10 documents per print order. For larger batches, you can easily submit an additional order once the first is queued.',
  },
  {
    id: 'faq-6',
    question: 'I have an issue with my order, what now?',
    answer: 'If there is a paper jam, printing error, or payment verification hold, the shop manager will be alerted automatically on their terminal. You can also show your Order ID directly at the counter for immediate assistance.',
  },
  {
    id: 'faq-7',
    question: 'How long does it take to get my order?',
    answer: 'Most standard document orders are printed within 5 to 10 minutes of submission. You can track the real-time status (Placed → Printing → Ready for Pickup) on your phone.',
  },
];
