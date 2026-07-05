import { db } from './src/db';
import { users, reports } from './src/db/schema';
import crypto from 'crypto';

async function seed() {
  console.log('Seeding database...');
  
  const userId = crypto.randomUUID();
  
  await db.insert(users).values({
    id: userId,
    email: 'mentor@fixmydistrict.app',
    displayName: 'Mentor User',
    role: 'submitter',
    createdAt: new Date(),
  });

  const sampleReports = [
    { title: 'Deep Pothole on 4th St', category: 'Roads & Potholes', desc: 'Large pothole causing flat tires. Avoid the right lane.', status: 'Submitted', severity: 4 },
    { title: 'Traffic Light Out', category: 'Signals', desc: 'Main intersection light is completely out, 4-way stop in effect.', status: 'In Review', severity: 5 },
    { title: 'Graffiti on Park Wall', category: 'Vandalism', desc: 'Offensive graffiti found on the east wall of the community park.', status: 'Shortlisted', severity: 2 },
    { title: 'Burst Water Main', category: 'Water', desc: 'Water is gushing out of the sidewalk near the library.', status: 'In Progress', severity: 5 },
    { title: 'Fallen Tree Branch', category: 'Parks', desc: 'Large branch blocking the pedestrian path near the lake.', status: 'Submitted', severity: 3 }
  ];

  for (const report of sampleReports) {
    await db.insert(reports).values({
      id: crypto.randomUUID(),
      referenceNo: `FMD-${Math.floor(Math.random() * 10000)}`,
      submitterId: userId,
      title: report.title,
      description: report.desc,
      latitude: -17.8292 + (Math.random() * 0.05 - 0.025), // slight randomization
      longitude: 31.0522 + (Math.random() * 0.05 - 0.025),
      severity: report.severity,
      status: report.status,
      createdAt: new Date(),
    });
  }
  
  console.log('Database seeded successfully!');
}

seed().catch(console.error);
