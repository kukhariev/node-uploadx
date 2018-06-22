// --------------------  FAKE AUTHORIZATION  MIDDLEWARE  --------------------
import { Request, Response, NextFunction } from 'express';
export const auth = (req: Request, res: Response, next: NextFunction) => {
  if (req.header('authorization')) {
    req.user = { id: '5678', name: 'user656', password: 'password1234' };
  }
  next();
};
