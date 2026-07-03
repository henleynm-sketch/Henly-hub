import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HENLEY_INBOX = "+17052426548";
const INTERNAL_PHONES = new Set(["+19052446003", "+19052600358"]);

type RawMessage = {
  direction: "IN" | "OUT";
  ts: string;
  body: string;
};

type Conversation = {
  phone: string;
  name: string;
  kind: "CLIENT" | "SUB" | "NOISE";
  messages: RawMessage[];
};

const CONVERSATIONS: Conversation[] = [
  {
    phone: "+12898304620",
    name: "Sean Walker",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-04-02T14:13:58.953Z", body: "Hi Sean, this is Victoria from Henley Contracting. I hope you've had a great week! \n\nWe would like to set up a meeting with you and Sherri next week to go through our construction proposal. Our preference is to meet in person all together for about 1 hour to go through everything and answer any questions you may have. \n\nPlease let me know a time next week we can schedule in this meeting for you guys! Talk soon." },
      { direction: "IN", ts: "2026-04-02T16:12:20.421Z", body: "Hi Victoria. That would be great. What time are you available? Where would you like to meet?" },
      { direction: "IN", ts: "2026-04-02T16:12:38.622Z", body: "My wife has lunch around 12:30- 1:30" },
      { direction: "OUT", ts: "2026-04-06T20:17:48.037Z", body: "Hey Sean, I hope you've had a great weekend! This week we have availability tomorrow, Thursday and Friday 12:30-1:30\n\nWe can bring this meeting to you within your home if that is most convenient for you. I know you mentioned you were starting demo so let me know if that would work or not." },
      { direction: "IN", ts: "2026-04-06T20:18:44.424Z", body: "Thursday sounds great. At our house is great too" },
      { direction: "OUT", ts: "2026-04-06T20:21:33.300Z", body: "Wonderful I will get you booked in and send you a calendar invite" },
      { direction: "IN", ts: "2026-04-06T20:21:50.728Z", body: "Perfect. Thank you" },
      { direction: "IN", ts: "2026-04-10T13:05:12.201Z", body: "Good morning Victoria. Any luck having the proposal sent over?" },
      { direction: "OUT", ts: "2026-04-10T14:23:11.055Z", body: "Hi Sean, this is Nick. I've been out with the flu this week and pushed my schedule.\nBecause I know how important this project is, I don't want to just send a quote over email. For similar clients who updated a family home, the best approach is to customize the proposal with you. Review the details, answer your questions, and ensure the plan reflects what works best for you.\nIf you need to move ahead immediately that's ok, I understand. If you're comfortable waiting until next week, Ill come by and go over it with you. Is that ok?" },
      { direction: "IN", ts: "2026-04-10T16:38:53.218Z", body: "Hi Nick. My apologies on sending this text while you are under the weather. For some reason I have 2 messages from Henley 705 242 6548 and a 905 244-6003. Not sure how these are crossed. The first one came from Victoria and the later from you.\n\nNext week is still great. See you Thursday. Feel better" },
      { direction: "OUT", ts: "2026-04-13T18:11:02.271Z", body: "Hey Sean, happy Monday! This phone number is our team texting line we use to communicate with customers. The 6003 number you have is Nicks direct phone and text line. Sorry for any confusion! \n\nSee you Thursday! -Victoria" },
      { direction: "IN", ts: "2026-04-15T21:52:30.611Z", body: "Hi Victoria. Any chance we can move up tomorrow's meeting?" },
      { direction: "OUT", ts: "2026-04-15T22:06:13.758Z", body: "Hey Sean, our availability is quite flexible tomorrow morning. Is there a time which works best for you?" },
      { direction: "IN", ts: "2026-04-15T22:06:51.514Z", body: "9 am?" },
      { direction: "OUT", ts: "2026-04-15T23:54:49.858Z", body: "No problem I've moved you up to 9am. Have a great evening!" },
      { direction: "IN", ts: "2026-04-15T23:55:00.415Z", body: "Great!" },
      { direction: "IN", ts: "2026-04-15T23:55:06.410Z", body: "Thank you" },
    ],
  },
  {
    phone: "+14168826377",
    name: "Linda Paterson Bier",
    kind: "CLIENT",
    messages: [
      { direction: "IN", ts: "2026-03-25T19:02:27.243Z", body: "Hi Victoria, it's Linda Paterson Bier" },
      { direction: "OUT", ts: "2026-03-25T19:25:45.152Z", body: "Hi Linda! Great speaking with you today. Excellent, thanks for sharing! I am sending the calendar link to our call now. Let's try connecting on Teams mobile to start out and if that doesn't work we can switch to FaceTime if needed. \n\nTo use teams you can download the app for mobile and join as a guest. Talk soon!" },
      { direction: "IN", ts: "2026-03-25T19:37:30.482Z", body: "So nice speaking with you as well! Sounds like a great plan. Chat tomorrow" },
      { direction: "IN", ts: "2026-03-26T15:29:25.519Z", body: "[photo: inspiration]" },
      { direction: "IN", ts: "2026-03-26T15:30:09.424Z", body: "Bar seating on each side of double door" },
      { direction: "IN", ts: "2026-03-26T15:31:22.141Z", body: "[photo: railing]" },
      { direction: "IN", ts: "2026-03-26T15:31:37.620Z", body: "Railing style on upper decking" },
      { direction: "IN", ts: "2026-03-26T15:40:10.577Z", body: "Just a few photos of things that we like. See you in a few minutes" },
      { direction: "OUT", ts: "2026-03-26T15:44:17.888Z", body: "Awesome! Thank you for sharing" },
      { direction: "OUT", ts: "2026-03-26T16:01:09.104Z", body: "Hi Linda I'm in teams ready when you are! Let me know if you are having trouble signing into our meeting through the link" },
      { direction: "IN", ts: "2026-03-26T17:03:20.587Z", body: "Just an fyi ^^" },
      { direction: "OUT", ts: "2026-03-26T17:04:41.931Z", body: "Oh I love!! Serena and Lily it's just soo good!" },
      { direction: "IN", ts: "2026-03-26T17:05:06.173Z", body: "lol I agree" },
      { direction: "IN", ts: "2026-05-04T16:48:43.411Z", body: "Hi Victoria, \nWe are back from Hawaii. Wondering if we can do our second meeting soon so we can keep the ball rolling on the boathouse. \nLet me know your schedule when you have a minute. \nMany thanks!\nLinda" },
    ],
  },
  {
    phone: "+16472724955",
    name: "Bryce Marshall",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-03-05T21:41:09.634Z", body: "Hi Bryce, I'm Victoria from the Henley team. I received your voicemail looking for someone from our team to check out some structural issues. Feel free to connect with me over text to fill me in a bit on your project and what you're hoping we can help with. \n\nLooking forward to connecting! -Victoria" },
      { direction: "IN", ts: "2026-03-10T13:16:16.268Z", body: "Hi Victoria. Can I give you a call today?" },
      { direction: "OUT", ts: "2026-03-10T13:47:41.027Z", body: "Oh course, I am available this morning or anytime after 3pm today. Talk soon!" },
      { direction: "IN", ts: "2026-03-16T18:54:01.155Z", body: "Hi Victoria. Tried you back a few times and we keep missing each other. Let me know when you're free. Thanks." },
      { direction: "OUT", ts: "2026-03-17T19:48:24.923Z", body: "Hi Bryce I am Available for a call this afternoon until 5pm or anytime tomorrow between 9-12" },
      { direction: "OUT", ts: "2026-03-17T21:16:06.160Z", body: "Hey Bryce, great to finally connect with you! I have sent a tentative calendar invite holding and onsite consultation meeting for Monday March 23, 12:30-1:30 to your email address marshallbhh@gmail.com\n\nPlease confirm this date and time works for you and Nick will be by to see your project. Thanks!" },
      { direction: "IN", ts: "2026-03-17T23:05:10.248Z", body: "Confirmed. Good for next Monday at 1230." },
      { direction: "OUT", ts: "2026-03-19T20:18:31.102Z", body: "Excellent!" },
    ],
  },
  {
    phone: "+19055501359",
    name: "David Byrne",
    kind: "CLIENT",
    messages: [
      { direction: "IN", ts: "2026-04-15T20:14:12.432Z", body: "That works well!!" },
      { direction: "OUT", ts: "2026-04-15T20:34:13.273Z", body: "Okay great! I don't have an email on file to send this teams meeting invite to. Could you please send your email?" },
      { direction: "IN", ts: "2026-04-15T20:52:09.726Z", body: "davidbyrnetwo@gmail.com" },
      { direction: "OUT", ts: "2026-04-15T20:52:53.743Z", body: "Wonderful sending now!" },
      { direction: "IN", ts: "2026-04-15T20:53:42.450Z", body: "Thank you. See you in a minute." },
      { direction: "IN", ts: "2026-04-15T21:03:02.597Z", body: "Our computer is having trouble with Teams." },
      { direction: "IN", ts: "2026-04-15T21:03:20.673Z", body: "We just need to restart. Update related." },
      { direction: "OUT", ts: "2026-04-15T21:03:29.189Z", body: "No problem!" },
    ],
  },
  {
    phone: "+12899233237",
    name: "Brittany",
    kind: "CLIENT",
    messages: [
      { direction: "IN", ts: "2026-01-13T12:41:29.472Z", body: "Yup sounds good!" },
      { direction: "OUT", ts: "2026-01-13T12:40:16.762Z", body: "Hi there Brittany this is Nick from Henley Contracting. Thanks for reaching out to us! Can I call you this morning around 830am?" },
      { direction: "IN", ts: "2026-01-16T17:41:12.188Z", body: "Hi Nick! Just wanted to confirm we are still booked for 1:00pm today?" },
      { direction: "OUT", ts: "2026-01-16T17:49:12.187Z", body: "Yes on my way" },
      { direction: "IN", ts: "2026-01-16T17:49:48.136Z", body: "Awesome" },
      { direction: "OUT", ts: "2026-01-16T17:50:20.681Z", body: "I'm just running 5 minutes behind" },
      { direction: "IN", ts: "2026-01-16T17:50:28.276Z", body: "No problem" },
      { direction: "IN", ts: "2026-01-28T22:14:19.403Z", body: "Hey Nick, are we still meeting today?" },
      { direction: "OUT", ts: "2026-01-28T22:18:19.333Z", body: "Hi Brittany, this is Victoria from the Henley Contracting Team. I am the Client Experience Concierge texting you from our team phone line.\n\nAs you navigate through your project with Henley Contracting, I will be here to guide you through the entire process letting you know next steps, setting up meetings and answering any questions you may have along the way. Think of me as your personal Henley Contracting concierge! \n\nPS; I'm a real person on the other end of the line – no AI bot here!" },
      { direction: "OUT", ts: "2026-01-28T22:19:07.159Z", body: "Nick does have you in the calendar to meet tonight! If you have any questions following your on-site consultation please let me know! \n-Victoria" },
      { direction: "IN", ts: "2026-01-28T22:20:06.250Z", body: "Okay thank you!" },
    ],
  },
  {
    phone: "+19052601263",
    name: "Aunt Jan",
    kind: "CLIENT",
    messages: [
      { direction: "IN", ts: "2026-04-10T17:00:18.760Z", body: "Hi Nick. Thank you for the message. I'm so glad you will be able to get this going, as I know how busy you are." },
      { direction: "OUT", ts: "2026-04-10T16:29:32.772Z", body: "Hi there Auntie Jan this is Nick! This is our office line I'm going to connect you on here to Victoria she's going to gather some information and we're going to get your projects all scheduled for this spring. Thanks for being so patient with us" },
      { direction: "IN", ts: "2026-05-01T17:53:02.440Z", body: "Hi Nick. Am I still on the list?" },
      { direction: "IN", ts: "2026-05-04T12:30:10.441Z", body: "I was wondering if my projects will fit into your schedule for spring. I heard from Victoria on April 13th. Nothing since." },
      { direction: "OUT", ts: "2026-05-04T16:41:12.001Z", body: "hi Aunt Jan!! Yes you are!" },
      { direction: "IN", ts: "2026-05-04T16:48:06.684Z", body: "Hi Nick. Thank you so much!" },
    ],
  },
  {
    phone: "+14163999931",
    name: "Tom (Balsam garage)",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-05-05T18:47:11.786Z", body: "hi Tom, this is Nick Henley, Mike's son. This is our office line. Do you have a survey for your property on Balsam?" },
      { direction: "IN", ts: "2026-05-05T18:49:12.998Z", body: "I sent one recently to Mike, but can do one to you.\nJustin send me by email the email address you wish me to send it to.\nTom" },
      { direction: "OUT", ts: "2026-05-05T18:54:28.486Z", body: "ok great ill find it in Mike's email, no problem" },
      { direction: "OUT", ts: "2026-05-05T21:02:03.675Z", body: "hi Tom, do you have a copy of the septic design for your lot? and approximately how big do you think the garage should be?" },
      { direction: "IN", ts: "2026-05-05T23:48:48.557Z", body: "Nick,\nThe premise for the new garage is bringing a car (23 years old and special to me) back from Florida. It is a complicated process I am working through as it is now registered there, but was originally a Canadian car I sent there 10 years ago.\nLet's hold off on any more work until I get some certainty.\nWorking on it." },
      { direction: "OUT", ts: "2026-05-06T14:42:20.701Z", body: "no problem Tom! I found the septic design from Shepherds. Ill email it to you for your records." },
    ],
  },
  {
    phone: "+19054400061",
    name: "Jim (Balsam property)",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-05-05T18:37:44.005Z", body: "hi Jim, this is Nick Henley, are you still looking at doing a new garage on your Balsam property? How's the property looking after the winter thaw?" },
    ],
  },
  {
    phone: "+19059273134",
    name: "Lucy (4 Wylie Lane)",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-04-13T21:49:10.519Z", body: "Hi Lucy this is Nick Henley from Henley Contracting were the builder for 4 Wylie Lane in stouffville" },
    ],
  },
  {
    phone: "+16472622888",
    name: "Patrick (54 Mason Lane)",
    kind: "CLIENT",
    messages: [
      { direction: "OUT", ts: "2026-05-02T17:04:31.320Z", body: "Hi Patrick, this is victoria from Henley Contracting. We have a measure scheduled for today 3-4pm at our 54 Mason Lane project on Balsam Lake. \n\nOur owner Mike Henley will meet you there. If you could give him a call once you're onsite he will be right over. \n\nHis cell is 905-260-0358" },
    ],
  },
  {
    phone: "+19052591984",
    name: "Chris (tree removal)",
    kind: "SUB",
    messages: [
      { direction: "OUT", ts: "2026-05-05T20:19:47.890Z", body: "thank you sir" },
      { direction: "OUT", ts: "2026-05-05T20:53:44.731Z", body: "whats new chris, how have you been? hey did you ever do the trees at my uncle dave's place at 87 lakeview cottage road?" },
      { direction: "IN", ts: "2026-05-05T21:11:09.202Z", body: "We have been good Nick, busy with our house build up here. \nNo I didn't end up doing anymore there. For some reason I thought he had someone else doing a bit of work there and I was waiting to hear from Mike." },
      { direction: "OUT", ts: "2026-05-05T19:27:43.813Z", body: "hi Chris, this is Nick Henley, this is our office, can you go by 135 Ridge Dr on Balsam Lake, the client marked a bunch of tree's to be removed. We're going to be adding onto the one cottage on the left side of the lot." },
      { direction: "IN", ts: "2026-05-05T19:29:34.257Z", body: "Yeah I should be able to swing by there tomorrow sometime" },
      { direction: "IN", ts: "2026-05-12T21:07:55.354Z", body: "Hey Nick, \nI stopped by that site last week. \n\nIt would be about 6400$ to get that stuff down and out of there. Not including any stump grinding." },
    ],
  },
  {
    phone: "+17058799988",
    name: "Adam (permit / Schedule 1)",
    kind: "SUB",
    messages: [
      { direction: "OUT", ts: "2026-05-08T14:05:55.135Z", body: "Hi Adam, this is Ashley from Henley.  I sent you an email yesterday to update the schedule 1 form.  Please have a look at the email and return so I can resubmit.  We have submitted with the original dwgs to get the permit review started.  Thank you." },
      { direction: "IN", ts: "2026-05-08T14:44:58.236Z", body: "Hey Ashley, I have one filled out I just need Glen to sign it then I will get it to you" },
    ],
  },
  {
    phone: "+19056221776",
    name: "Peter (HVAC — 10201 Mud Lake Rd)",
    kind: "SUB",
    messages: [
      { direction: "OUT", ts: "2026-05-04T16:40:54.487Z", body: "Hi Peter, this is Nick Henley, did we have an HVAC design for 10201 Mud Lake Road?" },
      { direction: "IN", ts: "2026-05-04T16:58:06.694Z", body: "Yes there is. Do you need a copy?" },
      { direction: "OUT", ts: "2026-05-04T17:05:16.898Z", body: "yes please send to ashley" },
      { direction: "IN", ts: "2026-05-04T17:31:51.449Z", body: "Okay" },
      { direction: "IN", ts: "2026-05-04T17:37:01.174Z", body: "All sent." },
      { direction: "OUT", ts: "2026-05-05T15:05:28.097Z", body: "thank you sir!" },
    ],
  },
  {
    phone: "+19054320531",
    name: "Joe (septic permits)",
    kind: "SUB",
    messages: [
      { direction: "OUT", ts: "2026-05-04T16:40:23.600Z", body: "hi Joe, this is Nick Henley, Did we get the septic permit for 10201 Mudlake Road." },
      { direction: "IN", ts: "2026-05-04T16:41:10.545Z", body: "I'm 99 % sure we did" },
      { direction: "OUT", ts: "2026-05-04T16:41:37.443Z", body: "ok can you check your files? or who would we follow up with on that?" },
      { direction: "IN", ts: "2026-05-04T16:42:50.867Z", body: "It went through port Perry office so it would be from crystal Williams" },
      { direction: "OUT", ts: "2026-05-04T16:43:05.791Z", body: "ok can you email her and copy us please?" },
      { direction: "IN", ts: "2026-05-04T16:45:23.598Z", body: "What's your email" },
      { direction: "OUT", ts: "2026-05-04T16:48:24.279Z", body: "projects@henleycontracting.com" },
      { direction: "OUT", ts: "2026-05-04T16:48:30.819Z", body: "thats ashley, copy her" },
    ],
  },
  {
    phone: "+14168177017",
    name: "Wrong number",
    kind: "NOISE",
    messages: [
      { direction: "IN", ts: "2026-03-13T00:36:29.480Z", body: "Where are you?" },
      { direction: "IN", ts: "2026-03-13T01:00:54.667Z", body: "I don't think you meant this for me!" },
      { direction: "IN", ts: "2026-03-13T01:01:35.461Z", body: "Oh jeez I meant this for my husband, not for you!! Sorry." },
    ],
  },
  {
    phone: "+15077096859",
    name: "Unknown sender",
    kind: "NOISE",
    messages: [
      { direction: "IN", ts: "2026-04-30T17:23:45.785Z", body: "do u still need work.?" },
    ],
  },
  {
    phone: "+17163551654",
    name: "Recruiter spam",
    kind: "NOISE",
    messages: [
      { direction: "IN", ts: "2026-05-10T20:44:38.267Z", body: "Hey, remote role openings are available actually, can I provide further information?" },
    ],
  },
];

