declare global {
  namespace Express {
    interface Request {
      user?: import("../../shared/schema").User;
    }
  }
}
