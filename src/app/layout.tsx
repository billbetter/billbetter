import "./globals.css";
import LayoutWrapper from "@/components/LayoutWrapper";
import { CrewProvider } from "@/app/context/CrewContext";

export const metadata = {
  title: "AxisBill",
  description: "Invoicing and job management for contractors",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900" suppressHydrationWarning>
        <CrewProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
        </CrewProvider>
      </body>
    </html>
  );
}
