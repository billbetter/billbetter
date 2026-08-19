import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { sdk } from "@/api/sdk";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Tag,
  Download,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { format } from "date-fns";

export default function SharedPhotos() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [shareData, setShareData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSharedAlbum();
  }, [token]);

  const loadSharedAlbum = async () => {
    try {
      setLoading(true);

      // Find share record
      const shares = await sdk.entities.JobPhotoShare.filter({
        share_token: token,
        is_active: true,
      });

      if (shares.length === 0) {
        setError("This link is invalid or has expired");
        return;
      }

      const share = shares[0];

      // Check expiration
      if (new Date(share.expires_at) < new Date()) {
        setError("This link has expired");
        return;
      }

      setShareData(share);

      // Update view count
      await sdk.entities.JobPhotoShare.update(share.id, {
        view_count: (share.view_count || 0) + 1,
      });

      // Load job details
      const jobs = await sdk.entities.Job.filter({ id: share.job_id });
      if (jobs.length > 0) {
        setJob(jobs[0]);
      }

      // Load photos
      const photosData = await sdk.entities.JobPhoto.filter({
        job_id: share.job_id,
      });
      setPhotos(
        photosData.sort(
          (a, b) => new Date(b.taken_date) - new Date(a.taken_date),
        ),
      );
    } catch (error) {
      console.error("Error loading shared album:", error);
      setError("Failed to load photos");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (photoUrl) => {
    if (shareData?.allow_download) {
      window.open(photoUrl, "_blank");
    }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-sunken">
        <Loader2 className="w-8 h-8 animate-spin text-success-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-sunken p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
            <h2 className="text-xl font-black text-content mb-2">
              Access Denied
            </h2>
            <p className="text-content-body">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h1 className="text-2xl font-black text-content mb-2">
              {job?.job_title || "Job Photos"}
            </h1>
            <p className="text-content-body">
              Shared photo album • {photos.length} photo
              {photos.length !== 1 && "s"}
            </p>
            {shareData?.expires_at && (
              <p className="text-sm text-content-muted mt-2">
                This link expires on{" "}
                {format(new Date(shareData.expires_at), "MMMM d, yyyy")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Photo Gallery */}
        {photos.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ImageIcon className="w-16 h-16 text-ink-300 mx-auto mb-4" />
              <h3 className="text-lg font-black text-content mb-2">
                No photos available
              </h3>
              <p className="text-content-body">
                Photos will appear here once they are uploaded
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {photos.map((photo) => (
              <Card
                key={photo.id}
                className="overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="aspect-square relative bg-ink-100">
                  <img
                    src={photo.thumbnail_url || photo.photo_url}
                    alt={photo.caption || "Job photo"}
                    className="w-full h-full object-cover"
                  />
                  <Badge
                    className={`absolute top-2 left-2 ${getCategoryColor(
                      photo.category,
                    )}`}
                  >
                    {photo.category}
                  </Badge>
                  {shareData?.allow_download && (
                    <Button
                      size="sm"
                      onClick={() => handleDownload(photo.photo_url)}
                      className="absolute top-2 right-2 bg-surface/90 hover:bg-surface text-content"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center gap-1 text-xs text-content-body mb-2">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(photo.taken_date), "MMM d, yyyy h:mm a")}
                  </div>
                  {photo.caption && (
                    <p className="text-sm text-content mb-2">{photo.caption}</p>
                  )}
                  {photo.tags && photo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {photo.tags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-content-muted">
          <p>Powered by Invoicium</p>
        </div>
      </div>
    </div>
  );
}
