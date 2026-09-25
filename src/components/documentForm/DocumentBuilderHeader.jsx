import React from "react";
import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/layout/PageHeader";

/** The builder's title block, and the trade it prices for. `Icon` is still
 * accepted from the builders; the template's headers carry no icon tile. */
// eslint-disable-next-line no-unused-vars
export default function DocumentBuilderHeader({ Icon, subtitle, title, userSpecialty }) {
  return (
    <PageHeader
      className="mb-4 sm:mb-6 lg:mb-8"
      title={title}
      description={subtitle}
      actions={
        <Badge variant="outline" className="h-8 gap-2 px-3 text-sm font-medium">
          <Wrench className="!size-4 text-muted-foreground" />
          <span className="max-w-[100px] truncate capitalize sm:max-w-[150px]">
            {userSpecialty.replace("_", " ")}
          </span>
        </Badge>
      }
    />
  );
}
