import { db } from './src/db';
import { users, reports } from './src/db/schema';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('Seeding Postgres database with images...');
  
  // Try to find if user already exists
  let userList = await db.select().from(users).limit(1);
  let userId = userList[0]?.id;
  
  if (!userId) {
    userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      email: 'mentor@fixmydistrict.app',
      displayName: 'Mentor User',
      role: 'submitter',
      createdAt: new Date(),
    });
  }

  const sampleReports = [
    { 
      title: 'Deep Pothole on 4th St', 
      desc: 'Large pothole causing flat tires. Avoid the right lane near the intersection.', 
      status: 'Submitted', 
      severity: 4,
      imageUrl: 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=800&q=80'
    },
    { 
      title: 'Traffic Light Out', 
      desc: 'Main intersection light is completely out, 4-way stop in effect. Very dangerous during rush hour.', 
      status: 'In Review', 
      severity: 5,
      imageUrl: 'https://images.unsplash.com/photo-1498855926480-d98e83099315?auto=format&fit=crop&w=800&q=80'
    },
    { 
      title: 'Graffiti on Park Wall', 
      desc: 'Offensive graffiti found on the east wall of the community park near the children play area.', 
      status: 'Submitted', 
      severity: 2,
      imageUrl: 'https://images.unsplash.com/photo-1533158326339-7f3cf2404354?auto=format&fit=crop&w=800&q=80'
    },
    { 
      title: 'Burst Water Main', 
      desc: 'Water is gushing out of the sidewalk near the library. The street is starting to flood.', 
      status: 'In Progress', 
      severity: 5,
      imageUrl: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&w=800&q=80'
    },
    { 
      title: 'Fallen Tree Branch', 
      desc: 'Large branch blocking the pedestrian path near the park entrance. Walkers must detour onto the road.', 
      status: 'Submitted', 
      severity: 3,
      imageUrl: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=800&q=80'
    }
  ];

  // Clear existing reports first to avoid duplicate reference numbers
  await db.delete(reports);

  for (const report of sampleReports) {
    await db.insert(reports).values({
      id: crypto.randomUUID(),
      referenceNo: `FMD-${Math.floor(1000 + Math.random() * 9000)}`,
      submitterId: userId,
      title: report.title,
      description: report.desc,
      latitude: -17.8292 + (Math.random() * 0.05 - 0.025), // slight randomization
      longitude: 31.0522 + (Math.random() * 0.05 - 0.025),
      severity: report.severity,
      status: report.status,
      imageUrl: report.imageUrl,
      createdAt: new Date(),
    });
  }
  
  console.log('Database seeded successfully!');
}

seed().catch(console.error).finally(() => process.exit(0));
