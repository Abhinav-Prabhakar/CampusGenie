import { SignIn } from "@clerk/nextjs";
import AuthScreen from "@/components/auth/AuthScreen";
import { clerkAppearance } from "@/lib/clerkTheme";

export default function SignInPage() {
  return (
    <AuthScreen>
      <SignIn appearance={clerkAppearance} />
    </AuthScreen>
  );
}
