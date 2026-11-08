import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "The tech skills Canadian companies are hiring for right now, from real job posts. See the jobs you're closest to, and the one skill that gets you closer.";

// Link previews (iMessage, Discord, LinkedIn…): this title and description, plus app/opengraph-image.jpg, a snapshot of
// the landing page's hero.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.skilltrii.work"),
  title: "Skilltrii",
  description,
  openGraph: { title: "Skilltrii", description, url: "/", siteName: "Skilltrii", type: "website", locale: "en_CA" },
  twitter: { card: "summary_large_image", title: "Skilltrii", description },
};

// `drawer` is the @drawer slot: the Learning guide slides up there when opened from inside the app.
export default function RootLayout({ children, drawer }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* #app-shell is everything except the drawer: the drawer pushes it back (scales it down) while it's open. */}
        <div id="app-shell" className="flex flex-1 flex-col bg-background">
          <SiteHeader />
          <div className="relative mx-auto w-full max-w-[1600px] flex-1 px-4 pt-[72px] pb-6">{children}</div>
        </div>
        {drawer}
      </body>
    </html>
  );
}
