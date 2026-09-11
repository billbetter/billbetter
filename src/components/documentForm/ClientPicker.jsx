import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Choose the client. `hint` is the small note after the label. */
export default function ClientPicker({
  clients,
  formData,
  handleClientSelect,
  hint,
  selectedClient,
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor="client"
        className="text-ink-700 dark:text-ink-300 font-medium text-sm flex items-center gap-2"
      >
        Client *
        <span className="text-xs font-normal text-content-muted">
          {hint}
        </span>
      </Label>
      <Select
        onValueChange={handleClientSelect}
        value={formData.client_id}
      >
        <SelectTrigger className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20">
          <SelectValue placeholder="Select a client">
            {selectedClient ? (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-brand-700 flex items-center justify-center text-content-inverted font-semibold text-xs">
                  {selectedClient.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">
                  {selectedClient.name}
                </span>
              </div>
            ) : (
              "Select a client"
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-80 bg-surface dark:bg-surface-inverted border-line dark:border-ink-700">
          {clients.map((client) => (
            <SelectItem
              key={client.id}
              value={client.id}
              className="py-2.5 sm:py-3 dark:text-ink-200 dark:focus:bg-ink-800"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-content-body dark:text-content-subtle font-semibold text-xs sm:text-sm">
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-content dark:text-ink-100 text-sm truncate">
                    {client.name}
                  </div>
                  {client.email && (
                    <div className="text-xs text-content-muted truncate">
                      {client.email}
                    </div>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
