const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { notFound, errorHandler } = require('./middlewares/error');

const authRoutes = require('./modules/auth/auth.routes');
const invitesRoutes = require('./modules/users/invites.routes');
const usersRoutes = require('./modules/users/users.routes');
const complaintsRoutes = require('./modules/complaints/complaints.routes');
const statsRoutes = require('./modules/stats/stats.routes');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/', (req, res) => {
  res.json({ name: 'HostelCare+ API', status: 'running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

app.use('/api/auth', authRoutes);
// invites must mount before the users router, whose requireAuth guard
// would otherwise swallow the public /api/invites/:token endpoints
app.use('/api', invitesRoutes);
app.use('/api', usersRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/stats', statsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
