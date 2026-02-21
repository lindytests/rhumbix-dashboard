import { Sidebar } from "@/components/layout/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pt-14 lg:pt-0 lg:pl-60">
        <div className="px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 pb-12 max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
