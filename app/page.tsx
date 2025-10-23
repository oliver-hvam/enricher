import Link from "next/link";

import { HomeEmptyState } from "@/app/_components/home-empty-state";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <HomeEmptyState />
      <div>
        <Button asChild variant="ghost">
          <Link href="/lists">Go to lists</Link>
        </Button>
      </div>
    </div>
  );
}
