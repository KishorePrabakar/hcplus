const db = require('./src/db');
const { bcrypt } = require('./src/utils/tokens');

async function upsertUser(data) {
  const { password, ...rest } = data;
  return db.user.upsert({
    where: { email: rest.email },
    update: {},
    create: { ...rest, passwordHash: await bcrypt.hash(password, 12) },
  });
}

async function main() {
  const admin = await upsertUser({
    name: 'Hostel Admin',
    email: 'admin@hcplus.local',
    password: 'Admin@1234',
    role: 'ADMIN',
    status: 'ACTIVE',
  });

  const warden = await upsertUser({
    name: 'Warden Kumar',
    email: 'warden@hcplus.local',
    password: 'Warden@1234',
    role: 'WARDEN',
    status: 'ACTIVE',
  });

  const student = await upsertUser({
    name: 'Demo Student',
    email: 'student@hcplus.local',
    password: 'Student@1234',
    role: 'STUDENT',
    status: 'ACTIVE',
    hostel: 'Block A',
    roomNumber: 'A-204',
  });

  const existing = await db.complaint.findFirst({ where: { code: 'HC-0001' } });
  if (!existing) {
    const complaint = await db.complaint.create({
      data: {
        code: 'HC-0001',
        title: 'Ceiling fan not working in room',
        description:
          'The ceiling fan stopped working since yesterday evening. It spins very slowly and makes a grinding noise before stopping completely.',
        category: 'ELECTRICAL',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        createdById: student.id,
        assignedToId: warden.id,
      },
    });

    await Promise.all([
      db.statusEvent.create({
        data: { complaintId: complaint.id, actorId: student.id, fromStatus: null, toStatus: 'OPEN', note: 'Complaint filed' },
      }),
      db.statusEvent.create({
        data: { complaintId: complaint.id, actorId: warden.id, fromStatus: 'OPEN', toStatus: 'IN_PROGRESS', note: 'Assigned to Warden Kumar' },
      }),
      db.comment.create({
        data: { complaintId: complaint.id, authorId: warden.id, body: 'Electrician has been informed. Expect a visit tomorrow morning.' },
      }),
    ]);
  }

  console.log('Seeded:', {
    admin: admin.email,
    warden: warden.email,
    student: student.email,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
