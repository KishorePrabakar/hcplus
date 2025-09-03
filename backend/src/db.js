const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { databaseUrl } = require('./config');

const prisma =
  global.__hcplusPrisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

if (process.env.NODE_ENV !== 'production') global.__hcplusPrisma = prisma;

module.exports = prisma;
