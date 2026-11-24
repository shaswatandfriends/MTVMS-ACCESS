import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Medefis Parent Control System",
  description:
    "Secure gateway for the Medefis VMS. Administrators hold the credentials; employees get controlled, proxied access to the logged-in Medefis workspace.",
  keywords: [
    "Medefis",
    "VMS",
    "parent control",
    "vendor management",
    "secure gateway",
    "AMN Healthcare",
    "access control",
  ],
  authors: [{ name: "Parent Control System" }],
  icons: {
    icon: "/vms-shield.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
