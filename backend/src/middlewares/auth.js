const { verifyAccessToken } = require('../utils/tokens');
const db = require('../db');
const { ApiError } = require('./error');
const { publicUser } = require('../utils/user');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in required');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, 'TOKEN_INVALID', 'Session expired, sign in again');
    }

    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new ApiError(401, 'USER_GONE', 'Account no longer exists');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

const requireActive = (req, res, next) => {
  if (req.user.status === 'PENDING') {
    return next(new ApiError(403, 'ACCOUNT_PENDING', 'Your account is awaiting warden approval'));
  }
  if (req.user.status === 'SUSPENDED') {
    return next(new ApiError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended'));
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission for this action'));
  }
  next();
};

const requireActiveStaff = [requireRole('WARDEN', 'ADMIN'), requireActive];
const requireAdmin = [requireRole('ADMIN'), requireActive];

module.exports = { requireAuth, requireActive, requireRole, requireActiveStaff, requireAdmin, publicUser };
