import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'coffee_pos_secret_key_2026';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: 'OWNER' | 'CASHIER' | 'STOCK_MANAGER';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Try Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      req.user = decoded;
      return next();
    } catch (err) {
      // Token invalid, fall back to cashier header or default
    }
  }

  // 2. Try x-cashier-id or x-user-id header (convenient for local POS terminal switching)
  const headerUserId = req.headers['x-cashier-id'] || req.headers['x-user-id'];
  if (headerUserId) {
    const user = db.prepare('SELECT id, username, full_name as fullName, role FROM users WHERE id = ? AND is_active = 1').get(Number(headerUserId)) as AuthUser | undefined;
    if (user) {
      req.user = user;
      return next();
    }
  }

  // 3. Fallback to default owner user if not explicitly provided (for single PC seamless shop setup)
  const defaultUser = db.prepare("SELECT id, username, full_name as fullName, role FROM users WHERE role = 'OWNER' AND is_active = 1 LIMIT 1").get() as AuthUser | undefined;
  if (defaultUser) {
    req.user = defaultUser;
  }

  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ในการเข้าถึงส่วนนี้' });
    }
    next();
  };
}

