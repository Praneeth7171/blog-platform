import { randomBytes, timingSafeEqual } from "node:crypto";

export function csrfProtection({ production = false } = {}) {
  const cookieName = production ? "__Host-margin-csrf" : "margin-csrf";
  return (req, res, next) => {
    let token = req.signedCookies[cookieName];
    if (typeof token !== "string" || !/^[a-f\d]{64}$/.test(token)) {
      token = randomBytes(32).toString("hex");
      res.cookie(cookieName, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: production,
        signed: true,
        path: "/",
        maxAge: 86400000,
      });
    }
    res.locals.csrfToken = token;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const submitted = req.body?._csrf;
      if (
        typeof submitted !== "string" ||
        !/^[a-f\d]{64}$/.test(submitted) ||
        !timingSafeEqual(Buffer.from(submitted), Buffer.from(token))
      ) {
        return res
          .status(403)
          .render("error", {
            title: "Please refresh the page",
            status: 403,
            message:
              "Your form has expired or could not be verified. Go back, reload the page, and try again.",
          });
      }
    }
    next();
  };
}
