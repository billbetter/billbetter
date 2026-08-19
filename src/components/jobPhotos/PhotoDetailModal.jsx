import React, { useState } from "react";
import { sdk } from "@/api/sdk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Star,
  MapPin,
  Calendar,
  Tag,
  Download,
  Trash2,
  Save,
  X,
  Loader2,
  User,
} from "lucide-react";
import { format } from "date-fns";

export default function PhotoDetailModal({
  isOpen,
  onClose,
  photo,
  onUpdate,
  onDelete,
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [caption, setCaption] = useState(photo.caption || "");
  const [category, setCategory] = useState(photo.category);
  const [tags, setTags] = useState(photo.tags?.join(", ") || "");
  const [isFavorite, setIsFavorite] = useState(photo.is_favorite);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tagArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);

      await sdk.entities.JobPhoto.update(photo.id, {
        caption,
        category,
        tags: tagArray,
        is_favorite: isFavorite,
      });

      onUpdate();
    } catch (error) {
      console.error("Error updating photo:", error);
      alert("Failed to update photo");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this photo?")) {
      return;
    }

    setDeleting(true);
    try {
      await sdk.entities.JobPhoto.delete(photo.id);
      onDelete();
      onClose();
    } catch (error) {
      console.error("Error deleting photo:", error);
      alert("Failed to delete photo");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = () => {
    window.open(photo.photo_url, "_blank");
  };

  const toggleFavorite = async () => {
    const newFavorite = !isFavorite;
    setIsFavorite(newFavorite);
    try {
      await sdk.entities.JobPhoto.update(photo.id, {
        is_favorite: newFavorite,
      });
      onUpdate();
    } catch (error) {
      console.error("Error updating favorite:", error);
      setIsFavorite(!newFavorite);
    }
  };

  const getCategoryColor = (cat) => {
    const colors = {
      before: "bg-info-100 text-info-700",
      during: "bg-caution-100 text-caution-700",
      after: "bg-positive-100 text-positive-700",
      issue: "bg-danger-100 text-danger-700",
      receipt: "bg-brand-100 text-brand-700",
      other: "bg-ink-100 text-ink-700",
    };
    return colors[cat] || colors.other;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Photo Details</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFavorite}
                className={isFavorite ? "text-caution-500" : ""}
              >
                <Star
                  className={`w-5 h-5 ${isFavorite ? "fill-caution-500" : ""}`}
                />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDownload}>
                <Download className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={deleting}
                className="text-danger-600 hover:text-danger-700"
              >
                {deleting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Photo */}
          <div>
            <img
              src={photo.photo_url}
              alt={photo.caption || "Job photo"}
              className="w-full rounded-lg"
            />
          </div>

          {/* Details */}
          <div className="space-y-4">
            {/* Metadata */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-content-body dark:text-ink-300">
                <Calendar className="w-4 h-4" />
                {format(new Date(photo.taken_date), "MMMM d, yyyy 'at' h:mm a")}
              </div>
              {photo.uploaded_by_name && (
                <div className="flex items-center gap-2 text-sm text-content-body dark:text-ink-300">
                  <User className="w-4 h-4" />
                  Uploaded by {photo.uploaded_by_name}
                </div>
              )}
              {photo.location_lat && photo.location_lng && (
                <div className="flex items-center gap-2 text-sm text-content-body dark:text-ink-300">
                  <MapPin className="w-4 h-4" />
                  Location: {photo.location_lat.toFixed(6)},{" "}
                  {photo.location_lng.toFixed(6)}
                </div>
              )}
            </div>

            {editing ? (
              <>
                {/* Edit Mode */}
                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Before</SelectItem>
                      <SelectItem value="during">During</SelectItem>
                      <SelectItem value="after">After</SelectItem>
                      <SelectItem value="issue">Issue</SelectItem>
                      <SelectItem value="receipt">Receipt</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Caption/Notes</Label>
                  <Textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a description..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="e.g., electrical, wiring, panel"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-brand hover:bg-brand-hover"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* View Mode */}
                <div>
                  <Label className="text-xs text-content-body dark:text-ink-300">
                    Category
                  </Label>
                  <Badge className={`${getCategoryColor(category)} mt-1`}>
                    {category}
                  </Badge>
                </div>

                {caption && (
                  <div>
                    <Label className="text-xs text-content-body dark:text-ink-300">
                      Caption
                    </Label>
                    <p className="text-sm text-content mt-1 dark:text-content-inverted">
                      {caption}
                    </p>
                  </div>
                )}

                {photo.tags && photo.tags.length > 0 && (
                  <div>
                    <Label className="text-xs text-content-body flex items-center gap-1 dark:text-ink-300">
                      <Tag className="w-3 h-3" />
                      Tags
                    </Label>
                    <div className="flex flex-wrap gap-1 mt-1">
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
                  </div>
                )}

                <Button
                  onClick={() => setEditing(true)}
                  variant="outline"
                  className="w-full"
                >
                  Edit Details
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
