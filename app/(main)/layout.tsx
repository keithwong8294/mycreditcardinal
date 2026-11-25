import Sidebar from "@/components/Sidebar";
import { TrialBanner } from "@/components/TrialBanner";
import { SandboxBar } from "@/components/SandboxBar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      {/* Offset for fixed sidebar on desktop, fixed mobile header */}
      <main className="md:ml-[248px] min-h-screen bg-surface pt-14 md:pt-0">
        <TrialBanner />
        <SandboxBar />
        {children}
      </main>
    </div>
  );
}
