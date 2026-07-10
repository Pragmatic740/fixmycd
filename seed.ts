import { db } from './src/db';
import {
  users, reports, upvotes, comments, notifications, follows, savedSearches, flags,
} from './src/db/schema';
import crypto from 'crypto';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const PASSWORD = 'password123';
const passwordHash = bcrypt.hashSync(PASSWORD, 10);

const SEED_USERS = [
  { email: 'citizen1@fixmydistrict.app', displayName: 'Tendai Moyo', role: 'submitter' },
  { email: 'citizen2@fixmydistrict.app', displayName: 'Rudo Chikwanha', role: 'submitter' },
  { email: 'citizen3@fixmydistrict.app', displayName: 'Farai Ndlovu', role: 'submitter' },
  { email: 'viewer@fixmydistrict.app', displayName: 'District Viewer', role: 'viewer' },
  { email: 'referee@fixmydistrict.app', displayName: 'Referee Admin', role: 'referee' },
  { email: 'admin@fixmydistrict.app', displayName: 'System Admin', role: 'admin' },
];

const SAMPLE_REPORTS = [
  { title: 'Deep Pothole on 4th St', desc: 'Large pothole causing flat tires near the intersection.', status: 'submitted', severity: 4, category: 'Road', subcategory: 'Pothole', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=800&q=80', author: 0 },
  { title: 'Traffic Light Out', desc: 'Main intersection light completely out. Very dangerous during rush hour.', status: 'in_review', severity: 5, category: 'Traffic', subcategory: 'Broken Light', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1498855926480-d98e83099315?auto=format&fit=crop&w=800&q=80', author: 1 },
  { title: 'Graffiti on Park Wall', desc: 'Offensive graffiti near the children play area.', status: 'submitted', severity: 2, category: 'Buildings', subcategory: 'Graffiti', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1533158326339-7f3cf2404354?auto=format&fit=crop&w=800&q=80', author: 2 },
  { title: 'Burst Water Main', desc: 'Water gushing from sidewalk near the library. Street starting to flood.', status: 'in_progress', severity: 5, category: 'Water', subcategory: 'Burst Main', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=800&q=80', author: 0 },
  { title: 'Fallen Tree Branch', desc: 'Large branch blocking pedestrian path near park entrance.', status: 'submitted', severity: 3, category: 'Parks', subcategory: 'Fallen Tree', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=800&q=80', author: 1 },
  { title: 'Missing Stop Sign', desc: 'Stop sign knocked down at Elm and 2nd. Drivers not stopping.', status: 'accepted', severity: 5, category: 'Traffic', subcategory: 'Missing Stop Sign', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=800&q=80', author: 2, featured: true },
  { title: 'School Roof Damage', desc: 'Visible holes in roof at Lincoln Elementary after last storm.', status: 'submitted', severity: 4, category: 'Schools', subcategory: 'Roof Damage', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937bf7?auto=format&fit=crop&w=800&q=80', author: 0 },
  { title: 'Power Line Down', desc: 'Downed power line on Riverside Drive. Area cordoned off.', status: 'in_review', severity: 5, category: 'Utilities', subcategory: 'Downed Line', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=800&q=80', author: 1 },
  { title: 'Pothole Repaired on Main', desc: 'Crew finished patching the crater on Main St. Good progress!', status: 'resolved', severity: 2, category: 'Road', subcategory: 'Pothole', postAction: 'fix', imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80', author: 2 },
  { title: 'Broken Streetlight on Oak Ave', desc: 'Third light from the corner has been out for two weeks.', status: 'submitted', severity: 3, category: 'Traffic', subcategory: 'Broken Light', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=800&q=80', author: 0 },
  { title: 'Abandoned Factory Window', desc: 'Broken windows at old textile plant. Safety hazard for kids.', status: 'submitted', severity: 3, category: 'Buildings', subcategory: 'Abandoned Factory', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80', author: 1 },
  { title: 'Flooded Crosswalk', desc: 'Crosswalk submerged after storm drain blocked on 5th Ave.', status: 'submitted', severity: 4, category: 'Water', subcategory: 'Leak', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1534081331062-3beee543c47f?auto=format&fit=crop&w=800&q=80', author: 2 },
  { title: 'Playground Equipment Rust', desc: 'Swing set rusting through at community park. Needs replacement.', status: 'submitted', severity: 3, category: 'Parks', subcategory: 'Broken Equipment', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1560785477-0909b659d985?auto=format&fit=crop&w=800&q=80', author: 0 },
  { title: 'Gas Leak Smell Reported', desc: 'Strong gas odor near corner store on 3rd St.', status: 'in_review', severity: 5, category: 'Utilities', subcategory: 'Gas Leak', postAction: 'failure', imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80', author: 1 },
  { title: 'Road Resurfacing Update', desc: 'Crew started resurfacing block between 4th and 5th.', status: 'in_progress', severity: 1, category: 'Road', subcategory: 'Crumbling Surface', postAction: 'update', imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=800&q=80', author: 2 },
];

const SAMPLE_COMMENTS = [
  'I drive this route daily — this is getting worse.',
  'Reported this to the city last month, still nothing.',
  'Thanks for documenting this. Shared with my neighborhood group.',
  'Can confirm, almost hit it yesterday.',
  'City council needs to see this.',
];

async function seed() {
  console.log('Seeding Postgres database...');

  await db.delete(flags);
  await db.delete(notifications);
  await db.delete(comments);
  await db.delete(upvotes);
  await db.delete(savedSearches);
  await db.delete(follows);
  await db.delete(reports);
  await db.delete(users);

  const userIds: string[] = [];
  for (const u of SEED_USERS) {
    const id = crypto.randomUUID();
    userIds.push(id);
    await db.insert(users).values({
      id,
      email: u.email,
      displayName: u.displayName,
      passwordHash,
      role: u.role,
      bio: `${u.displayName} — FixMyDistrict community member`,
      createdAt: new Date(),
    });
  }

  const reportIds: string[] = [];
  for (let i = 0; i < SAMPLE_REPORTS.length; i++) {
    const r = SAMPLE_REPORTS[i];
    const id = crypto.randomUUID();
    reportIds.push(id);
    await db.insert(reports).values({
      id,
      referenceNo: `FMD-${1000 + i}`,
      submitterId: userIds[r.author],
      title: r.title,
      description: r.desc,
      latitude: -17.8292 + (Math.random() * 0.06 - 0.03),
      longitude: 31.0522 + (Math.random() * 0.06 - 0.03),
      severity: r.severity,
      status: r.status,
      category: r.category,
      subcategory: r.subcategory,
      postAction: r.postAction,
      postType: 'new',
      imageUrl: r.imageUrl,
      featured: 'featured' in r ? r.featured : false,
      aiSummary: r.status === 'accepted' ? `Critical ${r.category?.toLowerCase()} issue requiring immediate attention.` : null,
      createdAt: new Date(Date.now() - i * 3600000 * 6),
    });
  }

  // Unique (user, report) pairs — avoid unique-index collisions
  let upvoteCount = 0;
  for (let u = 0; u < 3; u++) {
    for (let r = 0; r < reportIds.length && upvoteCount < 25; r++) {
      if ((u + r) % 2 === 0) continue;
      await db.insert(upvotes).values({
        id: crypto.randomUUID(),
        userId: userIds[u],
        reportId: reportIds[r],
        createdAt: new Date(),
      });
      upvoteCount++;
    }
  }

  for (let i = 0; i < 15; i++) {
    await db.insert(comments).values({
      id: crypto.randomUUID(),
      reportId: reportIds[i % reportIds.length],
      userId: userIds[(i + 1) % 3],
      body: SAMPLE_COMMENTS[i % SAMPLE_COMMENTS.length],
      createdAt: new Date(),
    });
  }

  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId: userIds[0],
    type: 'upvote',
    actorId: userIds[1],
    reportId: reportIds[0],
    read: false,
    createdAt: new Date(),
  });

  await db.insert(follows).values({
    id: crypto.randomUUID(),
    userId: userIds[3],
    followType: 'category',
    targetId: 'Road',
    createdAt: new Date(),
  });

  await db.insert(savedSearches).values({
    id: crypto.randomUUID(),
    userId: userIds[0],
    name: 'Critical potholes',
    queryJson: JSON.stringify({ category: 'Road', severity: '4' }),
    createdAt: new Date(),
  });

  console.log('Database seeded successfully!');
  console.log(`Login with any user email and password: ${PASSWORD}`);
  console.log('Users:', SEED_USERS.map((u) => u.email).join(', '));
}

seed().catch(console.error).finally(() => process.exit(0));
