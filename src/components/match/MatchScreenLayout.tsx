import type { ReactNode } from "react";

interface MatchScreenLayoutProps {
  children: ReactNode;
  contentClassName?: string;
  footer?: ReactNode;
  header?: ReactNode;
  headerClassName?: string;
  headerContentClassName?: string;
}

function joinClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** The shared broadcast frame for match stages, on the dedicated dark game presentation. */
export default function MatchScreenLayout({
  children,
  contentClassName,
  footer,
  header,
  headerClassName,
  headerContentClassName,
}: MatchScreenLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-page text-fg">
      {header && (
        <header className={joinClasses("border-b border-line bg-panel", headerClassName)}>
          <div className={joinClasses("relative mx-auto w-full px-6", headerContentClassName)}>
            <div>{header}</div>
          </div>
        </header>
      )}

      <div className={joinClasses("flex-1", contentClassName)}>{children}</div>

      {footer}
    </div>
  );
}
