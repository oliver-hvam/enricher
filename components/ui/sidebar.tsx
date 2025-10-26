"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListTree } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "./scroll-area";

const navigation = [
  {
    label: "Lists",
    href: "/lists",
    icon: ListTree,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-full w-64 flex-col border-r bg-muted/50">
      <div className="flex items-center gap-2 px-4 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <span className="text-lg font-bold">EN</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            Enricher
          </span>
          <span className="text-xs text-muted-foreground">Data workspace</span>
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Button
                key={item.href}
                asChild
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "justify-start gap-2",
                  isActive ? "bg-primary/90 text-primary-foreground" : ""
                )}
              >
                <Link href={item.href}>
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </Button>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