function normalizePhone(p: string): string {
  return p.replace(/\D/g, "");
}

function formatPhone(p: string): string {
  const d = normalizePhone(p);
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return p;
}

async function main() {
  console.log("Wiping existing threads + messages...");
  await prisma.message.deleteMany();
  await prisma.thread.deleteMany();

  const clients = await prisma.client.findMany();
  const phoneToClient = new Map<string, string>();
  for (const c of clients) {
    if (c.primaryPhone) {
      phoneToClient.set(normalizePhone(c.primaryPhone), c.id);
    }
  }
  console.log(`Loaded ${clients.length} clients (${phoneToClient.size} with phones).`);

  let totalThreads = 0;
  let totalMessages = 0;
  let linkedThreads = 0;

  for (const conv of CONVERSATIONS) {
    if (INTERNAL_PHONES.has(conv.phone)) continue;

    const sorted = [...conv.messages].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );
    const lastAt = new Date(sorted[sorted.length - 1].ts);
    const clientId = phoneToClient.get(normalizePhone(conv.phone)) ?? null;

    const subjectName =
      conv.kind === "NOISE" ? `Unknown · ${formatPhone(conv.phone)}` : conv.name;

    const thread = await prisma.thread.create({
      data: {
        clientId,
        subject: subjectName,
        channel: "SMS",
        lastAt,
        unread: sorted.filter((m) => m.direction === "IN").length > 0 && conv.kind !== "NOISE" ? 1 : 0,
      },
    });

    for (const m of sorted) {
      await prisma.message.create({
        data: {
          threadId: thread.id,
          direction: m.direction,
          body: m.body,
          channel: "SMS",
          fromName: m.direction === "IN" ? conv.name : "Henley team",
          sentAt: new Date(m.ts),
        },
      });
    }

    totalThreads += 1;
    totalMessages += sorted.length;
    if (clientId) linkedThreads += 1;

    const linkMark = clientId ? "→ client" : "(unlinked)";
    console.log(`  ${conv.kind.padEnd(6)} ${conv.name.padEnd(34)} ${sorted.length} msgs  ${linkMark}`);
  }

  console.log(`\nDone. ${totalThreads} threads (${linkedThreads} linked to clients), ${totalMessages} messages.`);
  console.log(`Inbox source: Quo workspace, ${HENLEY_INBOX} (Henley Contracting Ltd).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
