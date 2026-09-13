const jwt = require('jsonwebtoken');

const generateToken = (id, type) => {
  return jwt.sign({ id, type }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

module.exports = generateToken;
