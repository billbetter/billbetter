import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Upload, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function PhotoSelector({
  jobId,
  selectedPhotoIds = [],
  onSelectionChange,
}) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (jobId) {
      loadPhotos();
    }
  }, [jobId]);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const photosData = await sdk.entities.JobPhoto.filter({ job_id: jobId });
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

  const togglePhoto = (photoId) => {
    if (selectedPhotoIds.includes(photoId)) {
      onSelectionChange(selectedPhotoIds.filter((id) => id !== photoId));
    } else {
      onSelectionChange([...selectedPhotoIds, photoId]);
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-success-600" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="p-8 text-center">
          <Camera className="w-12 h-12 text-ink-300 mx-auto mb-3" />
          <p className="text-sm text-content-body dark:text-ink-300">
            No photos available for this job
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-700 dark:text-ink-300">
          Select photos to attach ({selectedPhotoIds.length} selected)
        </p>
        {selectedPhotoIds.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSelectionChange([])}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {photos.map((photo) => {
          const isSelected = selectedPhotoIds.includes(photo.id);
          return (
            <div
              key={photo.id}
              className={`relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                isSelected
                  ? "border-success-500 ring-2 ring-success-200"
                  : "border-line"
              }`}
              onClick={() => togglePhoto(photo.id)}
            >
              <img
                src={photo.thumbnail_url || photo.photo_url}
                alt={photo.caption || "Photo"}
                className="w-full h-full object-cover"
              />
              <Badge
                className={`absolute top-1 left-1 text-xs ${getCategoryColor(
                  photo.category,
                )}`}
              >
                {photo.category}
              </Badge>
              {isSelected && (
                <div className="absolute inset-0 bg-success-600/20 flex items-center justify-center">
                  <div className="w-8 h-8 bg-success-600 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-content-inverted" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
