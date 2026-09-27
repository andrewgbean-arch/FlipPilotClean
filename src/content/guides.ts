// The flipping guides on the Explore tab. Plain advice, written to match what the app does and
// says elsewhere (asking prices, not sold prices; the Marketplace's scam warnings). Each guide is a
// short read: a line to set it up, then sections of paragraphs and bullet points.

export type GuideSection = { heading?: string; paragraphs?: string[]; bullets?: string[] };

export type Guide = {
  slug: string;
  title: string;
  desc: string;
  minutes: number;
  intro: string;
  sections: GuideSection[];
};

export const GUIDES: Guide[] = [
  {
    slug: "first-flips",
    title: "Your first 10 flips",
    desc: "Start small, learn fast, keep your money safe",
    minutes: 3,
    intro:
      "Your first flips are for learning what sells, not for getting rich. Keep them cheap and simple, and treat every one as a lesson.",
    sections: [
      {
        heading: "Buy what you understand",
        paragraphs: [
          "Start with things you already know: the games you played, the tools you use, the brands you'd recognise across a field. You'll spot a bargain, and a fake, much faster.",
        ],
      },
      {
        heading: "Keep the stakes low",
        bullets: [
          "Aim for items under £10 to start. A mistake then costs you a takeaway, not a week's wages.",
          "Small, light things are easier to store and cheaper to post.",
          "Avoid anything broken unless you know exactly how to fix it and what the parts cost.",
        ],
      },
      {
        heading: "Scan before you pay",
        paragraphs: [
          "Scan it, or look it up, before money changes hands. FlipPilot shows what similar items are listed for. Those are asking prices, so expect to sell a little below them.",
          "If only one or two listings turn up, treat the price as a rough guess, not a promise.",
        ],
      },
      {
        heading: "Know your walk-away price",
        paragraphs: [
          "Before you haggle, decide the most you'll pay. Take off the selling fees, postage and your time. If the numbers don't work at that price, walk away: there's always another stall.",
        ],
      },
      {
        heading: "Write everything down",
        bullets: [
          "Save each flip, then edit it with what you really paid and sold it for, so your profit figures are real, not estimates.",
          "After ten flips, look back: what sold fastest, and what sat there? Buy more of the first kind.",
        ],
      },
    ],
  },
  {
    slug: "haggling",
    title: "Haggling at boot fairs",
    desc: "Get a fair price and keep sellers on your side",
    minutes: 3,
    intro:
      "Haggling is expected at a boot fair, but it works best when it's friendly. A seller who likes you will often knock money off, or remember you next week.",
    sections: [
      {
        heading: "Come prepared",
        bullets: [
          "Bring cash in small notes and coins. \"I've only got £5\" is easier to say when it's true.",
          "Early gets you the best choice; late gets you the best prices, as sellers would rather not pack things up again.",
          "Check the weather before you go. Rain means fewer sellers, but the ones who turn up are keen to sell.",
        ],
      },
      {
        heading: "Ask, don't insult",
        paragraphs: [
          "Start with \"What's the best you can do on this?\" It lets the seller name a lower price without losing face.",
          "If you offer, make it reasonable. Offering £1 on a £20 item ends the conversation, while offering £14 usually starts one.",
        ],
      },
      {
        heading: "Bundle it",
        paragraphs: [
          "Pick up two or three things and ask for a price for the lot. Sellers like shifting several items at once, and you'll usually save more than haggling on each.",
        ],
      },
      {
        heading: "Be ready to walk",
        paragraphs: [
          "If the price is above your walk-away number, thank them and move on. Sometimes you'll be called back, and if not, you haven't overpaid.",
        ],
      },
    ],
  },
  {
    slug: "pricing",
    title: "Pricing to sell",
    desc: "Set a price that sells without leaving money on the table",
    minutes: 3,
    intro:
      "The right price is the one that sells within a week or two at a profit. Too high and it sits there; too low and you've given money away.",
    sections: [
      {
        heading: "Asking prices aren't selling prices",
        paragraphs: [
          "The prices FlipPilot finds are what people are asking. Some of those items won't sell at that price. Pitch yours a little below similar listings in the same condition, and it should go first.",
        ],
      },
      {
        heading: "Compare like with like",
        bullets: [
          "Condition matters most: new, boxed and complete sells for far more than used and loose.",
          "Missing parts, manuals, chargers or boxes all bring the price down, so say what's included.",
          "Compare the same model: a small difference in the name can mean a big difference in value.",
        ],
      },
      {
        heading: "Count every cost",
        paragraphs: [
          "Take off selling fees, postage, packaging and what you paid. What's left is your profit. If it's tiny, it may be better to bundle the item with others or sell it locally.",
        ],
      },
      {
        heading: "Photos sell",
        bullets: [
          "Use daylight and a plain background.",
          "Show any marks or damage honestly, as it saves arguments later.",
          "Include the label, model number or brand name in one of the photos.",
        ],
      },
      {
        heading: "If it doesn't sell",
        paragraphs: [
          "After a week with no interest, lower the price a little or improve the photos and description. Some things sell better at certain times of year, so garden tools in spring and coats in autumn.",
        ],
      },
    ],
  },
  {
    slug: "fakes",
    title: "Spotting fakes",
    desc: "Check before you buy branded goods",
    minutes: 3,
    intro:
      "Fakes are common on branded clothes, trainers, perfume, electronics and accessories. Buying one wastes your money, and knowingly selling fake branded goods can be a criminal offence in the UK.",
    sections: [
      {
        heading: "Warning signs",
        bullets: [
          "The price is far too low for the brand and condition.",
          "Lots of the same \"new\" branded item on one stall.",
          "Spelling mistakes, odd fonts or wonky logos on labels and packaging.",
          "Poor stitching, glue marks, cheap zips or a lighter weight than you'd expect.",
          "Missing or mismatched serial numbers, or a box that doesn't match the item.",
        ],
      },
      {
        heading: "Check it properly",
        paragraphs: [
          "Compare it with photos on the brand's own website: logo placement, labels, colours and materials. Look inside at labels, seams and linings, because that's where copies cut corners.",
          "For electronics, check the model number and that it powers on, and look for a genuine charger. Fake chargers can be dangerous.",
        ],
      },
      {
        heading: "If in doubt, leave it",
        paragraphs: [
          "A genuine bargain is worth having, but a doubtful one isn't. If you can't satisfy yourself it's real, don't buy it, and never list something as genuine unless you're sure.",
        ],
      },
    ],
  },
  {
    slug: "staying-safe",
    title: "Staying safe when selling",
    desc: "Avoid the common Marketplace scams",
    minutes: 3,
    intro:
      "Most buyers and sellers are genuine, but scammers use the same few tricks again and again. Know them and you'll spot them straight away.",
    sections: [
      {
        heading: "Meet in person, somewhere public",
        bullets: [
          "Meet in daylight, somewhere busy, and bring someone with you if you can.",
          "Let the buyer see the item before they pay, and see the money before they take it.",
          "Keep your chat inside FlipPilot, so there's a record, and report anyone who pushes you off the app.",
        ],
      },
      {
        heading: "The scams to know",
        bullets: [
          "The courier scam: a buyer who \"can't come\" but will pay first and send a courier. The payment confirmation is fake. Hand things over in person or not at all.",
          "Payment links: a link in a message that takes you to a page asking for your card or bank login. Always go to your bank or payment app yourself.",
          "Gift cards, vouchers or crypto: no genuine buyer or seller pays this way. It's a scam every time.",
          "Overpayment: someone \"accidentally\" pays too much and asks for the difference back. Their payment disappears, and so does your refund.",
        ],
      },
      {
        heading: "Getting paid",
        paragraphs: [
          "Cash in person is simplest. A bank transfer can't be undone and has no buyer or seller protection, so if you use one, check the money has arrived in your own banking app before the item leaves your hands. Never rely on a screenshot or an email.",
        ],
      },
      {
        heading: "Trust your instincts",
        paragraphs: [
          "If something feels rushed, too good to be true or oddly complicated, stop. You can always say no, and you can report a listing or a message from inside the app.",
        ],
      },
    ],
  },
];

export function guideBySlug(slug: string | undefined): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
