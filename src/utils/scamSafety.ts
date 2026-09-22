/**
 * Marketplace scam warnings.
 *
 * Two jobs: the plain advice shown to buyers and sellers, and a check that
 * reads a message and names the scam it looks like. Everything here runs on
 * the phone — no message is sent anywhere to be scanned.
 *
 * These are patterns, not proof. A warning says "this looks like X, here is
 * why that matters"; it never accuses anyone or blocks a conversation.
 */

import { checkContactDetails } from "@/utils/contactChecks";

export type ScamSignal = {
  id: string;
  /** What the scam is called, in the words a person would use. */
  title: string;
  /** Why it matters and what to do instead. */
  advice: string;
  /** "high" = people lose money to this one constantly. */
  severity: "high" | "caution";
  patterns: RegExp[];
};

export const SCAM_SIGNALS: ScamSignal[] = [
  {
    id: "courier-collection",
    title: "The courier collection scam",
    advice:
      "A buyer who cannot come themselves, but will send a courier and pay first, is the oldest scam on any marketplace. The payment confirmation is fake, the courier is real, and your item is gone. Hand it over in person or not at all.",
    severity: "high",
    patterns: [
      /\bcourier\b/i,
      /shipping agent/i,
      /\bmy (driver|man|guy|agent)\b.{0,30}\b(collect|pick)/i,
      /(arrange|send|book).{0,20}(collection|pickup|pick[- ]up)/i,
    ],
  },
  {
    id: "overpayment",
    title: "The overpayment scam",
    advice:
      "They 'accidentally' send too much and ask for the difference back. Their payment is reversed later; the money you sent back is gone. Never refund an overpayment — cancel the whole thing.",
    severity: "high",
    patterns: [
      /sent? (you )?too much/i,
      /overpaid|over[- ]payment/i,
      /refund the (difference|extra|balance)/i,
      /send (back|me) the (extra|difference|remaining|balance)/i,
    ],
  },
  {
    id: "verification-code",
    title: "They want a code from your phone",
    advice:
      "Nobody needs a code texted to you to buy your sofa. They are using your number to open an account or get into one of yours. Never read out or type a code you were sent.",
    severity: "high",
    patterns: [
      /verification code/i,
      /security code/i,
      /\b(6|five|six)[- ]digit code/i,
      /(send|give|text|read).{0,20}\bthe code\b/i,
      /code i (just )?sent/i,
    ],
  },
  {
    id: "payment-link",
    title: "A link to get paid through",
    advice:
      "Payment links in messages lead to fake pages built to capture your card or bank login. Go to your bank or payment app yourself — never through a link someone sent you.",
    severity: "high",
    patterns: [
      /payment link/i,
      /click (on )?(this|the|my) link/i,
      /(pay|paid|payment).{0,20}https?:\/\//i,
      /https?:\/\/\S*(verify|secure|confirm|payment)\S*/i,
    ],
  },
  {
    id: "gift-cards-crypto",
    title: "Gift cards or crypto",
    advice:
      "No genuine buyer or seller pays in gift cards, vouchers or cryptocurrency. Once sent, it is gone and cannot be traced or reversed. This is a scam every single time.",
    severity: "high",
    patterns: [
      /gift ?card/i,
      /(steam|amazon|itunes|google play) (card|voucher)/i,
      /\bbitcoin\b|\bbtc\b|\bcrypto\b|\busdt\b|\bethereum\b/i,
    ],
  },
  {
    id: "bank-details",
    title: "Bank details in a message",
    advice:
      "A bank transfer has no buyer or seller protection at all — once it leaves, your bank will not get it back. If you do use one, only after you have seen the item and the person.",
    severity: "caution",
    patterns: [
      /sort ?code/i,
      /account number/i,
      /\biban\b|\bbacs\b/i,
      /bank transfer/i,
    ],
  },
  {
    id: "friends-and-family",
    title: "PayPal 'friends and family'",
    advice:
      "Paying that way removes every protection PayPal gives you, which is exactly why they asked. Use goods and services, or pay in person.",
    severity: "high",
    patterns: [
      /friends? and family/i,
      /family and friends/i,
      /paypal gift/i,
      /\bf&f\b/i,
    ],
  },
  {
    id: "cheque",
    title: "Payment by cheque",
    advice:
      "A cheque can clear and still be reclaimed weeks later. By then the item is gone. Do not hand anything over against a cheque.",
    severity: "high",
    patterns: [/\bcheque\b/i, /\bchecque\b/i],
  },
  {
    id: "buying-unseen",
    title: "Buying unseen, from far away",
    advice:
      "Working away, buying it for a relative, cannot view it — the details change, the story does not. A buyer who will not see the item before paying is usually not a buyer.",
    severity: "caution",
    patterns: [
      /(i am|i'm|im) (currently )?(abroad|overseas|out of the country|away)/i,
      /(oil ?rig|offshore|army base|on deployment)/i,
      /buying (it |this )?(for|as a gift for) my (son|daughter|nephew|niece|husband|wife)/i,
      /(cannot|can't|cant|unable to) (come|view|see) (it|the item)/i,
    ],
  },
  {
    id: "move-off-app",
    title: "Moving the chat elsewhere, straight away",
    advice:
      "Wanting to leave the app before a single question about the item is a pattern worth noticing. Keep talking here until you have agreed what you are buying and how you will meet.",
    severity: "caution",
    patterns: [
      /whats ?app/i,
      /\btelegram\b/i,
      /text me on/i,
      /email me (at|on)/i,
    ],
  },
  {
    id: "deposit-to-hold",
    title: "A deposit to hold it",
    advice:
      "A deposit to a stranger, for something you have not seen, buys you nothing. Plenty of items have been 'held' for several people at once.",
    severity: "caution",
    patterns: [
      /deposit to (hold|secure|reserve)/i,
      /(pay|send) a deposit/i,
    ],
  },
];

export type ScamWarning = Pick<ScamSignal, "id" | "title" | "advice" | "severity">;

/**
 * Which scams a message looks like — both what it says, and the contact details
 * in it. Empty when nothing stands out.
 */
export function checkMessage(text: string | null | undefined): ScamWarning[] {
  const message = String(text ?? "");
  if (!message.trim()) return [];

  const fromWording = SCAM_SIGNALS.filter((signal) =>
    signal.patterns.some((pattern) => pattern.test(message))
  ).map(({ id, title, advice, severity }) => ({ id, title, advice, severity }));

  // Emails, links and phone numbers pasted into the chat.
  return [...fromWording, ...checkContactDetails(message)];
}

/** The worst thing found, for deciding how loud to be. */
export function worstSeverity(warnings: ScamWarning[]): "high" | "caution" | null {
  if (warnings.some((w) => w.severity === "high")) return "high";
  if (warnings.length > 0) return "caution";
  return null;
}

/** Shown to someone looking at a listing. */
export const BUYER_SAFETY_TIPS = [
  "See it before you pay for it. A photo is not the item.",
  "Pay in person, or by a method that protects you. A bank transfer to a stranger cannot be undone.",
  "Meet somewhere public in daylight, and take someone with you for anything big or valuable.",
  "A price far below everything else is bait, not a bargain.",
  "Nobody needs a code from your phone to buy something.",
];

/** Shown in a conversation, where either side could be reading. */
export const MESSAGE_SAFETY_TIPS = [
  "Agree everything here before you meet, and keep the conversation in the app.",
  "No couriers, no cheques, no gift cards, no crypto. Every one of those is a scam.",
  "Never share a code that was texted to you, or your bank login, with anyone.",
  "A payment text, email or screenshot is not money. Check your own account.",
  "Look at the address an email really came from, not the name on it. Anyone can put PayPal in the name.",
  "If something feels off, walk away. There will be another one.",
];

/** Things it is worth stopping someone from sending about themselves. */
export const RISKY_TO_SEND: string[] = ["bank-details", "verification-code"];

/** Shown to someone putting an item up for sale. */
export const SELLER_SAFETY_TIPS = [
  "Do not hand the item over until the money is really in your account — not a text, not an email, not a screenshot.",
  "No couriers. A buyer who will not collect in person is not buying.",
  "If a payment comes in over the asking price, do not refund the difference. Cancel it.",
  "Never share a code sent to your phone, or your bank login, with a buyer.",
  "Keep the conversation in the app until you have agreed how and where to meet.",
];
