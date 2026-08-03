import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "musicma_admin";

function secret() {
  return new TextEncoder().encode(
    process.env.ADMIN_JWT_SECRET || "dev-jwt-secret-change-me",
  );
}

export async function createAdminToken() {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyAdminToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function isAdminRequest() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

export { COOKIE as ADMIN_COOKIE };
