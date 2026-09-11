import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Mail } from "lucide-react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { TabsContent } from "@/components/ui/tabs";

/** The signed-in account and the change-password form (state from usePasswordChange). */
export default function SecurityTab({
  changingPassword,
  confirmNewPassword,
  handleChangePassword,
  newPassword,
  setConfirmNewPassword,
  setNewPassword,
  setShowPasswordForm,
  showPasswordForm,
  user,
}) {
  return (
    <TabsContent value="security">
      <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
            <Lock className="w-5 h-5 text-success-600 dark:text-success-400" />
            Security
          </CardTitle>
          <p className="text-sm text-content-body dark:text-content-subtle">
            How you sign in to Invoicium
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* The account, stated plainly. Only the email, because it
              is the only thing here we can actually prove -- the
              client has no reliable view of which provider signed
              this session in, and a wrong "Signed in with Google"
              would be worse than no line at all. */}
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-sunken p-4 dark:border-ink-700 dark:bg-ink-800/50">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface dark:bg-ink-800">
              <Mail className="h-4 w-4 text-content-body dark:text-content-subtle" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-content-muted dark:text-content-subtle">
                Signed in as
              </p>
              <p className="truncate font-semibold text-content dark:text-content-inverted">
                {user?.email || "—"}
              </p>
            </div>
          </div>

          {!showPasswordForm ? (
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 dark:border-ink-700 dark:bg-ink-800/50 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-content dark:text-content-inverted">
                  Password
                </p>
                <p className="text-sm text-content-body dark:text-content-subtle">
                  Nothing to do here unless you want to change it.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPasswordForm(true)}
                className="flex-shrink-0 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                Change password
              </Button>
            </div>
          ) : (
            <div className="max-w-sm space-y-4 rounded-xl border border-line bg-surface p-4 dark:border-ink-700 dark:bg-ink-800/50">
              <div>
                <Label
                  htmlFor="new-password"
                  className="text-ink-700 dark:text-ink-300"
                >
                  New Password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="mt-1.5"
                />
                <PasswordStrength
                  value={newPassword}
                  className="mt-3"
                />
              </div>
              <div>
                <Label
                  htmlFor="confirm-new-password"
                  className="text-ink-700 dark:text-ink-300"
                >
                  Confirm New Password
                </Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) =>
                    setConfirmNewPassword(e.target.value)
                  }
                  placeholder="••••••••••••"
                  className="mt-1.5"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword}
                  className="bg-brand hover:bg-brand-hover text-content-inverted"
                >
                  {changingPassword && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Update Password
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={changingPassword}
                  onClick={() => {
                    // Leave nothing typed behind. Reopening the form
                    // should be a fresh start, not a half-filled one.
                    setNewPassword("");
                    setConfirmNewPassword("");
                    setShowPasswordForm(false);
                  }}
                  className="text-content-body dark:text-content-subtle"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
