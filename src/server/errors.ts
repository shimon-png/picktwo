export type ErrorCode =
  | "VOTING_CLOSED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "VALIDATION"
  | "INSUFFICIENT_POINTS"
  | "CONFLICT"
  | "SIGNUP_REQUIRED"
  | "LOOPS_OPEN"
  | "UNAVAILABLE"
  | "LIMIT_REACHED";

const STATUS: Record<ErrorCode, number> = {
  VOTING_CLOSED: 409,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  VALIDATION: 400,
  INSUFFICIENT_POINTS: 402,
  CONFLICT: 409,
  SIGNUP_REQUIRED: 401,
  LOOPS_OPEN: 409,
  UNAVAILABLE: 503,
  LIMIT_REACHED: 429,
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status });
  }
  if (e && typeof e === "object" && "issues" in e) {
    const issues = (e as { issues: { message: string }[] }).issues;
    return Response.json({ error: { code: "VALIDATION", message: issues[0]?.message ?? "Invalid input" } }, { status: 400 });
  }
  console.error(e);
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
}
