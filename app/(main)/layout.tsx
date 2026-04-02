import PersonChipBar from "@/components/PersonChipBar";
import TabBar from "@/components/TabBar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-subtle px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-[20px] font-semibold text-white">
            My<span>Credit</span>
            <span className="text-green">Cardinal</span>
          </span>
          <PersonChipBar />
        </div>
      </header>
      <TabBar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
