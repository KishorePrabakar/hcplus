const db = require('../db');

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  hostel: u.hostel,
  roomNumber: u.roomNumber,
  createdAt: u.createdAt,
});

async function getUserById(id) {
  return db.user.findUnique({ where: { id } });
}

module.exports = { publicUser, getUserById };
