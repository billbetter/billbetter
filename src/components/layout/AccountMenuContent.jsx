import React from "react";
import { createPageUrl } from "@/utils";
import {
  Settings,
  LogOut,
  Building2,
  CreditCard,
} from "lucide-react";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

/**
 * The account menu's items. One menu with two triggers -- the account row at
 * the foot of the desktop sidebar and the avatar in the phone top bar -- so
 * the items live here once instead of being written out twice.
 */
/**
 * The account menu's items. One menu with two triggers -- the account row at
 * the foot of the desktop sidebar and the avatar in the phone top bar -- so
 * the items live here once instead of being written out twice.
 */
function AccountMenuContent({ navigate, onLogout }) {
  return (
    <DropdownMenuContent align="end" className="w-56">
      <DropdownMenuItem
        onClick={() => navigate(createPageUrl("Settings") + "?tab=business")}
      >
        <Building2 className="w-4 h-4 mr-2" />
        Business Information
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => navigate(createPageUrl("Settings"))}>
        <Settings className="w-4 h-4 mr-2" />
        Settings
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => navigate(createPageUrl("Settings") + "?tab=billing")}
      >
        <CreditCard className="w-4 h-4 mr-2" />
        Billing
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onLogout} className="text-danger-600">
        <LogOut className="w-4 h-4 mr-2" />
        Logout
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

export default AccountMenuContent;
