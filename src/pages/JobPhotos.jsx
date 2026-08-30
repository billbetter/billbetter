import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Image as ImageIcon,
  Building2,
  User,
  Calendar,
  MapPin,
  ChevronRight,
  Filter,
  Briefcase,
  ArrowUpRight,
  X,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  Layers,
} from "lucide-react";
import { format } from "date-fns";
import CreateJobModal from "../components/jobPhotos/CreateJobModal";
import JobDetailView from "../components/jobPhotos/JobDetailView";
import PullToRefresh from "@/components/utils/PullToRefresh";

export default function Jobs() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [photoCounts, setPhotoCounts] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedClientFilter, setSelectedClientFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [user, setUser] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const currentUser = await sdk.auth.me();
      setUser(currentUser);

      const [jobsData, clientsData, allPhotos] = await Promise.all([
        sdk.entities.Job.filter({ user_id: currentUser.id }),
        sdk.entities.Client.filter({ user_id: currentUser.id }),
        sdk.entities.JobPhoto.filter({ user_id: currentUser.id }),
      ]);

      setJobs(
        jobsData.sort(
          (a, b) => new Date(b.created_date) - new Date(a.created_date),
        ),
      );
      setClients(clientsData);

      const counts = {};
      allPhotos.forEach((photo) => {
        counts[photo.job_id] = (counts[photo.job_id] || 0) + 1;
      });
      setPhotoCounts(counts);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      planning:
        "bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300 border-line dark:border-ink-700",
      in_progress:
        "bg-info-50 dark:bg-info-900/30 text-brand-800 dark:text-brand-300 border-info-200 dark:border-info-800",
      completed:
        "bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300 border-success-200 dark:border-success-800",
      cancelled:
        "bg-danger-50 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 border-danger-200 dark:border-danger-800",
    };
    return colors[status] || colors.planning;
  };

  const getStatusLabel = (status) => {
    const labels = {
      planning: "Planning",
      in_progress: "In Progress",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return labels[status] || status;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "in_progress":
        return <Zap className="w-3.5 h-3.5" />;
      case "planning":
        return <Clock className="w-3.5 h-3.5" />;
      default:
        return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSelectedClientFilter("all");
  };

  const activeFiltersCount = [
    searchQuery,
    statusFilter !== "all",
    selectedClientFilter !== "all",
  ].filter(Boolean).length;

  const stats = {
    total: jobs.length,
    inProgress: jobs.filter((j) => j.status === "in_progress").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    photos: Object.values(photoCounts).reduce((a, b) => a + b, 0),
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = searchQuery
      ? job.job_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.description?.toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesClient =
      selectedClientFilter === "all" || job.client_id === selectedClientFilter;

    return matchesSearch && matchesStatus && matchesClient;
  });

  if (selectedJob) {
    return (
      <JobDetailView
        job={selectedJob}
        onBack={() => {
          setSelectedJob(null);
          loadData();
        }}
        onUpdate={loadData}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-surface dark:bg-ink-800 shadow-xl flex items-center justify-center border border-line-subtle dark:border-ink-700">
              <Briefcase className="w-8 h-8 text-success-600 dark:text-success-400 animate-pulse" />
            </div>
            <div className="absolute -inset-2 bg-success-500/10 dark:bg-success-500/20 rounded-2xl blur-xl animate-pulse" />
          </div>
          <p className="text-sm font-medium text-content-body dark:text-ink-300">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep relative">
        {/* Premium Background - Soft ambient gradients only */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] bg-success-100/20 dark:bg-success-900/10 rounded-full blur-[100px]" />
          <div className="absolute top-[10%] -left-[5%] w-[500px] h-[500px] bg-info-100/20 dark:bg-info-900/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-[0%] right-[20%] w-[400px] h-[400px] bg-brand-100/20 dark:bg-brand-900/10 rounded-full blur-[100px]" />
        </div>

        {/* Header */}
        <div
          className={`sticky top-0 z-30 transition-all duration-500 ${
            scrolled
              ? "bg-surface/80 dark:bg-surface-inverted/80 backdrop-blur-xl shadow-sm border-b border-line/50 dark:border-ink-800/50"
              : "bg-transparent"
          }`}
        >
          {/*
            pt-* here because this header is the only page container in the app
            with horizontal padding and no vertical padding: Clients uses
            `px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8`, and the others wrap
            their content the same way. This one leaned entirely on the fixed
            h-16/h-20 below, which centres the row but leaves nothing above it,
            so the title and the Filter/New buttons sat hard against the top
            edge of the viewport while the stats below had room.
          */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">
            <div className="flex items-center justify-between h-16 sm:h-20">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="relative group">
                  <div className="absolute inset-0 bg-success-500/20 dark:bg-success-500/30 rounded-xl blur-lg group-hover:bg-success-500/30 dark:group-hover:bg-success-500/40 transition-all duration-500" />
                  <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-success-500 flex items-center justify-center shadow-lg shadow-success-200/50 dark:shadow-success-900/50 ring-1 ring-content-inverted/20 dark:ring-content-inverted/10">
                    <Briefcase
                      className="w-5 h-5 sm:w-6 sm:h-6 text-content-inverted"
                      strokeWidth={2}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <h1 className="text-xl sm:text-2xl font-black text-content dark:text-content-inverted tracking-tight">
                      Jobs
                    </h1>
                  </div>
                  <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle font-medium">
                    Manage projects
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex items-center gap-2 text-content-body dark:text-ink-300 hover:text-content dark:hover:text-content-inverted hover:bg-ink-100/80 dark:hover:bg-ink-800 font-medium h-10"
                >
                  <Filter className="w-4 h-4" />
                  Filter
                </Button>

                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-surface dark:bg-ink-800 hover:bg-surface-sunken dark:hover:bg-ink-700 text-content dark:text-content-inverted border border-line shadow-sm hover:shadow-md hover:border-line-strong font-semibold h-10 sm:h-11 px-3 sm:px-5 rounded-xl transition-all duration-300 group text-sm sm:text-base dark:border-ink-700 dark:hover:border-ink-600"
                >
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-success-600 flex items-center justify-center mr-2 group-hover:scale-110 transition-transform duration-300">
                    <Plus
                      className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-content-inverted"
                      strokeWidth={3}
                    />
                  </div>
                  <span className="hidden sm:inline">New Job</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 relative z-10">
          {/* Stats Row - Clean and minimal */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-surface dark:bg-ink-800 rounded-2xl p-4 sm:p-5 border border-line/60 dark:border-ink-700/60 shadow-sm hover:shadow-md hover:border-line-strong/60 dark:hover:border-ink-600/60 transition-all duration-300 group">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-success-50 dark:bg-success-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-success-600 dark:text-success-400" />
                </div>
                <span className="text-xs font-medium text-success-700 dark:text-success-400 bg-success-50 dark:bg-success-900/30 px-2 py-0.5 rounded-full">
                  All time
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-content dark:text-content-inverted">
                {stats.total}
              </p>
              <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle font-medium mt-1">
                Total Jobs
              </p>
            </div>

            <div className="bg-surface dark:bg-ink-800 rounded-2xl p-4 sm:p-5 border border-line/60 dark:border-ink-700/60 shadow-sm hover:shadow-md hover:border-line-strong/60 dark:hover:border-ink-600/60 transition-all duration-300 group">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-info-50 dark:bg-info-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-brand-700 dark:text-brand-400" />
                </div>
                <span className="text-xs font-medium text-brand-700 dark:text-brand-400 bg-info-50 dark:bg-info-900/30 px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-content dark:text-content-inverted">
                {stats.inProgress}
              </p>
              <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle font-medium mt-1">
                In Progress
              </p>
            </div>

            <div className="bg-surface dark:bg-ink-800 rounded-2xl p-4 sm:p-5 border border-line/60 dark:border-ink-700/60 shadow-sm hover:shadow-md hover:border-line-strong/60 dark:hover:border-ink-600/60 transition-all duration-300 group">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <span className="text-xs font-medium text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded-full">
                  Done
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-content dark:text-content-inverted">
                {stats.completed}
              </p>
              <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle font-medium mt-1">
                Completed
              </p>
            </div>

            <div className="bg-surface dark:bg-ink-800 rounded-2xl p-4 sm:p-5 border border-line/60 dark:border-ink-700/60 shadow-sm hover:shadow-md hover:border-line-strong/60 dark:hover:border-ink-600/60 transition-all duration-300 group">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-warning-50 dark:bg-warning-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-warning-600 dark:text-warning-400" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-content dark:text-content-inverted">
                {stats.photos}
              </p>
              <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle font-medium mt-1">
                Photos
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line/60 dark:border-ink-700/60 shadow-sm p-3 sm:p-4">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div className="flex-1 max-w-2xl">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 sm:h-5 sm:w-5 text-content-subtle dark:text-content-muted group-focus-within:text-success-500 dark:group-focus-within:text-success-400 transition-colors" />
                  </div>
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search jobs, clients..."
                    className="pl-10 sm:pl-12 pr-10 h-11 sm:h-12 bg-surface-sunken dark:bg-surface-inverted border-line dark:border-ink-700 rounded-xl focus:bg-surface dark:focus:bg-ink-800 focus:border-success-500 dark:focus:border-success-400 focus:ring-2 focus:ring-success-500/10 dark:focus:ring-success-400/10 transition-all text-sm sm:text-base"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-content-subtle dark:text-content-muted hover:text-content-body dark:hover:text-ink-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="lg:hidden">
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="w-full h-11 rounded-xl border-line dark:border-ink-700 hover:bg-surface-sunken dark:hover:bg-ink-700 font-medium"
                >
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <span className="ml-2 bg-success-700 text-content-inverted text-xs rounded-full px-2 py-0.5 font-semibold">
                      {activeFiltersCount}
                    </span>
                  )}
                </Button>
              </div>

              <div
                className={`flex-col sm:flex-row gap-2 sm:gap-3 ${showFilters ? "flex" : "hidden lg:flex"}`}
              >
                <Select
                  value={selectedClientFilter}
                  onValueChange={setSelectedClientFilter}
                >
                  <SelectTrigger className="w-full sm:w-44 h-11 sm:h-12 bg-surface-sunken dark:bg-surface-inverted border-line dark:border-ink-700 rounded-xl hover:border-line-strong dark:hover:border-ink-600 transition-all text-sm">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-content-muted dark:text-content-subtle" />
                      <SelectValue placeholder="All clients" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-h-64 rounded-xl">
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-44 h-11 sm:h-12 bg-surface-sunken dark:bg-surface-inverted border-line dark:border-ink-700 rounded-xl hover:border-line-strong dark:hover:border-ink-600 transition-all text-sm">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-content-muted dark:text-content-subtle" />
                      <SelectValue placeholder="All statuses" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    className="h-11 sm:h-12 px-4 text-content-body dark:text-content-subtle hover:text-content dark:hover:text-content-inverted hover:bg-ink-100 dark:hover:bg-ink-800 rounded-xl font-medium"
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          {filteredJobs.length === 0 ? (
            <div className="bg-surface/50 dark:bg-ink-800/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-line dark:border-ink-700 py-16 sm:py-24 px-4">
              <div className="max-w-sm mx-auto text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-6 border border-line dark:border-ink-700 dark:bg-ink-800">
                  <Briefcase className="w-10 h-10 sm:w-12 sm:h-12 text-ink-300 dark:text-content-body dark:dark:text-ink-300" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-content dark:text-content-inverted mb-2">
                  {searchQuery ||
                  statusFilter !== "all" ||
                  selectedClientFilter !== "all"
                    ? "No matches found"
                    : "Start your first project"}
                </h3>
                <p className="text-sm sm:text-base text-content-muted dark:text-content-subtle mb-8">
                  {searchQuery ||
                  statusFilter !== "all" ||
                  selectedClientFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Create a job to begin tracking your work"}
                </p>

                {!searchQuery &&
                statusFilter === "all" &&
                selectedClientFilter === "all" ? (
                  <Button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-brand hover:bg-brand-hover text-content-inverted font-semibold h-12 px-8 rounded-xl shadow-lg shadow-success-200 dark:shadow-success-900/50 hover:shadow-xl transition-all hover:-translate-y-0.5"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Create Job
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="border-line-strong dark:border-ink-700 text-ink-700 dark:text-ink-300 hover:bg-surface-sunken dark:hover:bg-ink-800 h-12 px-8 rounded-xl font-medium"
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {filteredJobs.map((job, index) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="group bg-surface dark:bg-ink-800 rounded-2xl border border-line/60 dark:border-ink-700/60 hover:border-success-300/60 dark:hover:border-success-600/60 hover:shadow-lg hover:shadow-success-100/20 dark:hover:shadow-success-900/20 transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <Badge
                        className={`${getStatusColor(job.status)} border text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5`}
                      >
                        {getStatusIcon(job.status)}
                        {getStatusLabel(job.status)}
                      </Badge>

                      <div className="w-8 h-8 rounded-full bg-surface-sunken dark:bg-surface-inverted flex items-center justify-center group-hover:bg-success-50 dark:group-hover:bg-success-900/30 transition-colors">
                        <ArrowUpRight className="w-4 h-4 text-content-subtle dark:text-content-muted group-hover:text-success-600 dark:group-hover:text-success-400 transition-colors" />
                      </div>
                    </div>

                    <h3 className="text-lg font-black text-content dark:text-content-inverted mb-3 line-clamp-2 group-hover:text-success-700 dark:group-hover:text-success-400 transition-colors">
                      {job.job_title}
                    </h3>

                    <div className="space-y-2.5 mb-5">
                      <div className="flex items-center gap-3 text-sm text-content-body dark:text-ink-300">
                        <div className="w-8 h-8 rounded-lg bg-surface-sunken dark:bg-surface-inverted flex items-center justify-center">
                          <User className="w-4 h-4 text-content-subtle dark:text-content-muted" />
                        </div>
                        <span className="font-medium truncate">
                          {job.client_name}
                        </span>
                      </div>

                      {job.location && (
                        <div className="flex items-center gap-3 text-sm text-content-body dark:text-ink-300">
                          <div className="w-8 h-8 rounded-lg bg-surface-sunken dark:bg-surface-inverted flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-content-subtle dark:text-content-muted" />
                          </div>
                          <span className="truncate">{job.location}</span>
                        </div>
                      )}

                      {job.scheduled_start_time && (
                        <div className="flex items-center gap-3 text-sm text-content-body dark:text-ink-300">
                          <div className="w-8 h-8 rounded-lg bg-surface-sunken dark:bg-surface-inverted flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-content-subtle dark:text-content-muted" />
                          </div>
                          <span className="font-medium">
                            {format(
                              new Date(job.scheduled_start_time),
                              "MMM d, yyyy",
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-line-subtle dark:border-ink-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-surface-sunken dark:bg-surface-inverted px-2.5 py-1.5 rounded-full">
                          <ImageIcon className="w-3.5 h-3.5 text-content-subtle dark:text-content-muted" />
                          <span className="text-sm font-semibold text-content-body dark:text-ink-300">
                            {photoCounts[job.id] || 0}
                          </span>
                          <span className="text-xs text-content-subtle dark:text-content-muted">
                            photos
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-ink-300 dark:text-content-body group-hover:text-success-500 dark:group-hover:text-success-400 group-hover:translate-x-1 transition-all dark:dark:text-ink-300" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <CreateJobModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onJobCreated={loadData}
          clients={clients}
        />
      </div>
    </PullToRefresh>
  );
}
