const errorHandler = (err, req, res, next) => {
  res.status(err.status || err.statusCode || 500).json({
    error: {
      message: err.message || 'Internal Server Error'
    }
  });
};

module.exports = { errorHandler };
