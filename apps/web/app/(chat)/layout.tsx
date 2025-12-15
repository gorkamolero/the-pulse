import Script from 'next/script';

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
        {children}
      </div>
    </>
  );
}
