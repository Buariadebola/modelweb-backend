const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.type !== 'model') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.',
    });
  }

  return next();
};

module.exports = requireAdmin;
