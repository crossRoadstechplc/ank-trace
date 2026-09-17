import { NextResponse } from "next/server";
import { isAdminUnlocked, jsonError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    if (!(await isAdminUnlocked())) {
      return jsonError("Unauthorized", 401);
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        loginEvents: {
          orderBy: { loggedInAt: "desc" },
        },
      },
    });

    const leads = users.map((u) => ({
      id: u.id,
      name: u.name,
      companyName: u.companyName,
      contact: u.email ?? u.phone ?? "—",
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      loginCount: u.loginCount,
      logins: u.loginEvents.map((e) => ({
        id: e.id,
        loggedInAt: e.loggedInAt.toISOString(),
        ip: e.ip,
        userAgent: e.userAgent,
      })),
    }));

    return NextResponse.json({ leads });
  } catch (err) {
    console.error("admin leads", err);
    return jsonError("Could not load leads.", 500);
  }
}
