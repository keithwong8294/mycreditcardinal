import Sidebar from "@/components/Sidebar";
import { TrialBanner } from "@/components/TrialBanner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      {/* Offset for fixed sidebar on desktop, fixed mobile header */}
      <main className="md:ml-[220px] min-h-screen bg-surface pt-14 md:pt-0">
        <TrialBanner />
        {children}
      </main>
    </div>
  );
}
