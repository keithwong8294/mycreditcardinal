export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="bg-surface border border-subtle rounded-lg p-8 w-full max-w-sm">
        <h1 className="text-[20px] font-semibold text-primary mb-1">
          My<span>Credit</span>
          <span className="text-green">Cardinal</span>
        </h1>
        <p className="text-secondary text-[13px] mb-6">
          Stop leaving rewards on the table.
        </p>
        <p className="text-tertiary text-[12px]">Auth coming soon.</p>
      </div>
    </div>
  );
}
