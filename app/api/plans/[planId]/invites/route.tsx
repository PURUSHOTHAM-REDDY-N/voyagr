import { NextRequest, NextResponse } from "next/server";
import { render } from "@react-email/render";
import { db } from "@/lib/db";
import { requireUserId, handleApiError, ApiError } from "@/lib/api-utils";
import { getPlanAdmin } from "@/lib/server/plan";
import { generateToken } from "@/lib/server/token";
import { sendEmailInviteLimit } from "@/lib/server/rate-limit";
import { sendMail } from "@/lib/server/mailer";
import InviteEmail from "@/emails/InviteEmail";

export async function GET(
  _req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;

    const admin = await getPlanAdmin(planId, userId);
    if (!admin.isPlanAdmin) return NextResponse.json([]);

    const invites = await db.invite.findMany({
      where: { planId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const result = await Promise.all(
      invites.map(async (invite) => {
        const currentUser = await db.user.findUnique({ where: { email: invite.email } });
        return {
          ...invite,
          firstName: currentUser?.firstName,
          lastName: currentUser?.lastName,
        };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  try {
    const userId = await requireUserId();
    const { planId } = params;
    const { email } = await req.json();

    await sendEmailInviteLimit(userId);

    const result = await getPlanAdmin(planId, userId);
    if (!result.isPlanAdmin) {
      console.log(`${userId} is not plan admin of ${planId} to invite others`);
      throw new ApiError("You must be a plan admin to invite others", 403);
    }

    const existingInvite = await db.invite.findFirst({ where: { planId, email } });
    if (existingInvite) {
      throw new ApiError("Invite already sent to this user");
    }

    const token = generateToken();
    const invite = await db.invite.create({ data: { planId, email, token } });

    console.log(`createToken and save invite called by ${userId} on planId : ${planId}`);

    const BASE_URL = process.env.HOSTING_URL ?? "https://travelplannerai.site";

    try {
      const html = await render(
        <InviteEmail
          projectName={result.planName!}
          inviteLink={`${BASE_URL}/dashboard/join?token=${token}`}
        />
      );

      await sendMail({
        to: email,
        subject: `You've been invited to join a travel plan`,
        html,
      });
    } catch (error) {
      await db.invite.delete({ where: { id: invite.id } });
      console.log(error);
      throw new ApiError(error instanceof Error ? error.message : "Failed to send invite email");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
