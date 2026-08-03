import { prisma } from "@/lib/db";

export const SETTING_KEYS = {
  apiId: "telegram.apiId",
  apiHash: "telegram.apiHash",
} as const;

export async function getSetting(key: string) {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getTelegramCredentials() {
  const [apiId, apiHash] = await Promise.all([
    getSetting(SETTING_KEYS.apiId),
    getSetting(SETTING_KEYS.apiHash),
  ]);
  return { apiId, apiHash };
}

export function maskSecret(value: string | null) {
  if (!value) return "";
  if (value.length <= 6) return "••••••";
  return `${value.slice(0, 3)}••••${value.slice(-2)}`;
}
