import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// Admin-only routes (document upload and listing, re-indexing) need the key
// from ADMIN_API_KEY in .env, sent in the `x-admin-key` header.
// Chat and search stay public.
//
// Fails closed: if ADMIN_API_KEY is missing or too short, the admin routes
// are switched off rather than left open.

const MIN_KEY_LENGTH = 16;

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

export function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_API_KEY ?? '';
  if (expected.length < MIN_KEY_LENGTH) {
    res.status(503).json({
      error: `Admin routes are switched off: set ADMIN_API_KEY in .env (at least ${MIN_KEY_LENGTH} characters).`,
    });
    return;
  }

  const given = req.get('x-admin-key') ?? '';
  // Compare fixed-length digests so the check takes the same time
  // whatever the key's length or content.
  if (!timingSafeEqual(digest(given), digest(expected))) {
    res.status(401).json({ error: 'Missing or invalid admin key (x-admin-key header).' });
    return;
  }
  next();
}
