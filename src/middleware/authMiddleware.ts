import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../auth.ts';
import { executeQuery } from '../database.ts';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'admin' | 'engineer' | 'client';
    displayNameAr: string;
    displayNameEn: string;
    isActive: boolean;
  };
}

/**
 * JWT Authentication Middleware
 */
export async function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization context' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Broken authorization signature' });
  }

  try {
    const decoded = verifyToken(token);

    // Query active database record for verification
    const users = await executeQuery('SELECT * FROM Users WHERE id = ?', [decoded.id]);
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'User identity lookup failed' });
    }

    const dbUser = users[0];
    const isActive = dbUser.is_active === 1 || dbUser.is_active === true;
    if (!isActive) {
      return res.status(403).json({ error: 'Your account is temporarily suspended' });
    }

    // Attach user metadata using camelCase to retain absolute frontend compatibility
    req.user = {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role as any,
      displayNameAr: dbUser.display_name_ar,
      displayNameEn: dbUser.display_name_en,
      isActive: isActive
    };

    next();
  } catch (err: any) {
    console.error('Authentication Error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}
