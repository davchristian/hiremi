import { AppIcon } from "@/components/shell/AppShell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[360px] flex-col items-center gap-6">
        <AppIcon size={56} />
        {children}
      </div>
    </div>
  );
}
