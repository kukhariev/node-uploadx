const auth = (req, res, next) => {
  req.user = { id: 'userId' };
  next();
};
module.exports = { auth };
