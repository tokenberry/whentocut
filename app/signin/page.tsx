import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export const dynamic = "force-dynamic";

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/account");
  const { sent } = await searchParams;
  const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID);

  return (
    <div className="container">
      <h1>Sign in to WhenToCut</h1>
      <p className="muted">Save games, get discount alerts, and connect your Steam data.</p>

      <div className="panel" style={{ maxWidth: 420 }}>
        {googleEnabled && (
          <>
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/account" });
              }}
            >
              <button type="submit" style={{ width: "100%" }}>
                Continue with Google
              </button>
            </form>
            <div className="divider">or</div>
          </>
        )}

        {sent ? (
          <p className="sale-yes">✓ Check your email for a sign-in link.</p>
        ) : (
          <form
            action={async (formData: FormData) => {
              "use server";
              const email = String(formData.get("email") ?? "").trim();
              await signIn("resend", { email, redirectTo: "/account" });
            }}
          >
            <input type="email" name="email" placeholder="you@studio.com" required />
            <button type="submit" style={{ width: "100%", marginTop: 10 }}>
              Email me a magic link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
