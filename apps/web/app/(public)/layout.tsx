import { ThemeProvider } from 'next-themes';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <div className="min-h-dvh bg-background text-foreground">
        {children}
      </div>
    </ThemeProvider>
  );
}
