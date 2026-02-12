import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted border border-border mb-6">
        <svg
          className="h-7 w-7 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>
      <h2 className="text-xl font-bold tracking-tight mb-2">
        User not found
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
        The user you&apos;re looking for doesn&apos;t exist or has been deleted
        from Entra External ID.
      </p>
      <Link href="/users">
        <Button className="font-medium">
          <svg
            className="mr-1.5 h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Users
        </Button>
      </Link>
    </div>
  );
}
