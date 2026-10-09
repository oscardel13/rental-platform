import type { NextFunction, Request, Response } from "express";

export const SESSION_COOKIE_NAME = "rental.sid";

export function HttpGetMe(req: Request, res: Response) {
  res.status(200).json({
    user: req.user,
  });
}

export function HttpAuthFailure(req: Request, res: Response) {
  res.status(401).send("Failed to log in");
}

export function HttpLogout(req: Request, res: Response, next: NextFunction) {
  req.logout((err) => {
    if (err) {
      return next(err);
    }

    // Must match the session cookie name in app.ts.
    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie(SESSION_COOKIE_NAME);
        res.status(200).send("logged out");
      });

      return;
    }

    res.clearCookie(SESSION_COOKIE_NAME);
    res.status(200).send("logged out");
  });
}
