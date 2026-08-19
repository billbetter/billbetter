import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Video,
  ExternalLink,
  Phone,
  Mail,
  Briefcase,
  FileText,
  MoreHorizontal,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Link as LinkIcon,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  format,
  parseISO,
  isToday,
  isTomorrow,
  isPast,
  differenceInMinutes,
} from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function EventCard({
  event,
  onConvertToJob,
  onConvertToInvoice,
  onSendPaymentLink,
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const startTime = parseISO(event.start_time);
  const endTime = parseISO(event.end_time);
  const duration = differenceInMinutes(endTime, startTime);
  const isCompleted = isPast(startTime) && event.status === "active";
  const isCanceled = event.status === "canceled";

  const invitee = event.invitees?.[0];
  const linkedClient = event.linked_client;
  const clientName = linkedClient?.name || invitee?.name || "Unknown Client";
  const clientEmail = linkedClient?.email || invitee?.email;
  const clientPhone =
    linkedClient?.phone ||
    invitee?.questions_and_answers?.find((q) =>
      q.question.toLowerCase().includes("phone"),
    )?.answer;

  const relatedQuotes = event.related_quotes || [];
  const relatedInvoices = event.related_invoices || [];
  const relatedJobs = event.related_jobs || [];
  const pendingBalance = event.pending_balance || 0;
  const hasLinkedData =
    relatedQuotes.length > 0 ||
    relatedInvoices.length > 0 ||
    relatedJobs.length > 0;

  const getDateLabel = () => {
    if (isToday(startTime)) return "Today";
    if (isTomorrow(startTime)) return "Tomorrow";
    return format(startTime, "EEE, MMM d, yyyy");
  };

  const getStatusBadge = () => {
    if (isCanceled) {
      return (
        <Badge className="bg-danger-100 text-danger-700 hover:bg-danger-100 dark:bg-danger-900/30 dark:text-danger-400 dark:hover:bg-danger-900/30">
          Canceled
        </Badge>
      );
    }
    if (isCompleted) {
      return (
        <Badge className="bg-ink-200 text-ink-700 hover:bg-ink-200 dark:bg-ink-700 dark:text-ink-300 dark:hover:bg-ink-700">
          Completed
        </Badge>
      );
    }
    if (isToday(startTime)) {
      return (
        <Badge className="bg-info-100 text-info-700 hover:bg-info-100 dark:bg-info-900/30 dark:text-info-400 dark:hover:bg-info-900/30">
          Today
        </Badge>
      );
    }
    return (
      <Badge className="bg-success-100 text-success-700 hover:bg-success-100 dark:bg-success-900/30 dark:text-success-400 dark:hover:bg-success-900/30">
        Upcoming
      </Badge>
    );
  };

  const getQuoteStatusBadge = (status) => {
    const styles = {
      draft: "bg-ink-100 text-ink-700",
      sent: "bg-info-100 text-info-700",
      approved: "bg-success-100 text-success-700",
      declined: "bg-danger-100 text-danger-700",
      converted: "bg-brand-100 text-brand-700",
    };
    return styles[status] || styles.draft;
  };

  const getInvoiceStatusBadge = (status) => {
    const styles = {
      draft: "bg-ink-100 text-ink-700",
      sent: "bg-info-100 text-info-700",
      paid: "bg-success-100 text-success-700",
      overdue: "bg-danger-100 text-danger-700",
      cancelled: "bg-ink-100 text-ink-700",
    };
    return styles[status] || styles.draft;
  };

  const handleCall = () => {
    if (clientPhone) {
      window.open(`tel:${clientPhone}`, "_self");
    }
  };

  const handleEmail = () => {
    if (clientEmail) {
      window.open(`mailto:${clientEmail}`, "_blank");
    }
  };

  const handleViewClient = () => {
    if (linkedClient?.id) {
      navigate(createPageUrl("Clients"));
    }
  };

  const handleCopyPaymentLink = (paymentLink) => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
    }
  };

  return (
    <Card
      className={`border-none shadow-lg hover:shadow-xl transition-all ${isCanceled ? "opacity-60" : ""} ${isCompleted ? "bg-surface-sunken" : ""}`}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            {/* Event Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className="bg-brand-100 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-400 dark:hover:bg-brand-900/30">
                  {event.name}
                </Badge>
                {getStatusBadge()}
                <Badge
                  variant="outline"
                  className="text-content-body dark:text-ink-300"
                >
                  {duration} min
                </Badge>
                {linkedClient?.match_type === "auto_created" && (
                  <Badge className="bg-warning-100 text-warning-700 hover:bg-warning-100 gap-1 dark:bg-warning-900/30 dark:text-warning-400 dark:hover:bg-warning-900/30">
                    <UserPlus className="w-3 h-3" />
                    New Client
                  </Badge>
                )}
              </div>

              <h3 className="text-lg font-bold text-content mb-2 truncate flex items-center gap-2 dark:text-content-inverted">
                {clientName}
                {linkedClient && (
                  <span className="text-xs font-normal text-success-700 bg-success-50 px-2 py-0.5 rounded-full dark:text-success-400 dark:bg-success-900/20">
                    Linked
                  </span>
                )}
              </h3>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2 text-content-body dark:text-ink-300">
                  <Calendar className="w-4 h-4 text-success-600 flex-shrink-0" />
                  <span className="font-medium">{getDateLabel()}</span>
                </div>
                <div className="flex items-center gap-2 text-content-body dark:text-ink-300">
                  <Clock className="w-4 h-4 text-info-600 flex-shrink-0" />
                  <span>
                    {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                  </span>
                </div>
                {event.location?.type && (
                  <div className="flex items-center gap-2 text-content-body dark:text-ink-300">
                    {event.location.type === "physical" ? (
                      <>
                        <MapPin className="w-4 h-4 text-danger-600 flex-shrink-0" />
                        <span className="truncate">
                          {event.location.location || "In Person"}
                        </span>
                      </>
                    ) : (
                      <>
                        <Video className="w-4 h-4 text-brand-600 flex-shrink-0" />
                        <span>
                          {event.location.type === "zoom"
                            ? "Zoom Meeting"
                            : "Online Meeting"}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {clientEmail && (
                  <div className="flex items-center gap-2 text-content-body dark:text-ink-300">
                    <Mail className="w-4 h-4 text-content-muted flex-shrink-0" />
                    <span className="truncate">{clientEmail}</span>
                  </div>
                )}
                {clientPhone && (
                  <div className="flex items-center gap-2 text-content-body dark:text-ink-300">
                    <Phone className="w-4 h-4 text-content-muted flex-shrink-0" />
                    <span>{clientPhone}</span>
                  </div>
                )}
              </div>

              {/* Balance Alert */}
              {pendingBalance > 0 && (
                <div className="mt-3 p-2 bg-warning-50 border border-warning-200 rounded-lg flex items-center gap-2 dark:bg-warning-900/20 dark:border-warning-800/50">
                  <AlertCircle className="w-4 h-4 text-warning-600 flex-shrink-0" />
                  <span className="text-sm text-warning-800">
                    <strong>${pendingBalance.toFixed(2)}</strong> pending
                    balance
                  </span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap sm:flex-col gap-2">
              <a
                href={event.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none"
              >
                <Button variant="outline" size="sm" className="w-full gap-1">
                  <ExternalLink className="w-3 h-3" />
                  Calendly
                </Button>
              </a>

              {clientPhone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCall}
                  className="flex-1 sm:flex-none gap-1 text-positive-700 hover:text-positive-700 hover:bg-positive-50 dark:text-positive-400 dark:hover:text-positive-400 dark:hover:bg-positive-900/20"
                >
                  <Phone className="w-3 h-3" />
                  Call
                </Button>
              )}

              {clientEmail && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEmail}
                  className="flex-1 sm:flex-none gap-1 text-info-600 hover:text-info-700 hover:bg-info-50 dark:text-info-400 dark:hover:text-info-400 dark:hover:bg-info-900/20"
                >
                  <Mail className="w-3 h-3" />
                  Email
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={() =>
                      onConvertToJob(event, clientName, clientEmail)
                    }
                  >
                    <Briefcase className="w-4 h-4 mr-2" />
                    Convert to Job
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      onConvertToInvoice(event, clientName, clientEmail)
                    }
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Convert to Invoice
                  </DropdownMenuItem>
                  {linkedClient && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleViewClient}>
                        <User className="w-4 h-4 mr-2" />
                        View Client
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Linked Data Section */}
          {hasLinkedData && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-sm text-content-body hover:text-content transition-colors dark:text-ink-300 dark:hover:text-content-inverted"
              >
                {expanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                <span>
                  {relatedQuotes.length} Quote
                  {relatedQuotes.length !== 1 ? "s" : ""} •{" "}
                  {relatedInvoices.length} Invoice
                  {relatedInvoices.length !== 1 ? "s" : ""} •{" "}
                  {relatedJobs.length} Job{relatedJobs.length !== 1 ? "s" : ""}
                </span>
              </button>

              {expanded && (
                <div className="border-t pt-4 grid gap-4">
                  {/* Quotes Section */}
                  {relatedQuotes.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-ink-700 mb-2 flex items-center gap-2 dark:text-ink-300">
                        <ClipboardList className="w-4 h-4 text-brand-600" />
                        Quotes
                      </h4>
                      <div className="grid gap-2">
                        {relatedQuotes.map((quote) => (
                          <div
                            key={quote.id}
                            className="flex items-center justify-between p-2 bg-surface-sunken rounded-lg dark:bg-ink-800"
                          >
                            <div className="flex items-center gap-3">
                              <Badge
                                className={getQuoteStatusBadge(quote.status)}
                              >
                                {quote.status}
                              </Badge>
                              <span className="text-sm font-medium">
                                {quote.quote_number}
                              </span>
                              <span className="text-sm text-content-body dark:text-ink-300">
                                ${quote.total?.toFixed(2)}
                              </span>
                            </div>
                            <Link
                              to={`${createPageUrl("QuoteDetail")}?id=${quote.id}`}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </Button>
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invoices Section */}
                  {relatedInvoices.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-ink-700 mb-2 flex items-center gap-2 dark:text-ink-300">
                        <FileText className="w-4 h-4 text-info-600" />
                        Invoices
                      </h4>
                      <div className="grid gap-2">
                        {relatedInvoices.map((invoice) => (
                          <div
                            key={invoice.id}
                            className="flex items-center justify-between p-2 bg-surface-sunken rounded-lg dark:bg-ink-800"
                          >
                            <div className="flex items-center gap-3">
                              <Badge
                                className={getInvoiceStatusBadge(
                                  invoice.status,
                                )}
                              >
                                {invoice.status}
                              </Badge>
                              <span className="text-sm font-medium">
                                {invoice.invoice_number}
                              </span>
                              <span className="text-sm text-content-body dark:text-ink-300">
                                ${invoice.total?.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {invoice.payment_link &&
                                invoice.status !== "paid" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-success-600"
                                    onClick={() =>
                                      handleCopyPaymentLink(
                                        invoice.payment_link,
                                      )
                                    }
                                  >
                                    <LinkIcon className="w-3 h-3" />
                                    Copy Link
                                  </Button>
                                )}
                              <Link
                                to={`${createPageUrl("InvoiceDetail")}?id=${invoice.id}`}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  View
                                </Button>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Jobs Section */}
                  {relatedJobs.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-ink-700 mb-2 flex items-center gap-2 dark:text-ink-300">
                        <Briefcase className="w-4 h-4 text-warning-600" />
                        Jobs
                      </h4>
                      <div className="grid gap-2">
                        {relatedJobs.map((job) => (
                          <div
                            key={job.id}
                            className="flex items-center justify-between p-2 bg-surface-sunken rounded-lg dark:bg-ink-800"
                          >
                            <div className="flex items-center gap-3">
                              <Badge
                                className={
                                  job.status === "completed"
                                    ? "bg-success-100 text-success-700"
                                    : job.status === "in_progress"
                                      ? "bg-info-100 text-info-700"
                                      : "bg-ink-100 text-ink-700"
                                }
                              >
                                {job.status}
                              </Badge>
                              <span className="text-sm font-medium truncate max-w-[150px]">
                                {job.job_title}
                              </span>
                              {job.estimated_cost > 0 && (
                                <span className="text-sm text-content-body dark:text-ink-300">
                                  ${job.estimated_cost?.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <Link
                              to={`${createPageUrl("JobDetail")}?id=${job.id}`}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </Button>
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
