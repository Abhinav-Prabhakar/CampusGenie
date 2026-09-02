import { SignUp } from "@clerk/nextjs";
import AuthScreen from "@/components/auth/AuthScreen";
import { clerkAppearance } from "@/lib/clerkTheme";

export default function SignUpPage() {
  return (
    <AuthScreen>
      <SignUp appearance={clerkAppearance} />
    </AuthScreen>
  );
}
