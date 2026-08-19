import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Upload,
  Search,
  MapPin,
  Calendar,
  User,
  Star,
  Tag,
  Loader2,
  Share2,
  Image as ImageIcon,
  FileText,
  Receipt,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import PhotoUploadModal from "./PhotoUploadModal";
import PhotoDetailModal from "./PhotoDetailModal";
import ShareAlbumModal from "./ShareAlbumModal";
import JobExpensesTab from "./JobExpensesTab";

export default function JobDetailView({ job, onBack, onUpdate }) {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [activeTab, setActiveTab] = useState("photos");
  const [user, setUser] = useState(null);
  const [expenseCount, setExpenseCount] = useState(0);

  useEffect(() => {
    loadPhotos();
    loadUser();
    loadExpenseCount();
  }, [job.id]);

  const loadUser = async () => {
    try {
      const u = await sdk.auth.me();
      setUser(u);
    } catch (e) {}
  };

  const loadExpenseCount = async () => {
    try {
      const data = await sdk.entities.JobExpense.filter({ job_id: job.id });
      setExpenseCount(data.length);
    } catch (e) {}
  };

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const photosData = await sdk.entities.JobPhoto.filter({ job_id: job.id });
      setPhotos(
        photosData.sort(
          (a, b) => new Date(b.taken_date) - new Date(a.taken_date),
        ),
      );
    } catch (error) {
      console.error("Error loading photos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoClick = (photo) => {
    setSelectedPhoto(photo);
    setShowDetailModal(true);
  };

  const handleCreateInvoice = () => {
    navigate(
      createPageUrl("CreateInvoice") +
        `?clientId=${job.client_id}&clientName=${encodeURIComponent(job.client_name)}&jobId=${job.id}&jobName=${encodeURIComponent(job.job_title)}`,
    );
  };

  const getCategoryColor = (category) => {
    const colors = {
      before: "bg-info-100 text-info-700",
      during: "bg-caution-100 text-caution-700",
      after: "bg-positive-100 text-positive-700",
      issue: "bg-danger-100 text-danger-700",
      receipt: "bg-brand-100 text-brand-700",
      other: "bg-ink-100 text-ink-700",
    };
    return colors[category] || colors.other;
  };

  const getStatusColor = (status) => {
    const colors = {
      planning: "bg-ink-100 text-ink-700",
      in_progress: "bg-info-100 text-info-700",
      completed: "bg-positive-100 text-positive-700",
      cancelled: "bg-danger-100 text-danger-700",
    };
    return colors[status] || colors.planning;
  };

  const categories = [
    { value: "all", label: "All" },
    { value: "before", label: "Before" },
    { value: "during", label: "During" },
    { value: "after", label: "After" },
    { value: "issue", label: "Issue" },
    { value: "receipt", label: "Receipt" },
    { value: "other", label: "Other" },
  ];

  const filteredPhotos = photos.filter((photo) => {
    const matchesSearch = searchQuery
      ? photo.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        photo.tags?.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : true;
    const matchesCategory =
      categoryFilter === "all" || photo.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4 text-ink-700 dark:text-ink-200 hover:text-content dark:hover:text-content-inverted"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Jobs
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-content dark:text-content-inverted mb-2">
              {job.job_title}
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className={getStatusColor(job.status)}>
                {job.status.replace("_", " ")}
              </Badge>
              <div className="flex items-center gap-1 text-sm text-content-body dark:text-ink-300">
                <User className="w-4 h-4" />
                {job.client_name}
              </div>
              {job.location && (
                <div className="flex items-center gap-1 text-sm text-content-body dark:text-ink-300">
                  <MapPin className="w-4 h-4" />
                  {job.location}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowShareModal(true)}
              variant="outline"
              disabled={photos.length === 0}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button onClick={handleCreateInvoice} variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
            <Button
              onClick={() => setShowUploadModal(true)}
              className="bg-brand hover:bg-brand-hover"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Photos
            </Button>
          </div>
        </div>

        {job.description && (
          <p className="text-content-body dark:text-ink-300 mt-4">
            {job.description}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-ink-100 dark:bg-ink-800 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setActiveTab("photos")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "photos"
              ? "bg-surface dark:bg-ink-700 text-content dark:text-content-inverted shadow-sm"
              : "text-content-body dark:text-content-subtle hover:text-content dark:hover:text-content-inverted"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          Photos
          {photos.length > 0 && (
            <span className="bg-ink-200 dark:bg-ink-600 text-ink-700 dark:text-ink-300 text-xs px-1.5 py-0.5 rounded-full">
              {photos.length}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab("expenses");
            loadExpenseCount();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "expenses"
              ? "bg-surface dark:bg-ink-700 text-content dark:text-content-inverted shadow-sm"
              : "text-content-body dark:text-content-subtle hover:text-content dark:hover:text-content-inverted"
          }`}
        >
          <Receipt className="w-4 h-4" />
          Expenses
          {expenseCount > 0 && (
            <span className="bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-400 text-xs px-1.5 py-0.5 rounded-full">
              {expenseCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "photos" && (
        <>
          {/* Photo Filters */}
          <Card className="mb-6">
            <CardContent className="mx-2 pt-0 p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-subtle" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search photos..."
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Badge
                      key={cat.value}
                      className={`cursor-pointer ${
                        categoryFilter === cat.value
                          ? "bg-success-600 text-content-inverted"
                          : "bg-ink-100 text-ink-700 dark:bg-ink-700 dark:text-ink-300 hover:bg-ink-200"
                      }`}
                      onClick={() => setCategoryFilter(cat.value)}
                    >
                      {cat.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Photos Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-success-600" />
            </div>
          ) : filteredPhotos.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <ImageIcon className="w-16 h-16 text-ink-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-content dark:text-content-inverted mb-2">
                  No photos yet
                </h3>
                <p className="text-content-body dark:text-content-subtle mb-4">
                  Upload photos to document this job
                </p>
                <Button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-brand hover:bg-brand-hover"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photos
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPhotos.map((photo) => (
                <Card
                  key={photo.id}
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handlePhotoClick(photo)}
                >
                  <div className="aspect-square relative bg-ink-100 dark:bg-ink-800">
                    <img
                      src={photo.thumbnail_url || photo.photo_url}
                      alt={photo.caption || "Job photo"}
                      className="w-full h-full object-cover"
                    />
                    {photo.is_favorite && (
                      <Star className="absolute top-2 right-2 w-5 h-5 text-caution-400 fill-caution-400" />
                    )}
                    <Badge
                      className={`absolute top-2 left-2 ${getCategoryColor(photo.category)}`}
                    >
                      {photo.category}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1 text-xs text-content-body dark:text-content-subtle mb-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(photo.taken_date), "MMM d, yyyy")}
                    </div>
                    {photo.caption && (
                      <p className="text-sm text-content dark:text-content-inverted line-clamp-2 mb-1">
                        {photo.caption}
                      </p>
                    )}
                    {photo.tags && photo.tags.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-content-body dark:text-content-subtle">
                        <Tag className="w-3 h-3" />
                        {photo.tags.length} tag{photo.tags.length !== 1 && "s"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "expenses" && user && (
        <JobExpensesTab job={job} user={user} />
      )}

      {/* Modals */}
      <PhotoUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        jobId={job.id}
        onUploadComplete={loadPhotos}
      />

      {selectedPhoto && (
        <PhotoDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          photo={selectedPhoto}
          onUpdate={loadPhotos}
          onDelete={loadPhotos}
        />
      )}

      <ShareAlbumModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        jobId={job.id}
      />
    </div>
  );
}
