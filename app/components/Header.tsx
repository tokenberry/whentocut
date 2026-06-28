import Link from "next/link";
import { auth, signOut } from "@/auth";

/** Global header: brand on the left, auth controls on the right. */
export default async function Header() {
  const session = await auth();
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        When<span>ToCut</span>
      </Link>
      <nav className="site-nav">
        {session?.user ? (
          <>
            <Link href="/account">Account</Link>
            {session.user.plan === "PRO" && <span className="badge schedule_for_sale">PRO</span>}
            <span className="muted hide-sm">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button className="link-btn" type="submit">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link href="/signin">Sign in</Link>
        )}
      </nav>
    </header>
  );
}
