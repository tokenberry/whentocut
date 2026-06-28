"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FREE_TRACK_LIMIT } from "@/lib/plan";

export async function trackGame(appid: number, name: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;

  const existing = await prisma.trackedGame.findUnique({
    where: { userId_appid: { userId, appid } },
  });
  if (existing) return;

  if (session.user.plan !== "PRO") {
    const count = await prisma.trackedGame.count({ where: { userId } });
    if (count >= FREE_TRACK_LIMIT) redirect(`/dashboard/${appid}?limit=1`);
  }

  await prisma.trackedGame.create({ data: { userId, appid, name } });
  revalidatePath("/account");
  revalidatePath(`/dashboard/${appid}`);
}

export async function untrackGame(appid: number) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  await prisma.trackedGame.deleteMany({ where: { userId: session.user.id, appid } });
  revalidatePath("/account");
  revalidatePath(`/dashboard/${appid}`);
}
