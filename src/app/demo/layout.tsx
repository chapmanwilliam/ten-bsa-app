import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "TEN BSA Demo",
  manifest: "/manifest-demo.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TEN Demo",
  },
  icons: {
    apple: "/icons/icon-demo-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
