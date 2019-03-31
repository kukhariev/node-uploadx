// --------------------  FAKE AUTHORIZATION  MIDDLEWARE  --------------------
export const auth = (req, res, next) => {
  if (req.headers.authorization) {
    req['user'] = { id: '5678', name: 'user656', password: 'password1234' };
  }
  next();
};
