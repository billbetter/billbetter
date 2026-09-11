import React from "react";
import { AlertCircle, CheckCircle2, ClipboardList, Clock, FileText, PlusCircle, TrendingUp, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createPageUrl } from "@/utils";
import QuoteTableRow from "@/components/quote/list/QuoteTableRow";

/** The desktop quote table: one row per quote. */
export default function QuoteTable({
  filteredQuotes,
  handleStatusChange,
  navigate,
  searchTerm,
  setDeleteDialog,
  statusFilter,
  updatingStatus,
}) {
  return (
    <div className="hidden lg:block bg-surface dark:bg-ink-800 rounded-xl border border-line dark:border-ink-700 overflow-hidden shadow-sm overflow-x-auto">
      {filteredQuotes.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-ink-100 dark:bg-ink-700 flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-content-subtle dark:text-content-muted" />
          </div>
          <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
            {searchTerm || statusFilter !== "all"
              ? "No quotes found"
              : "No quotes yet"}
          </h3>
          <p className="text-sm text-content-muted dark:text-content-subtle mb-6">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your search"
              : "Create your first quote to get started"}
          </p>
          {!searchTerm && statusFilter === "all" && (
            <Link to={createPageUrl("CreateQuote")}>
              <Button className="h-11 px-6 bg-brand hover:bg-brand-hover text-content-inverted rounded-xl font-semibold">
                <PlusCircle className="w-5 h-5 mr-2" />
                Create Quote
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-sunken/50 dark:bg-ink-800/50 border-b border-line dark:border-ink-700">
              <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[130px]">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  Quote
                </div>
              </TableHead>
              <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5" />
                  Client
                </div>
              </TableHead>
              <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[110px]">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Issued
                </div>
              </TableHead>
              <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[100px]">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Validity
                </div>
              </TableHead>
              <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-right w-[120px]">
                <div className="flex items-center justify-end gap-2">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Amount
                </div>
              </TableHead>
              <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider w-[130px]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Status
                </div>
              </TableHead>
              <TableHead className="h-12 px-4 text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider text-center w-[110px]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredQuotes.map((quote) => (
              <QuoteTableRow
                key={quote.id}
                handleStatusChange={handleStatusChange}
                navigate={navigate}
                quote={quote}
                setDeleteDialog={setDeleteDialog}
                updatingStatus={updatingStatus}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
