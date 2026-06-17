import { PlatformShell } from "@/components/platform/platform-shell";

export default function PlatformPanelLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
