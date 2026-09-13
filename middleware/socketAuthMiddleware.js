const jwt = require('jsonwebtoken');

const socketAuthMiddleware = (socket, next) => {
  try {
    const authHeader = socket.handshake.headers.authorization || '';
    const authToken = socket.handshake.auth?.token;

    const rawToken = typeof authToken === 'string'
      ? authToken
      : authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : null;

    if (!rawToken) {
      return next(new Error('Authentication error: token missing'));
    }

    const decoded = jwt.verify(rawToken, process.env.JWT_SECRET);

    if (!decoded || !decoded.id || !decoded.type) {
      return next(new Error('Authentication error: invalid token payload'));
    }

    socket.user = {
      id: decoded.id,
      type: decoded.type,
    };

    return next();
  } catch (error) {
    return next(new Error('Authentication error: invalid or expired token'));
  }
};

module.exports = socketAuthMiddleware;
