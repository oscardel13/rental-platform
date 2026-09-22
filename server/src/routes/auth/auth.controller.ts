import type { NextFunction, Request, Response } from "express";

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

    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie("ironpeak.sid");
        res.status(200).send("logged out");
      });

      return;
    }

    res.clearCookie("ironpeak.sid");
    res.status(200).send("logged out");
  });
}
