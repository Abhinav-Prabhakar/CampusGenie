// Clerk appearance tokens mapped to the Campus Genie design system (design.md).
// Dark-first OKLCH values mirror globals.css so <SignIn>/<SignUp>/<UserButton>
// render on the same cool blue-tinted neutral ramp as the app shell.
export const clerkAppearance = {
  variables: {
    colorPrimary: "oklch(0.68 0.173 253.301)",
    colorBackground: "oklch(0.26 0.006 271.191)",
    colorForeground: "oklch(0.964 0.002 247.839)",
    colorForegroundMuted: "oklch(0.541 0.01 264.484)",
    colorInputBackground: "oklch(0.293 0.006 271.223)",
    colorInputText: "oklch(0.964 0.002 247.839)",
    colorTextOnPrimaryBackground: "oklch(0.16 0.01 253)",
    colorDanger: "oklch(0.666 0.18 21.433)",
    colorSuccess: "oklch(0.705 0.154 153.814)",
    borderRadius: "8px",
    fontFamily: "var(--font-inter), Inter, sans-serif",
  },
  elements: {
    rootBox: "w-full flex justify-center items-center m-0 p-0",
    cardBox: "w-full flex justify-center items-center m-0 p-0 shadow-none border-none bg-transparent",
    card: "w-full bg-transparent shadow-none border-none p-0 m-0",
    headerTitle: "text-center text-ink font-semibold",
    headerSubtitle: "text-center text-ink-2",
    socialButtonsBlockButton: "!bg-inset !border-line !text-ink hover:!bg-hover",
    formFieldLabel: "text-ink-2",
    formButtonPrimary:
      "!bg-[oklch(0.68_0.173_253.301)] !text-[oklch(0.16_0.01_253)] hover:!brightness-110 font-medium",
    footerActionLink: "!text-accent hover:underline",
    identityPreview: "!bg-inset",
  },
} as const;
